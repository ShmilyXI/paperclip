import { t } from "@/i18n";
import { useQueryView } from "@/components/QueryView";
import { useMemo, useState } from "react";
import { useCoordinatorChatTaskHandoffs } from "./CoordinatorChatTaskHandoffs";
import { CoordinatorCreatedTaskLink } from "./CoordinatorTaskCommitment";
import { ToolbarSearch } from "@/components/ToolbarSearch";
import { NativeSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

/** The task list is source-conversation scoped, independent of reassignment. */
export function CoordinatorConversationTasksPanel({ conversationIssueId }: { conversationIssueId: string }) {
  const tasks = useCoordinatorChatTaskHandoffs(conversationIssueId);
  const tasksView = useQueryView(tasks);
  const waiting = ["loading", "reconnecting"].includes(tasksView.kind);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return tasks.handoffs.filter(task => (!status || task.status === status) && (!needle || `${task.identifier ?? ""} ${task.title}`.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : (sort === "oldest" ? 1 : -1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  }, [tasks.handoffs, query, status, sort]);
  return <section className="space-y-4" aria-label={t("coordinatorConversationTasksPanel.tasksFromThisConversation")}>
    <div className="space-y-1"><h2 className="text-lg font-medium">{t("common.tasks")}</h2><p className="text-sm text-muted-foreground">{t("coordinatorConversationTasksPanel.createdFromThisConversation")}</p></div>
    <ToolbarSearch query={query} onQueryChange={setQuery} label={t("coordinatorConversationTasksPanel.searchConversationTasks")} placeholder={t("coordinatorConversationTasksPanel.searchTasksOrIds")} />
    <div className="flex flex-wrap gap-2">
      <NativeSelect value={status} onChange={event => setStatus(event.target.value)} aria-label={t("coordinatorConversationTasksPanel.filterConversationTasksByStatus")} className="w-auto"><option value="">{t("cases.allStatuses")}</option><option value="todo">{t("coordinatorConversationTasksPanel.readyToStart")}</option><option value="in_progress">{t("labels.status.in_progress")}</option><option value="in_review">{t("coordinatorConversationTasksPanel.needsReview")}</option><option value="blocked">{t("labels.status.blocked")}</option><option value="done">{t("labels.status.done")}</option><option value="cancelled">{t("labels.status.cancelled")}</option></NativeSelect>
      <NativeSelect value={sort} onChange={event => setSort(event.target.value)} aria-label={t("coordinatorConversationTasksPanel.sortConversationTasks")} className="w-auto"><option value="newest">{t("decisionHistory.newestFirst")}</option><option value="oldest">{t("decisionHistory.oldestFirst")}</option><option value="title">{t("common.title")}</option></NativeSelect>
    </div>
    {waiting && <p role="status" className="text-sm text-muted-foreground">{t("agentWorkPanels.loadingTasks")}</p>}
    {(tasksView.kind === "error") && <div role="alert" className="space-y-2"><p className="text-sm">{t("coordinatorConversationTasksPanel.tasksCouldntLoad")}</p><Button variant="outline" onClick={() => void tasks.refetch()}>{t("common.retry")}</Button></div>}
    <div className="space-y-3">{visible.map(task => <div key={task.id} className="overflow-hidden rounded-xl border border-border bg-card"><CoordinatorCreatedTaskLink task={task} /></div>)}</div>
    {!waiting && !(tasksView.kind === "error") && !visible.length && <p className="py-4 text-sm text-muted-foreground">{query || status ? t("coordinatorConversationTasksPanel.noLoadedTasksMatchTheseFilters") : t("coordinatorConversationTasksPanel.tasksCreatedFromThisConversationWillAppearHere")}</p>}
    {tasks.hasNextPage && <Button variant="outline" disabled={tasks.isFetchingNextPage} onClick={() => void tasks.fetchNextPage()}>{tasks.isFetchingNextPage ? t("common.loading2") : t("designSandboxTasks.loadMoreTasks")}</Button>}
  </section>;
}
