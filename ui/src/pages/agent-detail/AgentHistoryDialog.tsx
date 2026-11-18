import { t } from "@/i18n";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentConfigRevision, AgentDetail as AgentDetailRecord } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { accessApi } from "@/api/access";
import { AgentChip, agentTableHeadClass, agentTableRowClass } from "@/components/agent-detail/AgentPanels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate } from "@/lib/utils";
import { syncAgentRouteAfterRename } from "./agent-route";

const KEY_LABELS: Record<string, string> = {
  name: t("agentHistoryDialog.fieldName"),
  title: t("agentHistoryDialog.fieldTitle"),
  role: t("agentHistoryDialog.fieldRole"),
  reportsTo: t("agentHistoryDialog.fieldReportsTo"),
  capabilities: t("agentHistoryDialog.fieldCapabilities"),
  adapterType: t("agentHistoryDialog.fieldAdapterType"),
  adapterConfig: t("agentHistoryDialog.fieldAdapterConfig"),
  runtimeConfig: t("agentHistoryDialog.fieldRuntimeConfig"),
  budgetMonthlyCents: t("agentHistoryDialog.fieldBudgetMonthlyCents"),
  permissions: t("agentHistoryDialog.fieldPermissions"),
  metadata: t("agentHistoryDialog.fieldMetadata"),
};

export function revisionSummary(revision: Pick<AgentConfigRevision, "changedKeys" | "rolledBackFromRevisionId">): string {
  if (revision.rolledBackFromRevisionId) return t("agentHistoryDialog.restoredAnEarlierVersion");
  if (revision.changedKeys.length === 0) return t("agentHistoryDialog.savedWithNoTrackedChanges");
  const labels = revision.changedKeys.map((key) => KEY_LABELS[key] ?? key);
  const sentence = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")}${t("agentHistoryDialog.and")}${labels[labels.length - 1]}`;
  return t("agentHistoryDialog.changed", { sentence });
}

function useRevisionAuthor(agent: AgentDetailRecord, companyId: string | undefined) {
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId ?? agent.companyId),
    queryFn: () => agentsApi.list(companyId ?? agent.companyId),
  });
  const { data: directory } = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(agent.companyId),
    queryFn: () => accessApi.listUserDirectory(agent.companyId),
  });
  return (revision: AgentConfigRevision) => {
    if (revision.createdByAgentId) {
      return agents?.find((candidate) => candidate.id === revision.createdByAgentId)?.name ?? t("auditTab.anAgent");
    }
    if (revision.createdByUserId && revision.createdByUserId !== "local-board") {
      const entry = directory?.users.find((candidate) => candidate.principalId === revision.createdByUserId);
      return entry?.user?.name?.trim() || entry?.user?.email || t("agentHistoryDialog.formerMember");
    }
    return t("common.board");
  };
}

export function AgentHistoryDialog({
  agent,
  companyId,
  open,
  onOpenChange,
}: {
  agent: AgentDetailRecord;
  companyId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState<AgentConfigRevision | null>(null);
  const authorOf = useRevisionAuthor(agent, companyId);
  const { data: revisions, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.configRevisions(agent.id),
    queryFn: () => agentsApi.listConfigRevisions(agent.id, companyId),
    enabled: open,
  });
  const rollback = useMutation({
    mutationFn: (revisionId: string) => agentsApi.rollbackConfigRevision(agent.id, revisionId, companyId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.configRevisions(agent.id) });
      setPending(null);
      if (!syncAgentRouteAfterRename(queryClient, navigate, agent, updated, "overview")) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.urlKey) });
      }
    },
  });
  const restoreError = rollback.error
    ? rollback.error instanceof Error && rollback.error.message
      ? rollback.error.message
      : t("agentHistoryDialog.couldNotRestoreThatVersion")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-(--agent-detail-dialog-max-h) flex-col gap-5 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">{t("agentHistoryDialog.agentHistory")}</DialogTitle>
          <DialogDescription>{t("agentHistoryDialog.everySavedChangeTo", { name: agent.name })}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : t("agentHistoryDialog.couldNotLoadAgentHistory")}</p>
        ) : isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{t("agentHistoryDialog.loadingAgentHistory")}</p>
        ) : (revisions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("agentHistoryDialog.noSavedChangesYet")}</p>
        ) : (
          <div className="min-h-0 overflow-y-auto rounded-lg border border-border">
            <div className={`${agentTableHeadClass} grid-cols-(--agent-detail-history-cols)`}>
              <span>{t("common.configuration")}</span>
              <span>{t("agentHistoryDialog.teamMember")}</span>
              <span>{t("agentHistoryDialog.dateConfigured")}</span>
              <span aria-hidden />
            </div>
            {(revisions ?? []).map((revision) => (
              <div key={revision.id} className={`${agentTableRowClass} grid-cols-(--agent-detail-history-cols)`}>
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">{revisionSummary(revision)}</span>
                  {revision.changedKeys.length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {revision.changedKeys.map((key) => (
                        <AgentChip key={key} mono>
                          {key}
                        </AgentChip>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-sm text-foreground">{authorOf(revision)}</span>
                <span className="truncate text-sm tabular-nums text-muted-foreground">{formatDate(revision.createdAt)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-2.5 justify-self-end"
                  onClick={() => {
                    rollback.reset();
                    setPending(revision);
                  }}
                  disabled={rollback.isPending}
                >
                  <RotateCcw />
                  {t("agentDetail.restore")}
                </Button>
              </div>
            ))}
          </div>
        )}
        {restoreError && pending === null ? (
          <p role="alert" className="text-sm text-destructive">{restoreError}</p>
        ) : null}
      </DialogContent>
      <AlertDialog open={pending !== null} onOpenChange={(next) => (next ? undefined : setPending(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("agentHistoryDialog.restoreThisVersion")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? t("agentHistoryDialog.continuingWillRestore", { name: agent.name, date: formatDate(pending.createdAt) })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending ? (
            <div className="flex flex-col gap-2 rounded-lg bg-(--agent-detail-tile) p-4">
              <span className="text-xs text-muted-foreground">
                {t("agentHistoryDialog.dateBy", { date: formatDate(pending.createdAt), author: authorOf(pending) })}
              </span>
              <span className="text-sm text-foreground">{revisionSummary(pending)}</span>
              {pending.changedKeys.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {pending.changedKeys.map((key) => (
                    <AgentChip key={key} mono>
                      {key}
                    </AgentChip>
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}
          {restoreError ? (
            <p role="alert" className="text-sm text-destructive">{restoreError}</p>
          ) : null}
          <AlertDialogFooter className="sm:justify-between">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={rollback.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (pending) rollback.mutate(pending.id);
              }}
            >
              <RotateCcw />
              {rollback.isPending ? t("routineHistory.restoring") : t("agentHistoryDialog.restoreVersion")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
