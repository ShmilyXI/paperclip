import { t } from "@/i18n";
import { actionFallbackLabel, statusLabel } from "./i18n-labels";
import type { Agent } from "@paperclipai/shared";
import type { CompanyUserProfile } from "./company-members";
import { formatReviewPolicyValue } from "./review-policy";

type ActivityDetails = Record<string, unknown> | null | undefined;

type ActivityParticipant = {
  type: "agent" | "user";
  agentId?: string | null;
  userId?: string | null;
};

type ActivityIssueReference = {
  id?: string | null;
  identifier?: string | null;
  title?: string | null;
};

interface ActivityFormatOptions {
  agentMap?: Map<string, Agent>;
  userProfileMap?: Map<string, CompanyUserProfile>;
  currentUserId?: string | null;
}

const ACTIVITY_ROW_VERBS: Record<string, string> = {
  "case.created": t("activity.created"),
  "case.updated": t("activity.updated"),
  "case.fields_changed": t("activity.updatedDetailsOn"),
  "case.status_changed": t("activity.changedStatusOn"),
  "case.issue_linked": t("activity.linkedATaskTo"),
  "case.issue_unlinked": t("activity.unlinkedATaskFrom"),
  "case.child_linked": t("activity.linkedAChildTo"),
  "case.attachment_added": t("activity.attachedAFileTo"),
  "case.label_added": t("activity.addedALabelTo"),
  "case.label_removed": t("activity.removedALabelFrom"),
  "case.document_revised": t("activity.updatedADocumentOn"),
  "case.handoff_requested": t("activity.requestedAHandoffFor"),
  "case.handoff_applied": t("activity.handedOff"),
  "case.handoff_delivered": t("activity.deliveredAHandoffFor"),
  "case.handoff_retry_requested": t("activity.retriedAHandoffFor"),
  "case.handoff_cancelled": t("activity.cancelledAHandoffFor"),
  "case.handoff_completed": t("activity.completed"),
  "issue.created": t("activity.created"),
  "issue.updated": t("activity.updated"),
  "issue.read_marked": t("activity.read"),
  "issue.read_unmarked": t("activity.markedUnread"),
  "issue.checked_out": t("activity.checkedOut"),
  "issue.released": t("activity.released"),
  "issue.comment_added": t("activity.commentedOn"),
  "issue.comment_cancelled": t("activity.cancelledAQueuedCommentOn"),
  "issue.queued_comment_edited": t("activity.editedAQueuedCommentOn"),
  "issue.queued_comments_reordered": t("activity.reorderedQueuedCommentsOn"),
  "issue.queued_comment_discarded": t("activity.discardedAQueuedCommentOn"),
  "issue.comment_deleted": t("activity.deletedACommentOn"),
  "issue.attachment_added": t("activity.attachedFileTo"),
  "issue.attachment_removed": t("activity.removedAttachmentFrom"),
  "issue.document_created": t("activity.createdDocumentFor"),
  "issue.document_updated": t("activity.updatedDocumentOn"),
  "issue.document_locked": t("activity.lockedDocumentOn"),
  "issue.document_unlocked": t("activity.unlockedDocumentOn"),
  "issue.document_deleted": t("activity.deletedDocumentFrom"),
  "issue.monitor_scheduled": t("activity.scheduledMonitorOn"),
  "issue.monitor_triggered": t("activity.triggeredMonitorFor"),
  "issue.monitor_cleared": t("activity.clearedMonitorOn"),
  "issue.monitor_skipped": t("activity.skippedMonitorFor"),
  "issue.monitor_exhausted": t("activity.exhaustedMonitorOn"),
  "issue.monitor_recovery_wake_queued": t("activity.queuedMonitorRecoveryFor"),
  "issue.monitor_recovery_issue_created": t("activity.createdMonitorRecoveryFor"),
  "issue.monitor_escalated_to_board": t("activity.escalatedMonitorFor"),
  "issue.commented": t("activity.commentedOn"),
  "issue.deleted": t("activity.deleted"),
  "issue.successful_run_handoff_required": t("activity.flaggedMissingNextStepOn"),
  "issue.successful_run_handoff_resolved": t("activity.recordedNextStepChosenOn"),
  "issue.successful_run_handoff_escalated": t("activity.escalatedMissingNextStepOn"),
  "issue.accepted_plan_decomposition_updated": "updated accepted-plan decomposition on",
  "issue.recovery_action_opened": t("activity.openedARecoveryActionOn"),
  "issue.workspace_recovered": t("activity.recoveredSavedWorkFor"),
  "issue.workspace_recovery_requested": t("activity.requestedWorkspaceRecoveryFor"),
  "issue.recovery_action_resolved": t("activity.resolvedTheRecoveryActionOn"),
  "issue.recovery_action_escalated": t("activity.escalatedTheRecoveryActionOn"),
  "agent.created": t("activity.created"),
  "agent.updated": t("activity.updated"),
  "agent.paused": t("activity.paused"),
  "agent.resumed": t("activity.resumed"),
  "agent.error_cleared": t("activity.clearedErrorOn"),
  "agent.terminated": t("activity.terminated"),
  "agent.key_created": t("activity.createdApiKeyFor"),
  "agent.budget_updated": t("activity.updatedBudgetFor"),
  "agent.runtime_session_reset": t("activity.resetSessionFor"),
  "heartbeat.invoked": t("activity.invokedHeartbeatFor"),
  "heartbeat.cancelled": t("activity.cancelledHeartbeatFor"),
  "heartbeat.output_stale_source_resolved": "system-folded stale run on",
  "heartbeat.output_stale_recovery_recursion_refused": "refused recovery-on-recovery for",
  "approval.created": t("activity.requestedApproval"),
  "approval.approved": t("activity.approved"),
  "approval.rejected": t("activity.rejected"),
  // Interaction outcomes (PAP-16506). An agent may now resolve one — including a
  // review of its own work — so these must read as outcomes in the feed instead
  // of falling through to the raw "issue thread interaction accepted" action id.
  // `details.interactionKind` sharpens the wording; see INTERACTION_OUTCOME_LABELS.
  "issue.thread_interaction_created": t("activity.askedForADecisionOn"),
  "issue.thread_interaction_accepted": t("activity.acceptedTheRequestOn"),
  "issue.thread_interaction_rejected": t("activity.rejectedTheRequestOn"),
  "issue.thread_interaction_answered": t("activity.answeredTheRequestOn"),
  "issue.thread_interaction_withdrawn": t("activity.withdrewTheRequestOn"),
  "issue.thread_interaction_cancelled": t("activity.cancelledTheRequestOn"),
  "issue.thread_interaction_skipped": t("activity.skippedTheRequestOn"),
  "issue.thread_interaction_expired": t("activity.expiredTheRequestOn"),
  "issue.thread_interaction_item_verdicts_submitted": t("activity.submittedVerdictsOn"),
  "issue.stalled_review_decided": t("activity.recordedAReviewVerdictOn"),
  "project.created": t("activity.created"),
  "project.updated": t("activity.updated"),
  "project.deleted": t("activity.deleted"),
  "goal.created": t("activity.created"),
  "goal.updated": t("activity.updated"),
  "goal.deleted": t("activity.deleted"),
  "cost.reported": t("activity.reportedCostFor"),
  "cost.recorded": t("activity.recordedCostFor"),
  "company.created": t("activity.createdOrganization"),
  "company.updated": t("activity.updatedOrganization"),
  "company.archived": t("activity.archived"),
  "company.reactivated": t("activity.reactivated"),
  "company.budget_updated": t("activity.updatedBudgetFor"),
  "audit.exported": t("activity.exportedTheAgentAuditLog"),
  "tool_app.connected": t("activity.connected"),
  "tool_app.oauth_connected": t("activity.connectedCredentialsFor"),
  "tool_app.oauth_failed": t("activity.failedToConnectCredentialsFor"),
  "tool_app.oauth_access_finalized": t("activity.finishedCredentialAccessFor"),
  "tool_app.finished": t("activity.finishedSetupFor"),
  "tool_app.reconnected": t("activity.reconnected"),
  "tool_connection.created": t("activity.created"),
  "tool_connection.updated": t("activity.updated"),
  "tool_connection.archived": t("activity.removed"),
  "tool_connection.catalog_refresh": t("activity.refreshedActionsFor"),
  "tool_connection.installs_synced": t("activity.changedAgentInstallsFor"),
  "tool_connection.install_access_extended": t("activity.extendedAgentAccessFor"),
  "tool_connection.grant_audience_replaced": t("activity.changedHumanAccessFor"),
  "tool_connection.grant_added": t("activity.addedCredentialsTo"),
  "tool_connection.grant_revoked": t("activity.revokedCredentialsFrom"),
  "tool_connection.grant_delegated": t("activity.delegatedCredentialsFor"),
  "tool_connection.grant_delegation_revoked": t("activity.revokedCredentialDelegationFor"),
};

