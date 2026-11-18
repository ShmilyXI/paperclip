import { describeError } from "@/api/errors";
import { t } from "@/i18n";
import { ShieldCheck, ShieldX, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export interface ProjectAccessNoticeProps {
  agentName?: string;
  projectName?: string;
  ready: boolean;
  canManage: boolean;
  canRetry: boolean;
  onManage: () => void;
  onRetry: () => void;
  error?: Error | null;
  className?: string;
}

export function ProjectAccessNotice({ agentName = t("projectAccessNotice.thisAgent"), projectName, ready, canManage, canRetry, onManage, onRetry, error, className }: ProjectAccessNoticeProps) {
  return <section role={ready ? "status" : "alert"} aria-label={t("projectAccessNotice.projectAccess")} className={cn("space-y-4 rounded-lg border border-border p-4", className)}>
    <div className="flex items-start gap-3">
      {ready ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden /> : <ShieldX className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />}
      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-semibold">{ready ? t("projectAccessNotice.projectAccessIsReady") : t("projectAccessNotice.agentCantAccessThisProject", { agentName })}</h3>
        <p className="text-sm text-muted-foreground">{ready
          ? t("projectAccessNotice.agentCanNowAccess")
          : t("projectAccessNotice.taskNeedsProjectOutside", { projectName: projectName ?? t("projectAccessNotice.aProject") })}</p>
        {!ready && !canManage && <p className="text-sm text-muted-foreground">{t("projectAccessNotice.personWithAgentManagement")}</p>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2 pl-8">
      {ready ? canRetry && <Button size="sm" onClick={onRetry}>{t("projectAccessNotice.retryTask")}<ArrowRight className="size-4" aria-hidden /></Button>
        : <Button size="sm" variant="outline" onClick={onManage}>{canManage ? t("projectAccessNotice.manageProjectAccess") : t("projectAccessNotice.viewAgentAccess")}<ArrowRight className="size-4" aria-hidden /></Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{describeError(error).body}</p>}
    {!ready && <details className="pl-8 text-xs text-muted-foreground"><summary className="cursor-pointer">{t("projectAccessNotice.runDetails")}</summary>
      <dl className="mt-3 grid grid-cols-2 gap-2"><dt>{t("projectAccessNotice.stoppedDuring")}</dt><dd>{t("projectAccessNotice.workspaceSetup")}</dd><dt>{t("projectAccessNotice.reason")}</dt><dd>{t("projectAccessNotice.projectOutsideAllowedScope")}</dd><dt>{t("projectAccessNotice.providerStarted")}</dt><dd>{t("common.no")}</dd></dl>
    </details>}
  </section>;
}
