import { useEffect, useState } from "react";
import { ExternalLink, RotateCw } from "lucide-react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";

const CANVAS_URL = "https://canvas.culud.com/";

export function InfiniteCanvas() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [revision, setRevision] = useState(0);
  useEffect(() => setBreadcrumbs([{ label: t("nav.infiniteCanvas") }]), [setBreadcrumbs]);

  return (
    <div className="-m-4 flex h-(--infinite-canvas-mobile-height) min-h-0 flex-col md:-m-6 md:h-full" data-page="infinite-canvas">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2 md:px-6">
        <span className="shrink-0 text-sm font-medium text-foreground">{t("nav.infiniteCanvas")}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{CANVAS_URL}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("infiniteCanvas.reload")}
              onClick={() => setRevision((value) => value + 1)}
            >
              <RotateCw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("infiniteCanvas.reload")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon-sm">
              <a
                href={CANVAS_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("infiniteCanvas.openInNewWindow")}
              >
                <ExternalLink />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("infiniteCanvas.openInNewWindow")}</TooltipContent>
        </Tooltip>
      </div>
      <iframe
        key={revision}
        src={CANVAS_URL}
        title={t("nav.infiniteCanvas")}
        className="min-h-0 w-full flex-1 border-0 bg-background"
      />
    </div>
  );
}