const ISSUE_ACTIVITY_LABELS: Record<string, string> = {
  "issue.created": t("activity.createdTheIssue"),
  "issue.updated": t("activity.updatedTheIssue"),
  "issue.checked_out": t("activity.checkedOutTheIssue"),
  "issue.released": t("activity.releasedTheIssue"),
  "issue.comment_added": t("activity.addedAComment"),
  "issue.comment_cancelled": t("activity.cancelledAQueuedComment"),
  "issue.queued_comment_edited": t("activity.editedAQueuedComment"),
  "issue.queued_comments_reordered": t("activity.reorderedQueuedComments"),
  "issue.queued_comment_discarded": t("activity.discardedAQueuedComment"),
  "issue.comment_deleted": t("activity.deletedAComment"),
  "issue.feedback_vote_saved": t("activity.savedFeedbackOnAnAi"),
  "issue.attachment_added": t("activity.addedAnAttachment"),
  "issue.attachment_removed": t("activity.removedAnAttachment"),
  "issue.document_created": t("activity.createdADocument"),
  "issue.document_updated": t("activity.updatedADocument"),
  "issue.document_locked": t("activity.lockedADocument"),
  "issue.document_unlocked": t("activity.unlockedADocument"),
  "issue.document_deleted": t("activity.deletedADocument"),
  "issue.monitor_scheduled": t("activity.scheduledAMonitor"),
  "issue.monitor_triggered": t("activity.triggeredAMonitor"),
  "issue.monitor_cleared": t("activity.clearedAMonitor"),
  "issue.monitor_skipped": t("activity.skippedAMonitor"),
  "issue.monitor_exhausted": t("activity.exhaustedAMonitor"),
  "issue.monitor_recovery_wake_queued": t("activity.queuedAMonitorRecoveryWake"),
  "issue.monitor_recovery_issue_created": t("activity.createdAMonitorRecoveryIssue"),
  "issue.monitor_escalated_to_board": t("activity.escalatedAMonitorToThe"),
  "issue.deleted": t("activity.deletedTheIssue"),
  "issue.successful_run_handoff_required": t("activity.runFinishedWithoutAClear"),
  "issue.successful_run_handoff_resolved": t("activity.nextStepChosen"),
  "issue.successful_run_handoff_escalated": t("activity.runFinishedWithoutANext"),
  "issue.cross_issue_influence_cap_rejected": t("activity.hitThePerRunCross"),
  "issue.cross_issue_influence_observed": t("activity.madeACrossTaskWrite"),
  "issue.attribution_spoof_rejected": t("activity.triedToChooseItsOwn"),
  "issue.recovery_action_opened": t("activity.openedASourceScopedRecovery"),
  "issue.workspace_recovered": t("activity.savedWorkRecovered"),
  "issue.workspace_recovery_requested": t("activity.requestedWorkspaceRecovery"),
  "issue.recovery_action_resolved": t("activity.resolvedTheRecoveryAction"),
  "issue.recovery_action_escalated": t("activity.escalatedTheRecoveryAction"),
  "issue.accepted_plan_decomposition_updated": t("activity.updatedTheAcceptedPlanDecomposition"),
  "agent.created": t("activity.createdAnAgent"),
  "agent.updated": t("activity.updatedTheAgent"),
  "agent.paused": t("activity.pausedTheAgent"),
  "agent.resumed": t("activity.resumedTheAgent"),
  "agent.error_cleared": t("activity.clearedTheAgentError"),
  "agent.terminated": t("activity.terminatedTheAgent"),
  "heartbeat.invoked": t("activity.invokedAHeartbeat"),
  "heartbeat.cancelled": t("activity.cancelledAHeartbeat"),
  "heartbeat.output_stale_source_resolved": t("activity.systemFoldedAStaleRun"),
  "heartbeat.output_stale_recovery_recursion_refused": t("activity.refusedRecoveryOnRecoveryEscalation"),
  "approval.created": t("activity.requestedApproval"),
  "approval.approved": t("activity.approved"),
  "approval.rejected": t("activity.rejected"),
  "issue.thread_interaction_created": t("activity.askedForADecision"),
  "issue.thread_interaction_accepted": t("activity.acceptedTheRequest"),
  "issue.thread_interaction_rejected": t("activity.rejectedTheRequest"),
  "issue.thread_interaction_answered": t("activity.answeredTheRequest"),
  "issue.thread_interaction_withdrawn": t("activity.withdrewTheRequest"),
  "issue.thread_interaction_cancelled": t("activity.cancelledTheRequest"),
  "issue.thread_interaction_skipped": t("activity.skippedTheRequest"),
  "issue.thread_interaction_expired": t("activity.expiredTheRequest"),
  "issue.thread_interaction_item_verdicts_submitted": t("activity.submittedVerdictsOnTheRequest"),
  "issue.stalled_review_decided": t("activity.recordedAReviewVerdict"),
};

