import { useEffect, useRef } from "react";
import { ExternalLink, RotateCw, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";

interface EmbeddedPageHeaderProps {
  /** Page title; on desktop the breadcrumb bar already shows it, so it only labels the phone row. */
  title: string;
  url: string;
  openLabel: string;
  reloadLabel?: string;
  onReload?: () => void;
  settings?: { label: string; open: boolean; onToggle: () => void };
  openTestId?: string;
  settingsTestId?: string;
}

type ToolbarProps = Omit<EmbeddedPageHeaderProps, "title"> & { showUrl: boolean };

function EmbeddedActions({ url, openLabel, reloadLabel, onReload, settings, openTestId, settingsTestId, showUrl }: ToolbarProps) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      {showUrl ? (
        <span className="hidden max-w-[28ch] truncate font-mono text-xs text-muted-foreground xl:block">{url}</span>
      ) : null}
      {onReload ? (
        <Button variant="ghost" size="icon-sm" aria-label={reloadLabel} title={reloadLabel} onClick={onReload}>
          <RotateCw />
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="icon-sm">
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={openLabel}
          title={openLabel}
          data-testid={openTestId}
        >
          <ExternalLink />
        </a>
      </Button>
      {settings ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={settings.label}
          title={settings.label}
          aria-expanded={settings.open}
          onClick={settings.onToggle}
          data-testid={settingsTestId}
        >
          <Settings />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Header for pages that frame a separately-run site (board, canvas, office, deploy console).
 * Desktop: the address and buttons live in the breadcrumb bar next to the page title, so the
 * page is one row instead of a title bar plus a second address row. Phones keep a slim row of
 * their own because the breadcrumb bar drops page toolbars there.
 */
export function EmbeddedPageHeader(props: EmbeddedPageHeaderProps) {
  const { title, url, openLabel, reloadLabel, onReload, settings, openTestId, settingsTestId } = props;
  const { setBreadcrumbToolbar } = useBreadcrumbs();

  // Callbacks go through a ref so the toolbar node only changes when something visible changes
  // (a fresh node on every render would re-render the provider and loop).
  const handlers = useRef({ onReload, onToggle: settings?.onToggle });
  handlers.current = { onReload, onToggle: settings?.onToggle };
  const hasReload = Boolean(onReload);
  const hasSettings = Boolean(settings);
  const settingsOpen = settings?.open ?? false;
  const settingsLabel = settings?.label ?? "";

  useEffect(() => {
    setBreadcrumbToolbar(
      <EmbeddedActions
        showUrl
        url={url}
        openLabel={openLabel}
        reloadLabel={reloadLabel}
        onReload={hasReload ? () => handlers.current.onReload?.() : undefined}
        settings={hasSettings ? { label: settingsLabel, open: settingsOpen, onToggle: () => handlers.current.onToggle?.() } : undefined}
        openTestId={openTestId}
        settingsTestId={settingsTestId}
      />,
    );
    return () => setBreadcrumbToolbar(null);
  }, [setBreadcrumbToolbar, url, openLabel, reloadLabel, hasReload, hasSettings, settingsOpen, settingsLabel, openTestId, settingsTestId]);

  return (
    <div className="flex shrink-0 items-center gap-2 px-4 py-2 md:hidden">
      <span className="shrink-0 text-sm font-medium text-foreground">{title}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</span>
      <EmbeddedActions
        showUrl={false}
        url={url}
        openLabel={openLabel}
        reloadLabel={reloadLabel}
        onReload={onReload}
        settings={settings}
        openTestId={openTestId}
        settingsTestId={settingsTestId}
      />
    </div>
  );
}
