import type { ReactNode } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { t } from "@/i18n";
import { Button } from "./ui/button";

export interface OrgChartActions {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

/** Shared camera controls can stay mounted while the chart view fades away. */
export function OrgChartControls({ zoomIn, zoomOut, fit, children }: OrgChartActions & { children?: ReactNode }) {
  return (
    <div className="org-chart-controls flex items-center gap-2" role="group" aria-label={t("orgChart.controls")}>
      <div className="design-view-toggle" role="group" aria-label={t("orgChart.chartCamera")}>
        <Button variant="ghost" size="icon-sm" className="design-toolbar-icon" aria-label={t("orgChart.zoomOut")} title={t("orgChart.zoomOut")} onClick={zoomOut}><Minus className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" className="design-toolbar-icon" aria-label={t("orgChart.zoomIn")} title={t("orgChart.zoomIn")} onClick={zoomIn}><Plus className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" className="design-toolbar-icon" aria-label={t("orgChart.fitChartToScreen")} title={t("orgChart.fitChartToScreen")} onClick={fit}><Maximize2 className="size-4" /></Button>
      </div>
      {children}
    </div>
  );
}