/**
 * `issue.stalled_review_decided` carries the verb the actor chose, so the line
 * names the verdict ("approved the review") rather than the generic action.
 * Mirrors `StalledReviewDecisionAction` in shared.
 */
const STALLED_REVIEW_DECISION_LABELS: Record<string, string> = {
  approve: t("activity.approvedTheReview"),
  request_changes: t("activity.requestedChangesOnTheReview"),
  send_back: t("activity.sentTheReviewBackTo"),
};

/**
 * `issue.thread_interaction_accepted` / `_rejected` fire for *every* interaction
 * kind, not only for a review. A task suggestion or a question is accepted, not
 * approved, so the kind on the event picks the verb. Kinds absent from a map
 * keep the neutral "accepted the request" wording from the tables above, which
 * is also the fallback for an event that carries no kind.
 */
const INTERACTION_ACCEPTED_LABELS: Record<string, string> = {
  request_confirmation: t("activity.approvedTheRequest"),
  request_checkbox_confirmation: t("activity.approvedTheRequest"),
  suggest_tasks: t("activity.acceptedTheTaskSuggestions"),
  ask_user_questions: t("activity.acceptedTheAnswers"),
};

const INTERACTION_REJECTED_LABELS: Record<string, string> = {
  request_confirmation: t("activity.rejectedTheRequest"),
  request_checkbox_confirmation: t("activity.rejectedTheRequest"),
  suggest_tasks: t("activity.declinedTheTaskSuggestions"),
  ask_user_questions: t("activity.declinedTheQuestions"),
};

