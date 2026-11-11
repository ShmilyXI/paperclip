import { useCallback, useEffect, useRef, useState } from "react";

import { t } from "@/i18n";
import { EmbeddedPageHeader } from "@/components/EmbeddedPageHeader";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";

interface EmbeddedSiteProps {
  pageKey: string;
  title: string;
  url: string;
  /** Receives postMessage data only from the framed site's own origin and window. */
  onFrameMessage?: (data: unknown) => void;
}

/** A full-bleed frame onto a separately-run site that shares this deployment's login domain. */
export function EmbeddedSite({ pageKey, title, url, onFrameMessage }: EmbeddedSiteProps) {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [revision, setRevision] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => setBreadcrumbs([{ label: title }]), [setBreadcrumbs, title]);

  useEffect(() => {
    if (!onFrameMessage) return;
    const origin = new URL(url).origin;
    const listener = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frameRef.current?.contentWindow) return;
      onFrameMessage(event.data);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [url, onFrameMessage]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  return (
    <div className="-m-4 flex h-(--infinite-canvas-mobile-height) min-h-0 flex-col md:-m-6 md:h-full" data-page={pageKey}>
      <EmbeddedPageHeader
        title={title}
        url={url}
        openLabel={t("embeddedSite.openInNewWindow")}
        reloadLabel={t("embeddedSite.reload")}
        onReload={reload}
      />
      <iframe
        key={revision}
        ref={frameRef}
        src={url}
        title={title}
        allow="fullscreen; clipboard-write"
        className="min-h-0 w-full flex-1 border-0 bg-background"
        data-testid={`${pageKey}-frame`}
      />
    </div>
  );
}
