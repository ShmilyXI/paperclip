import { useCallback, useEffect, useState } from "react";
import { t } from "@/i18n";
import { EmbeddedPageHeader } from "@/components/EmbeddedPageHeader";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";

const CANVAS_URL = "https://canvas.culud.com/";

export function InfiniteCanvas() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [revision, setRevision] = useState(0);
  useEffect(() => setBreadcrumbs([{ label: t("nav.infiniteCanvas") }]), [setBreadcrumbs]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  return (
    <div className="-m-4 flex h-(--infinite-canvas-mobile-height) min-h-0 flex-col md:-m-6 md:h-full" data-page="infinite-canvas">
      <EmbeddedPageHeader
        title={t("nav.infiniteCanvas")}
        url={CANVAS_URL}
        openLabel={t("infiniteCanvas.openInNewWindow")}
        reloadLabel={t("infiniteCanvas.reload")}
        onReload={reload}
      />
      <iframe
        key={revision}
        src={CANVAS_URL}
        title={t("nav.infiniteCanvas")}
        className="min-h-0 w-full flex-1 border-0 bg-background"
      />
    </div>
  );
}