/**
 * Kind-aware wording for an interaction outcome, or `null` when the tables
 * above already say it well enough.
 */
function formatInteractionOutcomeLabel(action: string, details: ActivityDetails): string | null {
  const table = action === "issue.thread_interaction_accepted"
    ? INTERACTION_ACCEPTED_LABELS
    : action === "issue.thread_interaction_rejected"
      ? INTERACTION_REJECTED_LABELS
      : null;
  if (!table) return null;
  const kind = typeof details?.interactionKind === "string" ? details.interactionKind : null;
  return kind ? table[kind] ?? null : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? t("activity.none"));
  return statusLabel(value).toLowerCase();
}

function isActivityParticipant(value: unknown): value is ActivityParticipant {
  const record = asRecord(value);
  if (!record) return false;
  return record.type === "agent" || record.type === "user";
}

function isActivityIssueReference(value: unknown): value is ActivityIssueReference {
  return asRecord(value) !== null;
}

function readParticipants(details: ActivityDetails, key: string): ActivityParticipant[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityParticipant);
}

function readIssueReferences(details: ActivityDetails, key: string): ActivityIssueReference[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityIssueReference);
}

function formatUserLabel(userId: string | null | undefined, options: ActivityFormatOptions = {}): string {
  if (!userId || userId === "local-board") return t("activity.board");
  if (options.currentUserId && userId === options.currentUserId) return t("activity.you");
  const profile = options.userProfileMap?.get(userId);
  if (profile) return profile.label;
  return t("activity.user", { id: userId.slice(0, 5) });
}

function formatParticipantLabel(participant: ActivityParticipant, options: ActivityFormatOptions): string {
  if (participant.type === "agent") {
    const agentId = participant.agentId ?? "";
    return options.agentMap?.get(agentId)?.name ?? t("activity.agentFallback");
  }
  return formatUserLabel(participant.userId, options);
}

function formatIssueReferenceLabel(reference: ActivityIssueReference): string {
  if (reference.identifier) return reference.identifier;
  if (reference.title) return reference.title;
  if (reference.id) return reference.id.slice(0, 8);
  return t("activity.taskFallback");
}

