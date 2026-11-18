import type { ReactNode } from "react";
import { FileText, TriangleAlert } from "lucide-react";
import type { Agent, AttentionItem } from "@paperclipai/shared";
import { t } from "@/i18n";
import { Link } from "@/lib/router";
import { readIssueReviewPolicyMetadata } from "@/lib/review-policy";
import { DecisionCardFooter } from "@/components/DecisionCardFooter";
import { StalledReviewActions } from "@/components/StalledReviewActions";
import { Button } from "@/components/ui/button";
import { NeedsYouPanel, NeedsYouPanelNote, NeedsYouPanelRow } from "./NeedsYouCardKit";

/**
 * Bodies of the Needs You cards whose real action lives on the task (PAP-775,
 * Paper "10", "13", "14"): the inset panel and the footer. There is no inline
 * review verdict for a covered review, no inline reassign, and resolving a
 * recovery also sets the task's next status, so their primary action opens the
 * task. A stalled review keeps its three inline review verbs.
 */

export interface NeedsYouCardBodyProps {
  item: AttentionItem;
  companyId: string;
  agentMap?: ReadonlyMap<string, Agent>;
  userLabelMap?: ReadonlyMap<string, string>;
  /** The task link at the left of the footer. */
  leading?: ReactNode;
  footerContext?: ReactNode;
  onResolved?: () => void;
  /** In-app navigation (react-router `navigate`); a plain link without it. */
  onOpen?: (href: string) => void;
}

const metadataString = (item: AttentionItem, key: string) => {
  const value = item.subject.metadata?.[key];
  return typeof value === "string" && value ? value : null;
};

/** "NEE-19 · Review pilot consent copy". */
const taskLine = (task: { identifier?: string | null; title?: string | null }) =>
  [task.identifier, task.title].filter(Boolean).join(" · ") || t("common.task");

/** The assignee's name, from the same agent and people lists the page reads. */
function assigneeName(item: AttentionItem, agentMap?: ReadonlyMap<string, Agent>, userLabelMap?: ReadonlyMap<string, string>): string | null {
  const agentId = metadataString(item, "assigneeAgentId");
  const userId = metadataString(item, "assigneeUserId");
  if (agentId) return agentMap?.get(agentId)?.name ?? null;
  return userId ? userLabelMap?.get(userId) ?? null : null;
}

/** The primary "Open …" action: in-app navigation when given, else a link. */
function OpenButton({ href, onOpen, variant = "default", children }: { href: string; onOpen?: (href: string) => void; variant?: "default" | "outline"; children: ReactNode }) {
  if (onOpen) return <Button type="button" size="sm" variant={variant} onClick={() => onOpen(href)}>{children}</Button>;
  return <Button asChild size="sm" variant={variant}><Link to={href}>{children}</Link></Button>;
}

/**
 * 10 "Review a task": a task in review assigned to you. The verdict is given on
 * the task, where the review stage, its policy and the comment live, so the
 * card opens it.
 */
export function ReviewTaskCardBody({ item, companyId, agentMap, userLabelMap, leading, footerContext, onOpen }: NeedsYouCardBodyProps) {
  const assignee = assigneeName(item, agentMap, userLabelMap);
  const href = item.subject.href;
  // The feed carries no acceptance checklist yet, so the panel is the state line.
  return <>
    <NeedsYouPanel>
      <NeedsYouPanelNote>{[t("common.inReview"), assignee ? t("needsYouCardBodies.assignedTo", { name: assignee }) : null].filter(Boolean).join(" · ")}</NeedsYouPanelNote>
    </NeedsYouPanel>
    {footerContext}
    <DecisionCardFooter leading={leading}>
      {href ? <OpenButton href={href} onOpen={onOpen}>{t("needsYou.openTask")}</OpenButton> : null}
    </DecisionCardFooter>
  </>;
}

/**
 * 13 "Unblock a task": the task that is in the way (the blocker, or the
 * stalled review itself) and what it blocks. A stalled review is answered here
 * with its review verbs; any other blocker opens the task that is in the way.
 */
