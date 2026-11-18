import { t } from "@/i18n";
import { describeError } from "../api/errors";
import type { IssueRelationIssueSummary, TaskInterruptionPresentation } from "@paperclipai/shared";
import { AlertCircle } from "lucide-react";
import { Link } from "@/lib/router";
import { createIssueDetailPath } from "../lib/issueDetailBreadcrumb";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useSecondTick } from "../hooks/useSecondTick";
import { TaskProjectAccessNotice } from "./TaskProjectAccessNotice";
import { ProviderFailureNotice } from "./ProviderFailureNotice";
import { LockedIssueChip, isLockedIssueStub } from "./LockedIssueChip";
import { PreviousServerStopConfirmation } from "./WorkspaceExportRecovery";
import { issuesApi } from "../api/issues";

const recoveryStepText: Record<NonNullable<TaskInterruptionPresentation["recoveryStep"]>, string> = {
  checking_previous_run: t("executionBlockerNotice.checkingPreviousRun"),
  saving_previous_files: t("executionBlockerNotice.savingPreviousFiles"),
  finishing_recovery: t("executionBlockerNotice.finishingRecovery"),
};

/** A budget hard stop holds saved work. Only a task that already ran has an
 * attempt to report; a task refused before its first run just waits. */
function budgetWaitText(presentation: TaskInterruptionPresentation) {
  const wait = t("executionBlockerNotice.budgetWait");
  return presentation.observedRunId || presentation.sourceRunIds.length
    ? `${t("executionBlockerNotice.couldnTFinishThisAttempt")} ${wait}`
    : `${t("executionBlockerNotice.thisTaskHasNotStarted")} ${wait}`;
}
const isBudgetWait = (presentation: TaskInterruptionPresentation | null | undefined) =>
  presentation?.state === "waiting_for_user" && presentation.userAction === "budget";

const blockerAction: Record<string, string> = {
  blocked: t("executionBlockerNotice.blockedOpenItToRetry"),
  cancelled: t("executionBlockerNotice.cancelledRemoveOrReplace"),
  done: t("executionBlockerNotice.savingItsFiles"),
};