function formatChangedEntityLabel(
  singular: string,
  plural: string,
  labels: string[],
): string {
  if (labels.length <= 0) return plural;
  if (labels.length === 1) return t("activity.entitySingle", { singular, label: labels[0] });
  return t("activity.entityMany", { count: labels.length, plural });
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function readStringArrayLength(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((entry) => typeof entry === "string" && entry.length > 0).length;
}

function formatAcceptedPlanDecompositionDetail(details: ActivityDetails): string | null {
  if (!details) return null;
  const status = typeof details.status === "string" ? details.status : null;
  const requested = readNumber(details.requestedChildCount);
  const totalChildren = readStringArrayLength(details.childIssueIds);
  const newlyCreated = readStringArrayLength(details.newlyCreatedChildIssueIds);
  const reused = Math.max(0, totalChildren - newlyCreated);
  const parts: string[] = [];
  if (newlyCreated > 0) parts.push(`created ${newlyCreated} new`);
  if (reused > 0) parts.push(`reused ${reused} existing`);
  if (parts.length === 0 && requested !== null) parts.push(`${requested} requested`);
  const summary = parts.length > 0 ? parts.join(", ") : null;
  if (status === "completed" && summary) return `decomposition completed (${summary})`;
  if (status === "completed") return "decomposition completed";
  if (status === "in_flight" && summary) return `decomposition in flight (${summary})`;
  return summary;
}

function formatIssueUpdatedVerb(details: ActivityDetails): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  if (details.status !== undefined) {
    const from = previous.status;
    const to = humanizeValue(details.status === "in_review" && details.externalConversationState === "waiting" ? "idle" : details.status);
    return from
      ? t("activity.changedStatusFromTo", { from: humanizeValue(from), to })
      : t("activity.changedStatusTo", { to });
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    return from
      ? t("activity.changedPriorityFromTo", { from: humanizeValue(from), to: humanizeValue(details.priority) })
      : t("activity.changedPriorityTo", { to: humanizeValue(details.priority) });
  }
  return null;
}

function formatAssigneeName(details: ActivityDetails, options: ActivityFormatOptions): string | null {
  if (!details) return null;
  const agentId = details.assigneeAgentId;
  const userId = details.assigneeUserId;
  if (typeof agentId === "string" && agentId) {
    return options.agentMap?.get(agentId)?.name ?? t("activity.agentFallback");
  }
  if (typeof userId === "string" && userId) {
    return formatUserLabel(userId, options);
  }
  return null;
}

function formatIssueUpdatedAction(details: ActivityDetails, options: ActivityFormatOptions = {}): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  const parts: string[] = [];

  if (details.status !== undefined) {
    const from = previous.status;
    const to = humanizeValue(details.status === "in_review" && details.externalConversationState === "waiting" ? "idle" : details.status);
    parts.push(
      from
        ? t("activity.changedTheStatusFromTo", { from: humanizeValue(from), to })
        : t("activity.changedTheStatusTo", { to }),
    );
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    parts.push(
      from
        ? t("activity.changedThePriorityFromTo", { from: humanizeValue(from), to: humanizeValue(details.priority) })
        : t("activity.changedThePriorityTo", { to: humanizeValue(details.priority) }),
    );
  }
  if (details.assigneeAgentId !== undefined || details.assigneeUserId !== undefined) {
    const assigneeName = formatAssigneeName(details, options);
    parts.push(assigneeName ? t("activity.madeResponsible", { name: assigneeName }) : t("activity.clearedResponsible"));
  }
  if (details.reviewPolicy !== undefined) {
    // `null` is the default ("anyone can approve"), so it must not read as
    // "changed the review policy to none" (PAP-16506).
    parts.push(t("activity.changedWhoCanApprove", { value: formatReviewPolicyValue(details.reviewPolicy) }));
  }
  if (details.title !== undefined) parts.push(t("activity.updatedTheTitle"));
  if (details.description !== undefined) parts.push(t("activity.updatedTheDescription"));

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatStructuredIssueChange(input: {
  action: string;
  details: ActivityDetails;
  options: ActivityFormatOptions;
  forIssueDetail: boolean;
}): string | null {
  const details = input.details;
  if (!details) return null;

  if (input.action === "issue.blockers_updated") {
    const added = readIssueReferences(details, "addedBlockedByIssues").map(formatIssueReferenceLabel);
    const removed = readIssueReferences(details, "removedBlockedByIssues").map(formatIssueReferenceLabel);
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel(t("activity.blocker"), t("activity.blockersPlain"), added);
      return input.forIssueDetail ? t("activity.addedEntity", { entity: changed }) : t("activity.addedEntityTo", { entity: changed });
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel(t("activity.blocker"), t("activity.blockersPlain"), removed);
      return input.forIssueDetail ? t("activity.removedEntity", { entity: changed }) : t("activity.removedEntityFrom", { entity: changed });
    }
    return input.forIssueDetail ? t("activity.updatedBlockers") : t("activity.updatedBlockersOn");
  }

  if (input.action === "issue.reviewers_updated" || input.action === "issue.approvers_updated") {
    const added = readParticipants(details, "addedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const removed = readParticipants(details, "removedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const singular = input.action === "issue.reviewers_updated" ? t("activity.reviewer") : t("activity.approver");
    const plural = input.action === "issue.reviewers_updated" ? t("activity.reviewers") : t("activity.approvers");
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, added);
      return input.forIssueDetail ? t("activity.addedEntity", { entity: changed }) : t("activity.addedEntityTo", { entity: changed });
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, removed);
      return input.forIssueDetail ? t("activity.removedEntity", { entity: changed }) : t("activity.removedEntityFrom", { entity: changed });
    }
    return input.forIssueDetail ? t("activity.updatedEntity", { entity: plural }) : t("activity.updatedEntityOn", { entity: plural });
  }

  return null;
}

