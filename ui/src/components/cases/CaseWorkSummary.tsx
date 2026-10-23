import { t } from "@/i18n";
import { Clock3 } from "lucide-react";
import type { CaseDetail, CaseHandoffView } from "@/api/cases";
import { AgentIdentity } from "@/components/AgentIdentity";
import type { AvatarAgent } from "@/components/AgentAvatar";
import { IssueReferencePill } from "@/components/IssueReferencePill";
import { IssueStatusBadge } from "@/components/StatusBadge";
import { PropertyRow } from "@/components/issue-properties/primitives";

export type CaseAgentMap = ReadonlyMap<string, AvatarAgent & { status?: string }>;

export function CaseWorkSummary({ caseData, pendingHandoff, agents }: {
  caseData: CaseDetail;
  pendingHandoff?: CaseHandoffView | null;
  agents?: CaseAgentMap;
}) {
  const task = caseData.workIssue;
  const pending = pendingHandoff === undefined ? caseData.pendingHandoff : pendingHandoff;
  const assignee = task?.assigneeAgentId ? agents?.get(task.assigneeAgentId) ?? {
    id: task.assigneeAgentId,
    name: task.assigneeAgentName ?? t("common.agent"),
  } : null;
  const from = pending?.fromAgentId ? agents?.get(pending.fromAgentId)?.name ?? pending.fromAgentName ?? "the previous agent" : "the previous agent";
  const to = pending ? (pending.toAgentId ? agents?.get(pending.toAgentId)?.name : null) ?? pending.toAgentName ?? "the receiving agent" : null;
  const destination = pending?.toAgentId ? agents?.get(pending.toAgentId) : null;
  const waiting = pending?.destinationKind === "done" ? t("caseWorkSummary.caseWillCloseWhenThe") : pending?.lastError
    ?? (pending?.state === "awaiting_release" ? t("caseWorkSummary.waitingForFromToFinish", { from })
      : destination?.status === "paused" ? `${to} is paused.` : t("caseWorkSummary.waitingForToToStart", { to }));

  return <section className="space-y-3" aria-label={t("caseWorkSummary.caseWork")}>
    <h2 className="text-sm font-semibold">{t("caseWorkSummary.work")}</h2>
    {caseData.workIssueId ? <div className="space-y-3">
      {task ? <div>
        <PropertyRow label={t("common.task")}><IssueReferencePill issue={task} className="min-h-11 md:min-h-0" /></PropertyRow>
        <PropertyRow label={t("caseWorkSummary.workflow")}><span className="text-sm">{caseData.workflow?.name ?? t("caseWorkSummary.caseInstructions")}</span></PropertyRow>
        {caseData.phase && <PropertyRow label={t("caseWorkSummary.phase")}><span className="text-sm">{caseData.phase}</span></PropertyRow>}
        <PropertyRow label={t("common.agent")}>{assignee ? <AgentIdentity agent={assignee} size="xs" /> : <span className="text-sm text-muted-foreground">{t("common.unassigned")}</span>}</PropertyRow>
        <PropertyRow label={t("caseWorkSummary.taskStatus")}><IssueStatusBadge status={task.status} /></PropertyRow>
      </div> : <p className="text-sm text-muted-foreground">{t("caseWorkSummary.thePrimaryTaskIsUnavailable")}</p>}
      {pending && pending.state !== "delivered" && pending.state !== "completed" && pending.state !== "cancelled" && <div className="flex items-start gap-2 text-sm">
        <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          {pending.state === "awaiting_release" && <p>{t("caseWorkSummary.next")} {pending.workflowTransition?.to.name ?? t("caseWorkSummary.caseInstructions")} · {pending.phase}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">{waiting}</p>
        </div>
      </div>}
    </div> : <p className="text-sm text-muted-foreground">{t("caseWorkSummary.noTaskLinked")}</p>}
  </section>;
}
