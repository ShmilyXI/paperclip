import { useQueryView } from "@/components/QueryView";
import { useState, type ReactNode } from "react";
import { t } from "@/i18n";
import { ArrowUpRight } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { pendingDecisionTaskIds } from "@/lib/coordinator-attention";
import { useAttentionViewFeed } from "@/hooks/useAttentionViews";
import { useNavigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/components/StatusIcon";
import { ToolbarSearch } from "@/components/ToolbarSearch";

/** Distinct tasks from Needs You, not a second status-based attention guess. */
export function CoordinatorAttentionTasks({ toolbar }: { toolbar: ReactNode }) {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const feed = useAttentionViewFeed(selectedCompanyId, "mine");
  const feedView = useQueryView(feed);
  const waiting = ["loading", "reconnecting"].includes(feedView.kind);
  const items = feed.data?.items ?? [];
  const ids = pendingDecisionTaskIds(items);
  const tasks = [...new Map(items.flatMap((item) => {
    const task = item.relatedIssue ?? (item.subject.kind === "issue" ? item.subject : null);
    return task && ids.has(task.id) ? [[task.id, task] as const] : [];
  })).values()].filter((task) => `${task.identifier ?? ""} ${task.title ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="space-y-5">
    <h1 className="text-2xl font-medium">{t("common.tasks")}</h1>
    <div className="flex flex-wrap items-center gap-3">{toolbar}<ToolbarSearch query={search} onQueryChange={setSearch} label={t("coordinatorTasks.searchTasksNeedingAttention")} placeholder={t("coordinatorTasks.searchTasksPlaceholder")} /></div>
    {waiting ? <p role="status" className="text-sm text-muted-foreground">{t("coordinatorTasks.loadingTasks")}</p> : null}
    {(feedView.kind === "error") ? <div role="alert" className="space-y-2"><p>{t("coordinatorTasks.couldntLoadTasksNeedingAttention")}</p><Button variant="outline" onClick={() => void feed.refetch()}>{t("common.retry")}</Button></div> : null}
    {!waiting && !(feedView.kind === "error") && !tasks.length ? <p className="py-8 text-sm text-muted-foreground">{search ? t("coordinatorTasks.noTasksMatchSearch") : t("coordinatorTasks.noTasksNeedADecision")}</p> : null}
    <div className="divide-y divide-border">{tasks.map((task) => <button key={task.id} type="button" disabled={!task.href} onClick={() => { if (task.href) navigate(task.href); }} className="flex w-full items-center gap-3 py-4 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <StatusIcon status={task.status ?? "todo"} /><span className="text-sm text-muted-foreground">{task.identifier}</span><span className="flex-1 text-sm">{task.title}</span><span className="text-sm text-muted-foreground">{t("coordinatorTasks.pendingCount", { count: items.filter((item) => item.relatedIssue?.id === task.id || item.subject.id === task.id).length })}</span><ArrowUpRight className="size-4 text-muted-foreground" />
    </button>)}</div>
  </section>;
}
