import { t } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import type { DecisionHistoryEntry } from "@paperclipai/shared";
import { decisionModelsApi } from "@/api/decision-models";
import { Link } from "@/lib/router";
import { formatDateTime, formatTokens, formatDetailedCents } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DecisionHistoryTable({ entries, fastResponse = false, fastResponsesEnabled = true }: { entries: (DecisionHistoryEntry & { publicationStatus?: string; connectionName?: string | null })[]; fastResponse?: boolean; fastResponsesEnabled?: boolean }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">{fastResponse ? t("decisionHistory.noFastResponsesInThis") : t("decisionHistory.noDecisionRequestsInThis")} <Link to={fastResponse && !fastResponsesEnabled ? "/company/settings/instance/experimental" : "/company/settings/connections"} className="underline underline-offset-4">{fastResponse ? fastResponsesEnabled ? t("decisionHistory.configureFastResponse") : t("decisionHistory.enableExperimentalFastResponses") : t("decisionHistory.configureADecisionModel")}</Link> {t("decisionHistory.toRunATest")}</p>;
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">{t("decisionHistory.recentRequestsInputsAreNot")}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm" aria-label={fastResponse ? t("decisionHistory.fastResponses") : t("decisionHistory.decisionRequests")}>
      <thead><tr className="border-b border-border text-muted-foreground">{[t("decisionHistory.whenFeature"), t("decisionHistory.responsible"), t("common.task"), ...(fastResponse ? [t("common.connection")] : []), t("common.model"), t("common.status"), t("common.duration"), t("decisionHistory.tokensInOut"), t("common.cost")].map(label => <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>)}</tr></thead>
      <tbody>{entries.map(row => <tr key={row.id} className="border-b border-border last:border-0">
        <td className="px-3 py-3"><div className="whitespace-nowrap">{formatDateTime(row.startedAt)}</div><div className="text-xs text-muted-foreground">{row.feature === "settings.test" ? t("decisionHistory.setupTest") : row.feature}</div></td>
        <td className="px-3 py-3">{row.actorType === "system" ? t("decisionHistory.paperclipServices") : row.userName ?? (row.responsibleUserId === "local-board" ? t("common.board") : t("decisionHistory.formerUser"))}</td>
        <td className="px-3 py-3">{row.issueId ? <Link className="underline underline-offset-4" to={`/issues/${row.issueIdentifier ?? row.issueId}`}>{row.issueIdentifier ?? t("decisionHistory.viewTask")}</Link> : "—"}</td>
        {fastResponse && <td className="px-3 py-3">{row.connectionName ?? (row.connectionId ? t("decisionHistory.removedConnection") : "—")}</td>}
        <td className="px-3 py-3 font-mono text-xs">{row.model}</td>
        <td className="px-3 py-3"><div>{row.status === "succeeded" ? t("common.succeeded") : row.status === "running" ? t("common.running") : row.status === "unknown" ? t("decisionHistory.unresolved") : row.status === "skipped" ? t("decisionHistory.skipped") : row.status === "pending" ? t("common.pending") : t("common.failed")}</div>{row.publicationStatus && <div className="text-xs text-muted-foreground">{row.publicationStatus}</div>}{row.errorCode && <div className="text-xs text-muted-foreground">{row.errorCode.replaceAll("_", " ")}</div>}</td>
        <td className="px-3 py-3 font-mono">{row.durationMs === null ? "—" : `${(row.durationMs / 1000).toFixed(1)}s`}</td>
        <td className="whitespace-nowrap px-3 py-3 font-mono">{row.inputTokens === null ? "—" : formatTokens(row.inputTokens)} / {row.outputTokens === null ? "—" : formatTokens(row.outputTokens)}</td>
        <td className="px-3 py-3 font-mono"><div>{row.costCents === null ? t("common.unknown") : formatDetailedCents(row.costCents)}</div>{row.costStatus !== "unpriced" && row.costStatus && <span className="text-xs text-muted-foreground">{row.costStatus === "estimated" ? t("decisionHistory.estimated") : t("decisionHistory.reported")}</span>}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
export function DecisionHistory({ companyId, from, to }: { companyId: string; from?: string | null; to?: string | null }) {
  const query = useQuery({ queryKey: ["decision-history", companyId, from, to], queryFn: () => decisionModelsApi.history(companyId, from, to), refetchInterval: q => q.state.data?.some(row => row.status === "running") ? 5000 : false });
  if (query.isPending) return <p className="text-sm text-muted-foreground">{t("decisionHistory.loadingDecisionRequests")}</p>;
  if (query.error) return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{t("decisionHistory.couldNotLoadDecisionRequests")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("common.tryAgain")}</Button></div>;
  return <DecisionHistoryTable entries={query.data ?? []} />;
}
