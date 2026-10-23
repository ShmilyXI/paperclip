import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Settings } from "lucide-react";

import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";

/** Operator-configured address of the coordination board service. */
export const BOARD_URL_STORAGE_KEY = "paperclip.board.url";

/**
 * Default address of the local coordination board — a separate Node service
 * (not part of this UI). Overridable per browser via the settings row.
 */
export const DEFAULT_BOARD_URL = "http://localhost:3110";

/**
 * How long a frame may stay unloaded before we announce the refusal. A frame
 * blocked by X-Frame-Options / CSP frame-ancestors never reports a usable
 * load, but the browser does not raise a scriptable error for it either, so a
 * timeout is the only signal available to the page.
 */
export const DEFAULT_FRAME_TIMEOUT_MS = 6000;

function safeStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Trim, drop empties back to the default, and assume http:// when schemeless. */
export function normalizeBoardUrl(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_BOARD_URL;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`;
}

export function readBoardUrl(storage: Storage | undefined = safeStorage()): string {
  try {
    return normalizeBoardUrl(storage?.getItem(BOARD_URL_STORAGE_KEY));
  } catch {
    return DEFAULT_BOARD_URL;
  }
}

export function writeBoardUrl(url: string, storage: Storage | undefined = safeStorage()) {
  try {
    storage?.setItem(BOARD_URL_STORAGE_KEY, url);
  } catch {
    // Private-mode / quota failures must not break the page.
  }
}

type FrameStatus = "pending" | "ready" | "blocked";

interface BoardProps {
  /** Overridable for tests; production uses DEFAULT_FRAME_TIMEOUT_MS. */
  frameLoadTimeoutMs?: number;
}

/**
 * Coordination board — a full-bleed frame onto the separately-run board
 * service. This page owns only the address (localStorage) and the failure
 * explanation; it never proxies or rewrites the remote site.
 */
export function Board({ frameLoadTimeoutMs = DEFAULT_FRAME_TIMEOUT_MS }: BoardProps) {
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => setBreadcrumbs([{ label: t("nav.board") }]), [setBreadcrumbs]);

  const [url, setUrl] = useState<string>(() => readBoardUrl());
  const [draft, setDraft] = useState<string>(url);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [frameStatus, setFrameStatus] = useState<FrameStatus>("pending");

  useEffect(() => {
    setFrameStatus("pending");
    const timer = setTimeout(() => {
      setFrameStatus((current) => (current === "ready" ? current : "blocked"));
    }, frameLoadTimeoutMs);
    return () => clearTimeout(timer);
  }, [url, frameLoadTimeoutMs]);

  const toggleSettings = useCallback(() => {
    setDraft(url);
    setSettingsOpen((open) => !open);
  }, [url]);

  const saveAddress = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const next = normalizeBoardUrl(draft);
      setUrl(next);
      setDraft(next);
      writeBoardUrl(next);
      setSettingsOpen(false);
    },
    [draft],
  );

  return (
    <div className="-m-4 flex h-full min-h-0 flex-col md:-m-6" data-page="board">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2 md:px-6">
        <span className="shrink-0 text-sm font-medium text-foreground">{t("nav.board")}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</span>
        <Button asChild variant="ghost" size="icon-sm">
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t("board.openInNewWindow")}
            data-testid="board-open-external"
          >
            <ExternalLink />
          </a>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("board.settingsLabel")}
          aria-expanded={settingsOpen}
          onClick={toggleSettings}
          data-testid="board-settings-toggle"
        >
          <Settings />
        </Button>
      </div>

      {settingsOpen ? (
        <form
          className="flex shrink-0 flex-wrap items-end gap-2 border-b border-border px-4 py-2 md:px-6"
          onSubmit={saveAddress}
          data-testid="board-settings"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("board.addressLabel")}</span>
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={DEFAULT_BOARD_URL}
              spellCheck={false}
              autoFocus
              data-testid="board-address-input"
            />
          </label>
          <Button type="submit" size="sm" data-testid="board-address-save">
            {t("board.save")}
          </Button>
        </form>
      ) : null}

      {frameStatus === "blocked" ? (
        <div
          role="status"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 md:px-6"
          data-testid="board-frame-blocked"
        >
          <span className="text-sm font-medium text-foreground">{t("board.blockedTitle")}</span>
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">
            {t("board.blockedDescription", { url })}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {t("board.currentAddress")}: {url}
          </span>
          <Button asChild variant="outline" size="sm">
            <a href={url} target="_blank" rel="noreferrer noopener" data-testid="board-blocked-open-external">
              {t("board.openInNewWindow")}
            </a>
          </Button>
        </div>
      ) : null}

      <iframe
        src={url}
        title={t("board.frameTitle")}
        className="min-h-0 w-full flex-1 border-0 bg-background"
        onLoad={() => setFrameStatus("ready")}
        onError={() => setFrameStatus("blocked")}
        data-testid="board-frame"
      />
    </div>
  );
}