/** One ordinary interruption surface. Technical records remain in diagnostics. */
export function ExecutionBlockerNotice({ presentation, canRetry, onRetry, optimistic, takingLonger, error, className, issueId, companyId, agentName, projectName, blockers }: {
  presentation: TaskInterruptionPresentation | null | undefined;
  companyId?: string;
  blockers?: IssueRelationIssueSummary[];
  canRetry: boolean;
  onRetry: () => void;
  optimistic?: boolean;
  takingLonger?: boolean;
  error?: Error | null;
  className?: string;
  issueId?: string;
  agentName?: string;
  projectName?: string;
}) {
  useSecondTick(presentation?.state === "retry_scheduled");
  if (presentation?.projectAccess && !optimistic && !takingLonger) return <TaskProjectAccessNotice
    access={presentation.projectAccess} issueId={issueId} agentName={agentName} projectName={projectName}
    canRetry={canRetry && presentation.canRetry} onRetry={onRetry} error={error} className={className} />;
  if (error && !optimistic && !takingLonger) return <div role="alert" className={cn("flex items-center justify-between gap-2 text-sm text-destructive", className)}><span>{describeError(error).body}</span>{canRetry && <Button variant="outline" size="sm" onClick={onRetry} data-testid="task-execution-retry">{t("common.retry")}</Button>}</div>;
  if (takingLonger) return <div role="status" className={cn("flex items-center justify-between gap-2 text-sm text-muted-foreground", className)}><span>{t("executionBlockerNotice.takingLongerThanUsual")}</span>{canRetry && <Button variant="outline" size="sm" onClick={onRetry} data-testid="task-execution-retry">{t("common.retry")}</Button>}</div>;
  const step = !optimistic && presentation?.responsibility === "system" && presentation.recoveryStep
    && ["working", "retry_scheduled"].includes(presentation.state) ? recoveryStepText[presentation.recoveryStep] : null;
  const seconds = Math.max(0, Math.ceil((Date.parse(presentation?.nextRetryAt ?? "") - Date.now()) / 1000));
  const retryIn = t("executionBlockerNotice.tryingAgainIn", { time: seconds > 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s` });
  if (!optimistic && !presentation?.retryWait && presentation?.providerFailure && ["failed", "retry_scheduled", "waiting_for_user"].includes(presentation.state)) {
    // Saved-work recovery is what the task waits for, so name it over the
    // generic automatic-retry line while keeping the provider explanation.
    return <ProviderFailureNotice failure={presentation.providerFailure} className={className}
      actions={canRetry && presentation.canRetry ? <Button variant="outline" size="sm" onClick={onRetry} data-testid="task-execution-retry">{t("common.retry")}</Button> : undefined}>
      {presentation.state === "retry_scheduled" && <p>{step ? `${step}. ${retryIn}` : t("issueScheduledRetryCard.paperclipWillRetry")}</p>}
      {isBudgetWait(presentation) && <p data-testid="task-execution-waiting">{t("executionBlockerNotice.budgetWait")}</p>}
    </ProviderFailureNotice>;
  }
  if (step && presentation?.state === "working") return <div role="status" aria-label={t("executionBlockerNotice.taskStatus")}
    className={cn("text-sm text-muted-foreground", className)}>{`${step}…`}</div>;
  if (!optimistic && presentation?.state === "working" && presentation.retryAction === "move_forward" && presentation.canRetry)
    return <div role="status" aria-label={t("executionBlockerNotice.taskStatus")} className={cn("flex items-center justify-between gap-3 text-sm text-muted-foreground", className)}>
      <span className="min-w-0 flex-1">{t("executionBlockerNotice.waitingForAgentToFinish")}</span>
      {canRetry && <Button variant="outline" size="sm" className="shrink-0" onClick={onRetry} data-testid="task-execution-move-forward">{t("executionBlockerNotice.moveItForwardNow")}</Button>}
    </div>;
  // A task that has not started yet names the admission hold it waits for.
  if (!optimistic && presentation?.state === "working" && presentation.retryWait) {
    const dependencies = presentation.retryWait.reason === "dependency_blocked" ? blockers ?? [] : [];
    const unfinished = dependencies.filter(blocker => isLockedIssueStub(blocker) || blocker.status !== "done");
    const waitingOn = unfinished.length ? unfinished : dependencies;
    return <div role="status" aria-label={t("executionBlockerNotice.taskStatus")} className={cn("text-sm text-muted-foreground", className)}>
      <p>{presentation.retryWait.message}</p>
      {waitingOn.length ? <ul className="mt-1 space-y-0.5" data-testid="retry-waiting-on">
        {waitingOn.map(blocker => isLockedIssueStub(blocker)
          ? <li key={blocker.id} className="flex min-w-0 items-center gap-2"><LockedIssueChip identifier={blocker.identifier} /></li>
          : <li key={blocker.id} className="flex min-w-0 items-center gap-2">
          <Link to={createIssueDetailPath(blocker.identifier ?? blocker.id)}
            className="font-mono text-xs text-foreground underline-offset-2 hover:underline">
            {blocker.identifier ?? t("executionBlockerNotice.task")}
          </Link>
          <span className="min-w-0 truncate">{blocker.title}</span>
          <span className="shrink-0 text-xs">{blockerAction[blocker.status] ?? blocker.status.replace(/_/g, " ")}</span>
        </li>)}
      </ul> : null}
    </div>;
  }
  if (!optimistic && presentation?.userAction === "confirm_run_stopped" && presentation.observedRunId && issueId && companyId) {
    const runId = presentation.observedRunId;
    return <PreviousServerStopConfirmation key={`${issueId}:${runId}`} runId={runId} formId={runId} issueId={issueId} companyId={companyId}
      className={className} confirmStop={stopEvidence => issuesApi.confirmRunStopped(issueId, { runId, stopEvidence })}
      copy={{ waiting: presentation.retryWait?.message ?? t("executionBlockerNotice.cannotConfirmPreviousRunStopped"),
        question: t("executionBlockerNotice.howDidYouConfirm"),
        placeholder: t("executionBlockerNotice.confirmPlaceholder"),
        resuming: t("executionBlockerNotice.startingYourRetry"), confirm: t("executionBlockerNotice.confirmItStopped") }} />;
  }
  // Other person-owned decisions have their own card on the task (approval,
  // project access, ...). A budget hold has none, so name it here and keep the
  // failure visible. The saved attempt starts by itself once the budget allows.
  if (!optimistic && presentation && isBudgetWait(presentation)) return (
    <div className={cn("pt-4", className)}>
      <div role="status" aria-label={t("executionBlockerNotice.taskStatus")} data-testid="task-execution-waiting"
        className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-foreground">
        <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
        <span className="min-w-0 flex-1">{budgetWaitText(presentation)}</span>
      </div>
    </div>
  );
  if (optimistic || !presentation || presentation.responsibility !== "system" ||
      !["failed", "retry_scheduled"].includes(presentation.state)) return null;
  return (
    <div className={cn(presentation.state === "failed" && "pt-4", className)}>
      <div role="status" aria-label={t("executionBlockerNotice.taskStatus")} className={cn(
        "flex items-center justify-between gap-3 text-sm",
        presentation.state === "failed" ? "rounded-lg bg-destructive/10 p-4 text-foreground" : "text-muted-foreground",
      )}>
        {presentation.state === "failed" && <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />}
        <span className="min-w-0 flex-1">{presentation.state === "retry_scheduled"
          ? step ? `${step}. ${retryIn}`
            : presentation.setupFailure ? `${presentation.setupFailure.message}. ${retryIn}` : retryIn
          : presentation.retryWait ? presentation.retryWait.message
          : presentation.workspaceFailure
            ? <>{t("executionBlockerNotice.couldntPrepareTaskFolders")} {presentation.workspaceFailure.message}</>
          : presentation.setupFailure
            ? <>{t("executionBlockerNotice.couldntSetUpTaskWorkspace")} {presentation.setupFailure.message}. {t("executionBlockerNotice.fixTheCommandThenRetry")}</>
            : t("executionBlockerNotice.couldnTFinishThisAttempt")}</span>
        {canRetry && presentation.canRetry && <Button variant="outline" size="sm" className="shrink-0" onClick={onRetry} data-testid="task-execution-retry">{t("common.retry")}</Button>}
      </div>
    </div>
  );
}