export function BlockedTaskCardBody({ item, companyId, agentMap, userLabelMap, leading, footerContext, onResolved, onOpen }: NeedsYouCardBodyProps) {
  const assignee = assigneeName(item, agentMap, userLabelMap);
  const stalledReview = item.sourceKind === "review";
  const blocking = item.detail?.kind === "blocker" ? item.detail.blockingIssue : null;
  // "/NEE": the company prefix of the card's own links.
  const prefix = (item.subject.href ?? "").match(/^\/[^/]+/)?.[0] ?? "";
  const blockingHref = blocking?.id || blocking?.identifier ? `${prefix}/issues/${blocking.identifier ?? blocking.id}` : null;
  const href = blockingHref ?? item.subject.href;
  // A human-owned unblock names the blocker and blocks the subject; a stalled
  // blocker chain is the subject itself and blocks its related task.
  const blocked = blocking ? item.subject : item.relatedIssue?.id !== item.subject.id ? item.relatedIssue : null;
  const blockedCount = item.detail?.kind === "blocker" ? item.detail.blockedTaskCount ?? 0 : 0;
  const status = item.subject.status ? `${item.subject.status[0]!.toUpperCase()}${item.subject.status.slice(1).replaceAll("_", " ")}` : null;
  const meta = stalledReview ? [t("needsYouCardBodies.reviewStalled"), assignee].filter(Boolean).join(" · ")
    : blocking ? item.whyNow
      : [status, assignee].filter(Boolean).join(" · ") || undefined;
  const note = stalledReview ? t("needsYouCardBodies.noReviewerMoving")
    : blocked ? `${t("needsYouCardBodies.blocks", { task: taskLine(blocked) })}${blockedCount > 1 ? t("needsYouCardBodies.andMore", { count: blockedCount - 1 }) : ""}`
      : blockedCount > 0 ? t("needsYouCardBodies.blocksTasks", { count: blockedCount })
        : null;
  const panel = <NeedsYouPanel>
    {/* Without a separate blocker the task is the footer's, so the row only says its state (IA4). */}
    {blocking ? <NeedsYouPanelRow icon={<FileText />} title={taskLine(blocking)} meta={meta}
      onOpen={href && onOpen ? () => onOpen(href) : undefined} /> : <NeedsYouPanelRow icon={<FileText />} title={meta ?? t("needsYouCardBodies.blocked")} />}
    {note ? <NeedsYouPanelNote>{note}</NeedsYouPanelNote> : null}
  </NeedsYouPanel>;
  if (stalledReview) {
    return <>
      {panel}
      <StalledReviewActions presentation="card" footerSlot={leading} issueId={item.subject.id} companyId={companyId}
        reviewPolicy={readIssueReviewPolicyMetadata(item.subject.metadata)} approveLabel={t("recovery.markTaskDone")} onResolved={() => onResolved?.()} />
    </>;
  }
  return <>
    {panel}
    {footerContext}
    <DecisionCardFooter leading={leading}>
      {href ? <OpenButton href={href} onOpen={onOpen}>{blockingHref ? t("needsYouCardBodies.openBlockingTask") : t("needsYou.openTask")}</OpenButton> : null}
    </DecisionCardFooter>
  </>;
}

const RECOVERY_KIND_LABEL_KEYS: Record<string, string> = {
  missing_disposition: "needsYouCardBodies.recoveryKindMissingDisposition",
  deliberate_wait_without_target: "needsYouCardBodies.recoveryKindDeliberateWait",
  stranded_assigned_issue: "needsYouCardBodies.recoveryKindStranded",
  workspace_validation: "needsYouCardBodies.recoveryKindWorkspaceValidation",
  configuration_validation: "needsYouCardBodies.recoveryKindConfigurationValidation",
  active_run_watchdog: "needsYouCardBodies.recoveryKindActiveRunWatchdog",
  issue_graph_liveness: "needsYouCardBodies.recoveryKindIssueGraphLiveness",
};

/**
 * 14 "Recover a run": what stopped and the next step. Resolving a recovery
 * also sets the task's next status, so it is done in the recovery control on
 * the task (PAP-749 Rule 7), which the card opens.
 */
export function RecoveryCardBody({ item, leading, footerContext, onOpen }: NeedsYouCardBodyProps) {
  const kind = metadataString(item, "kind");
  const title = [
    kind ? (RECOVERY_KIND_LABEL_KEYS[kind] ? t(RECOVERY_KIND_LABEL_KEYS[kind]) : `${kind[0]!.toUpperCase()}${kind.slice(1).replaceAll("_", " ")}`) : t("needsYouCardBodies.recovery"),
    item.subject.status === "escalated" ? t("needsYouCardBodies.recoveryEscalated") : t("needsYouCardBodies.recoveryPaused"),
  ].join(" · ");
  const href = item.subject.href;
  return <>
    <NeedsYouPanel>
      <NeedsYouPanelRow icon={<TriangleAlert className="text-amber-600 dark:text-amber-300" />} title={title} />
      {/* The ask above is the recovery's next action; this says where it is done. */}
      <NeedsYouPanelNote>{t("needsYouCardBodies.resolveReassignOrCancel")}</NeedsYouPanelNote>
    </NeedsYouPanel>
    {footerContext}
    <DecisionCardFooter leading={leading}>
      {href ? <OpenButton href={href} onOpen={onOpen}>{t("needsYouCardBodies.openRecovery")}</OpenButton> : null}
    </DecisionCardFooter>
  </>;
}
