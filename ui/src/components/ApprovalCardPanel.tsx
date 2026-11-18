import type { ReactNode } from "react";
import { t } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { FileText, UserRound } from "lucide-react";
import { type AttentionItem } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { getAdapterLabel } from "../adapters/adapter-display-registry";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";
import { localizedRoleLabels } from "../lib/role-labels";
import { NeedsYouPanel, NeedsYouPanelNote, NeedsYouPanelRow } from "./coordinator/NeedsYouCardKit";

function payloadString(payload: Record<string, unknown> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const APPROVAL_KIND_LABELS: Record<string, string> = {
  request_board_approval: t("approvalCard.boardApprovalRequest"),
  approve_ceo_strategy: t("approvalCard.strategyApproval"),
  budget_override_required: t("approvalCard.budgetOverrideRequest"),
};

const wholeDollars =(cents: number) => formatCents(cents).replace(/\.00$/, "");

/**
 * What the approval is for, in the card's inset panel (PAP-775, Paper "06"):
 * the agent a hire creates, or the request's own title and summary.
 */
export function ApprovalCardPanel({ item, companyId, artifactRow, onViewDetails }: {
  item: AttentionItem;
  companyId: string;
  artifactRow?: ReactNode;
  onViewDetails?: () => void;
}) {
  const hire = item.subject.metadata?.type === "hire_agent";
  // The feed carries no payload; the side panel reads the same query.
  const approval = useQuery({ queryKey: queryKeys.approvals.detail(item.subject.id), queryFn: () => approvalsApi.get(item.subject.id), enabled: !artifactRow });
  const payload = approval.data?.payload;
  const reportsTo = payloadString(payload, "reportsTo");
  const agents = useQuery({ queryKey: queryKeys.agents.list(companyId), queryFn: () => agentsApi.list(companyId), enabled: hire && !!reportsTo });
  if (artifactRow) return <NeedsYouPanel>{artifactRow}</NeedsYouPanel>;
  if (hire) {
    const budget = typeof payload?.budgetMonthlyCents === "number" && payload.budgetMonthlyCents > 0 ? payload.budgetMonthlyCents : null;
    const name = payloadString(payload, "name") ?? item.subject.title ?? t("common.newAgent");
    const role = payloadString(payload, "role");
    const adapter = payloadString(payload, "adapterType");
    const manager = reportsTo ? agents.data?.find((agent) => agent.id === reportsTo)?.name : null;
    const meta = [
      manager ? t("approvalCard.reportsToManager", { manager }) : null,
      payloadString(payload, "title") ?? (role ? t("approvalCard.roleLabel", { role: localizedRoleLabels[role] ?? role }) : null),
      adapter ? getAdapterLabel(adapter) : null,
    ].filter(Boolean).join(" · ");
    return <NeedsYouPanel>
      <NeedsYouPanelRow icon={<UserRound />} title={budget ? `${name} · ${wholeDollars(budget)} ${t("builtIn.month")}` : name} meta={meta || undefined} onOpen={onViewDetails} label={t("attentionQueueRow.viewConfiguration")} />
      <NeedsYouPanelNote>{budget ? t("approvalCard.approvalCreatesTheAgentWithThis") : t("approvalCard.approvalCreatesTheAgent")}</NeedsYouPanelNote>
    </NeedsYouPanel>;
  }
  // The ask above already says the request's title and summary, so the panel
  // names the request and what it recommends.
  const kind = APPROVAL_KIND_LABELS[String(item.subject.metadata?.type ?? "")] ?? t("approvalCard.approvalRequest");
  const recommended = payloadString(payload, "recommendedAction");
  const next = payloadString(payload, "nextActionOnApproval");
  return <NeedsYouPanel>
    <NeedsYouPanelRow icon={<FileText />} title={recommended ?? kind} meta={recommended ? kind : undefined} onOpen={onViewDetails} label={t("approvalCard.viewDetails")} />
    {next ? <NeedsYouPanelNote>{t("approvalCard.onApprovalNext", { next })}</NeedsYouPanelNote> : null}
  </NeedsYouPanel>;
}

