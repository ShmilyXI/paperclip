import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { t } from "@/i18n";
import type { ToolConnectionStoredContent } from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { describeError } from "@/api/errors";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { relativeTime } from "@/lib/utils";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";

function plural(key: string, count: number): string {
  return t(`storedContentDeletion.${key}`, { count });
}

export function storedContentSummary(content: ToolConnectionStoredContent, appName: string): string {
  const { toolCalls, approvals, appViews, runs } = content.stored;
  const parts = [
    toolCalls > 0 ? plural("toolCall", toolCalls) : null,
    approvals > 0 ? plural("approvalRequest", approvals) : null,
    appViews > 0 ? plural("appView", appViews) : null,
    runs > 0 ? t("storedContentDeletion.theFullTranscriptsOf", { runs: plural("run", runs) }) : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return t("storedContentDeletion.foundNoSavedData", { appName });
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(t("storedContentDeletion.listComma"))}${t("storedContentDeletion.listAnd")}${parts[parts.length - 1]}` : parts[0];
  return `${t("storedContentDeletion.willDeleteWhatItSaved", { list, appName })}${runs > 0 ? t("storedContentDeletion.orReceivedItsResults") : ""}.`;
}

export function storedContentStatus(content: ToolConnectionStoredContent): string | null {
  const deletion = content.deletion;
  if (deletion?.status === "pending") {
    return deletion.retrying
      ? t("storedContentDeletion.deletingWasInterrupted")
      : t("storedContentDeletion.deletingNow");
  }
  if (deletion?.status === "completed" && deletion.completedAt) {
    const skipped = deletion.counts.runsInProgress;
    return skipped > 0
      ? t("storedContentDeletion.lastDeletedWithSkipped", { time: relativeTime(deletion.completedAt), runs: plural("runWas", skipped) })
      : t("storedContentDeletion.lastDeleted", { time: relativeTime(deletion.completedAt) });
  }
  return null;
}

export function StoredContentDeletionRow({ connectionId, appName }: { connectionId: string; appName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="text-sm font-medium text-foreground">{t("storedContentDeletion.deleteDataReadThroughThisApp")}</p>
        <p className="text-xs text-muted-foreground">
          {t("storedContentDeletion.permanentlyRemovesTheResults")}
        </p>
      </div>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {t("storedContentDeletion.deleteData")}
      </Button>
      {open ? (
        <StoredContentDeletionDialog connectionId={connectionId} appName={appName} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

export function StoredContentDeletionDialog({
  connectionId,
  appName,
  onClose,
}: {
  connectionId: string;
  appName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const countsKey = queryKeys.tools.connectionStoredContent(connectionId);
  const statusKey = queryKeys.tools.connectionStoredContentDeletion(connectionId);
  const query = useQuery({
    queryKey: countsKey,
    queryFn: () => toolsApi.getStoredContent(connectionId),
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  const [tracking, setTracking] = useState(false);
  const watching = tracking || query.data?.deletion?.status === "pending";
  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: () => toolsApi.getStoredContentDeletion(connectionId),
    enabled: watching,
    refetchInterval: (current) => current.state.data?.deletion?.status === "completed" ? false : 2_000,
  });
  const latest = statusQuery.data?.deletion ?? query.data?.deletion ?? null;
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!watching || latest?.status !== "completed" || refreshedFor.current === latest.id) return;
    refreshedFor.current = latest.id;
    setTracking(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.tools.connectionStoredContent(connectionId) });
  }, [watching, latest?.status, latest?.id, queryClient, connectionId]);
  const deletion = useMutation({
    mutationFn: () => toolsApi.deleteStoredContent(connectionId),
    onSuccess: (result) => {
      queryClient.setQueryData(statusKey, result);
      setTracking(true);
    },
    onError: (error) => pushToast({ title: t("storedContentDeletion.couldntDeleteTheData"), body: describeError(error).body, tone: "error" }),
  });
  const content = query.data ? { ...query.data, deletion: latest } : undefined;
  const pending = deletion.isPending || latest?.status === "pending";
  const inProgress = content?.stored.runsInProgress ?? 0;
  const status = content ? storedContentStatus(content) : null;

  return (
    <AlertDialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <AlertDialogContent className={ANALYTICS_MASK_CLASS}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("storedContentDeletion.deleteDataReadThroughAppQuestion", { appName })}</AlertDialogTitle>
          <AlertDialogDescription>
            {content ? storedContentSummary(content, appName) : t("storedContentDeletion.countingSavedData")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {query.error ? (
          <p role="alert" className="text-sm text-destructive">{describeError(query.error).body}</p>
        ) : null}
        {content ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t("storedContentDeletion.wholeTranscriptsAreDeleted")}</p>
            <p className="font-medium text-foreground">{t("storedContentDeletion.thisDoesNotRemoveAnything")}</p>
            {inProgress > 0 ? (
              <p>{t("storedContentDeletion.stillWorkingAndWillBeSkipped", { runs: plural("runIs", inProgress), finish: inProgress === 1 ? t("storedContentDeletion.itFinishes") : t("storedContentDeletion.theyFinish") })}</p>
            ) : null}
            <p className="font-medium text-foreground">{t("storedContentDeletion.thisCannotBeUndone")}</p>
          </div>
        ) : null}
        {status ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {content?.deletion?.status === "pending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {status}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>{pending ? t("common.close") : t("common.cancel")}</AlertDialogCancel>
          {content ? (
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={pending || !content || query.isFetching}
              onClick={(event) => {
                event.preventDefault();
                deletion.mutate();
              }}
            >
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t("storedContentDeletion.deleteData")}
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