export function formatActivityVerb(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action.startsWith("tool_gateway.")) {
    const rawTool = typeof details?.tool === "string"
      ? details.tool
      : typeof details?.upstreamToolName === "string"
        ? details.upstreamToolName
        : "an app action";
    const tool = rawTool.replace(/[._-]+/g, " ");
    const isTest = details?.source === "test";
    if (action === "tool_gateway.call_completed") return `${isTest ? "tested" : "used"} ${tool} on`;
    if (action === "tool_gateway.call_allowed") return `${isTest ? "started a test of" : "was allowed to use"} ${tool} on`;
    if (action === "tool_gateway.call_denied") return `was blocked from using ${tool} on`;
    if (action === "tool_gateway.approval_requested") return `asked to use ${tool} on`;
    if (action === "tool_gateway.session_created") return "opened an app session for";
    if (action === "tool_gateway.session_rejected") return "was blocked from opening an app session for";
    if (action === "tool_gateway.discovery") return "discovered app actions for";
  }

  if (action === "issue.updated") {
    const issueUpdatedVerb = formatIssueUpdatedVerb(details);
    if (issueUpdatedVerb) return issueUpdatedVerb;
  }

  if (action === "issue.stalled_review_decided") {
    const decision = typeof details?.action === "string" ? details.action : null;
    const label = decision ? STALLED_REVIEW_DECISION_LABELS[decision] : null;
    if (label) return `${label} on`;
  }

  const outcomeLabel = formatInteractionOutcomeLabel(action, details);
  if (outcomeLabel) return `${outcomeLabel} on`;

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: false,
  });
  if (structuredChange) return structuredChange;

  return ACTIVITY_ROW_VERBS[action] ?? actionFallbackLabel(action);
}

export function formatIssueActivityAction(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueUpdatedAction = formatIssueUpdatedAction(details, options);
    if (issueUpdatedAction) return issueUpdatedAction;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: true,
  });
  if (structuredChange) return structuredChange;

  if (action === "issue.accepted_plan_decomposition_updated") {
    const detail = formatAcceptedPlanDecompositionDetail(details);
    if (detail) return detail;
  }

  if (action === "issue.stalled_review_decided") {
    const decision = typeof details?.action === "string" ? details.action : null;
    const label = decision ? STALLED_REVIEW_DECISION_LABELS[decision] : null;
    if (label) return label;
  }

  const outcomeLabel = formatInteractionOutcomeLabel(action, details);
  if (outcomeLabel) return outcomeLabel;

  if (action.startsWith("issue.monitor_") && details) {
    const serviceName = typeof details.serviceName === "string" && details.serviceName.trim()
      ? details.serviceName.trim()
      : null;
    const base = ISSUE_ACTIVITY_LABELS[action] ?? actionFallbackLabel(action);
    return serviceName ? `${base} for ${serviceName}` : base;
  }

  if (
    (
      action === "issue.document_created" ||
      action === "issue.document_updated" ||
      action === "issue.document_locked" ||
      action === "issue.document_unlocked" ||
      action === "issue.document_deleted"
    ) &&
    details
  ) {
    const key = typeof details.key === "string" ? details.key : "document";
    const title = typeof details.title === "string" && details.title ? ` (${details.title})` : "";
    return `${ISSUE_ACTIVITY_LABELS[action] ?? action} ${key}${title}`;
  }

  return ISSUE_ACTIVITY_LABELS[action] ?? actionFallbackLabel(action);
}
