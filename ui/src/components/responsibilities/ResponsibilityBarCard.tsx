import { t } from "@/i18n";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Agent,
  ResponsibilityDetail,
  ResponsibilityHealthOverride,
  UpdateResponsibility,
} from "@paperclipai/shared";
import { ChevronDown, Loader2, MessageSquare, Pencil } from "lucide-react";
import { activityApi } from "@/api/activity";
import { authApi } from "@/api/auth";
import { describeError } from "@/api/errors";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { responsibilitiesApi } from "@/api/responsibilities";
import { responsibilityBarsApi } from "@/api/responsibility-bars";
import { InlineEditor } from "@/components/InlineEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useNavigate } from "@/lib/router";
import {
  barDraftFrom,
  buildBarUpdate,
  describeReadingAge,
  lastReadingActor,
  missingFieldsFromError,
  parseMetricNumber,
  RESPONSIBILITY_HEALTH_LABEL,
  validateBarDraft,
  type BarDraft,
  type BarField,
} from "@/lib/responsibilities";
import { BarProposalCard } from "./BarProposalCard";
import { MetricGlance } from "./MetricGlance";
import { ResponsibilityBarFields } from "./ResponsibilityBarFields";
import { ResponsibilityMetrics } from "./ResponsibilityMetricSet";
import { ResponsibilityStatusBlock } from "./ResponsibilityStatusLead";

type StatusChoice = ResponsibilityHealthOverride | "automatic";

/** Writes a change and refreshes every responsibilities read. */
function useUpdateResponsibility(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateResponsibility) => responsibilitiesApi.update(id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<ResponsibilityDetail>(queryKeys.responsibilities.detail(id), (old) =>
        old ? { ...old, ...updated } : old);
      void queryClient.invalidateQueries({ queryKey: queryKeys.responsibilities.all });
    },
  });
}

/** "by Ada", "by you", or nothing when the activity does not say. */
function useReadingAuthor(responsibility: ResponsibilityDetail, agentsById: ReadonlyMap<string, Agent>) {
  const session = useQuery({ queryKey: queryKeys.auth.session, queryFn: () => authApi.getSession() });
  const activity = useQuery({
    queryKey: [...queryKeys.responsibilities.activity(responsibility.id), responsibility.metricUpdatedAt ? String(responsibility.metricUpdatedAt) : null],
    queryFn: () => activityApi.list(responsibility.companyId, { entityType: "responsibility", entityId: responsibility.id, limit: 50 }),
    enabled: !!responsibility.metricUpdatedAt,
    staleTime: 60_000,
  });
  const actor = lastReadingActor(activity.data ?? [], responsibility.metricUpdatedAt);
  if (!actor) return null;
  if (actor.actorType === "agent") return agentsById.get(actor.actorId)?.name ?? t("decisionCard.anAgent");
  if (actor.actorType === "user") {
    if (session.data?.user?.id && actor.actorId === session.data.user.id) return t("issueThreadInteractionCard.youMidSentence");
    return actor.actorId === responsibility.ownerUserId ? t("responsibilities.theOwner") : t("responsibilities.aTeammate");
  }
  return null;
}

/** Record a new reading: one number saved on Enter, or Yes / No for a yes-or-no bar. */
export function RecordReading({ responsibility }: { responsibility: ResponsibilityDetail }) {
  const inputId = useId();
  const update = useUpdateResponsibility(responsibility.id);
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const parsed = parseMetricNumber(value);
  const record = (metricCurrent: number | boolean, onDone?: () => void) => {
    if (update.isPending) return;
    update.mutate({ metricCurrent }, {
      onSuccess: () => {
        onDone?.();
        setNotice(t("responsibilities.recorded"));
      },
    });
  };
  const failed = update.error ? (
    <p role="alert" className="text-xs text-destructive">{t("responsibilities.couldNotRecordIt")} {describeError(update.error).body}</p>
  ) : null;
  if (responsibility.metricKind === "yes_no") {
    return (
      <div className="flex flex-col gap-1.5" role="group" aria-label={t("responsibilities.recordANewReading")}>
        <span className="text-xs text-muted-foreground">{t("responsibilities.isItTrueToday")}</span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={update.isPending} onClick={() => record(true)}>{t("common.yes")}</Button>
          <Button type="button" size="sm" variant="outline" disabled={update.isPending} onClick={() => record(false)}>{t("common.no")}</Button>
        </div>
        {notice ? <p role="status" className="text-xs text-muted-foreground">{notice}</p> : null}
        {failed}
      </div>
    );
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (typeof parsed !== "number") return;
    record(parsed, () => setValue(""));
  };
  const unit = responsibility.metricKind === "percentage" ? "%" : responsibility.metricUnit?.trim();
  return (
    <form className="flex flex-col gap-1.5" onSubmit={submit} aria-label={t("responsibilities.recordANewReading")}>
      <label htmlFor={inputId} className="text-xs text-muted-foreground">
        {t("responsibilities.newReading")}{unit ? ` (${unit})` : ""}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          inputMode="decimal"
          value={value}
          placeholder={responsibility.metricCurrent === null ? t("responsibilities.exampleNumber") : String(responsibility.metricCurrent)}
          className="max-w-40"
          aria-invalid={parsed === "invalid" || undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setNotice(null);
          }}
        />
        <Button type="submit" size="sm" variant="outline" disabled={typeof parsed !== "number" || update.isPending}>
          {update.isPending ? t("common.saving2") : t("responsibilities.record")}
        </Button>
      </div>
      {parsed === "invalid" ? <p className="text-xs text-destructive">{t("responsibilities.enterANumber")}</p> : null}
      {notice ? <p role="status" className="text-xs text-muted-foreground">{notice}</p> : null}
      {failed}
    </form>
  );
}

/** Edit the bar by hand: the sentence, the kind of measure, what is measured and that template's inputs. */
export function EditBarDialog({
  responsibility,
  open,
  onOpenChange,
}: {
  responsibility: ResponsibilityDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateResponsibility(responsibility.id);
  const [draft, setDraft] = useState<BarDraft>(() => barDraftFrom(responsibility));
  const [attempted, setAttempted] = useState(false);
  const reset = update.reset;
  useEffect(() => {
    if (!open) return;
    setDraft(barDraftFrom(responsibility));
    setAttempted(false);
    reset();
    // Only on open: a refetch while editing must not wipe what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const checked = validateBarDraft(draft);
  const missing = new Set<BarField>([...(attempted && !checked.ok ? checked.missing : []), ...missingFieldsFromError(update.error)]);
  const invalid = new Set<BarField>(attempted && !checked.ok ? checked.invalid : []);
  const problems = attempted && !checked.ok ? checked.problems : undefined;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!checked.ok || update.isPending) return;
    update.mutate(buildBarUpdate(checked.value), { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{responsibility.standard?.trim() ? t("responsibilities.editTheBar") : t("responsibilities.setTheBar")}</DialogTitle>
            <DialogDescription>{t("responsibilities.howIsSuccessMeasuredFor", { title: responsibility.title })}</DialogDescription>
          </DialogHeader>
          <ResponsibilityBarFields draft={draft} onChange={setDraft} missing={missing} invalid={invalid} problems={problems} />
          {update.error ? (
            <p role="alert" className="text-sm text-destructive">{t("responsibilities.couldNotSaveTheBar")} {describeError(update.error).body}</p>
          ) : null}
          <DialogFooter className="items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={update.isPending}>{update.isPending ? t("common.saving2") : t("responsibilities.saveTheBar")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Setting the bar by talking to an agent: the primary way to edit the bar.
 * Opens (or reopens) the bar conversation where task conversations live; the
 * agent's proposal comes back here too, so the person can accept it on this
 * page. Editing by hand stays as the secondary way, and is the only way when
 * no agent in the company can hold the conversation.
 */
export function useBarConversation(responsibility: ResponsibilityDetail, enabled: boolean) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: queryKeys.responsibilities.barConversation(responsibility.id),
    queryFn: () => responsibilityBarsApi.conversation(responsibility.id),
    enabled,
  });
  const start = useMutation({
    mutationFn: () => responsibilityBarsApi.start(responsibility.id),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.responsibilities.barConversation(responsibility.id), state);
      if (state.conversation) navigate(`/issues/${state.conversation.identifier ?? state.conversation.issueId}`);
    },
  });
  const view = useQueryView(query);
  const state = query.data ?? null;
  const open = state?.state === "discussing" || state?.state === "proposal_waiting";
  // Without the state (still loading, or it failed) the hand-edit path stays available.
  const canTalk = !!state && (open || state.defaultAgentId !== null);
  /** A failed read of the conversation, shown with Retry instead of quietly hiding the agent option. */
  const loadError = enabled && view.kind === "error" ? view.error : null;
  return { state, open, canTalk, start, loadError, retry: view.retry, retrying: view.isFetching };
}

/**
 * For layouts that do not show the full bar card: the agent's waiting bar
 * proposal (acceptable in place), or a line saying the bar is being talked
 * through. Renders nothing when neither is true.
 */
export function BarConversationStatus({
  responsibility,
  agentsById,
}: {
  responsibility: ResponsibilityDetail;
  agentsById: ReadonlyMap<string, Agent>;
}) {
  const editable = responsibility.status === "active" || responsibility.status === "proposed";
  const conversation = useBarConversation(responsibility, editable);
  if (!editable || !conversation.state) return null;
  if (!conversation.state.proposal && conversation.state.state !== "discussing") return null;
  return <BarConversationNotice state={conversation.state} agentsById={agentsById} />;
}

function BarConversationNotice({
  state,
  agentsById,
}: {
  state: NonNullable<ReturnType<typeof useBarConversation>["state"]>;
  agentsById: ReadonlyMap<string, Agent>;
}) {
  if (state.proposal) {
    return <BarProposalCard interaction={state.proposal} showConversationLink showResponsibilityLink={false} />;
  }
  if (state.state !== "discussing" || !state.conversation) return null;
  const agentName = state.conversation.agentId ? agentsById.get(state.conversation.agentId)?.name : null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground" data-testid="bar-conversation-open">
      <MessageSquare aria-hidden className="h-4 w-4 shrink-0" />
      <span>{t("responsibilities.youAreTalkingTheBarThroughWith", { name: agentName ?? t("decisionCard.anAgent") })}</span>
      <Link
        to={`/issues/${state.conversation.identifier ?? state.conversation.issueId}`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {t("responsibilities.openTheConversation")}
      </Link>
    </p>
  );
}

/** The owner's override: secondary, with a note when set. */
function StatusOverride({ responsibility }: { responsibility: ResponsibilityDetail }) {
  const update = useUpdateResponsibility(responsibility.id);
  const value: StatusChoice = responsibility.healthOverride ?? "automatic";
  const { rollup } = responsibility;
  return (
    <div className="flex flex-col gap-2">
      {rollup.healthOverridden ? (
        <>
          <p className="text-xs text-muted-foreground">
            {t("responsibilities.setByHand")}
            {rollup.computedHealth !== rollup.health
              ? ` ${t("responsibilities.fromTheNumberAloneItIs", { label: RESPONSIBILITY_HEALTH_LABEL[rollup.computedHealth].toLowerCase() })}`
              : ""}
          </p>
          <InlineEditor
            value={responsibility.healthNote ?? ""}
            onSave={(healthNote) => update.mutateAsync({ healthNote: healthNote.trim() || null })}
            as="p"
            className="text-sm text-foreground"
            placeholder={t("responsibilities.whyYouSetItOptional")}
            nullable
          />
        </>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="xs" variant="ghost" className="w-fit text-muted-foreground" disabled={update.isPending}>
            {rollup.healthOverridden ? t("responsibilities.changeOrClear") : t("responsibilities.setTheStatusByHand")}
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t("common.status")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => update.mutate({ healthOverride: next === "automatic" ? null : (next as ResponsibilityHealthOverride) })}
          >
            <DropdownMenuRadioItem value="automatic">{t("responsibilities.fromTheNumber")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="behind">{t("responsibilities.behind")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="at_risk">{t("responsibilities.atRisk")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="on_track">{t("responsibilities.onTrack")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {update.error ? (
        <p role="alert" className="text-xs text-destructive">{t("responsibilities.couldNotChangeTheStatus")} {describeError(update.error).body}</p>
      ) : null}
    </div>
  );
}

/**
 * The bar, first on a responsibility's page: how success is measured; its
 * status (the agent's written status leading when there is one, the status
 * derived from the number beneath it) with the owner's override; up to three
 * metrics that track its health, each drawn in its form (the bar's own
 * number first); when the number was last updated, and by whom, with a fast
 * way to record a reading; and editing the bar.
 */
export function ResponsibilityBarCard({
  responsibility,
  agentsById,
  now,
  editable,
}: {
  responsibility: ResponsibilityDetail;
  agentsById: ReadonlyMap<string, Agent>;
  now: Date;
  /** False once it is dismissed: shown for the record only. */
  editable: boolean;
}) {
  const headingId = useId();
  const [editing, setEditing] = useState(false);
  const conversation = useBarConversation(responsibility, editable);
  const hasBar = !!responsibility.standard?.trim();
  const { rollup } = responsibility;
  const author = useReadingAuthor(responsibility, agentsById);
  const updatedAt = rollup.metric?.updatedAt ?? null;
  return (
    <Card id="responsibility-bar" elevation="low" className="gap-5 px-5 py-5" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("responsibilities.theBar")}</h2>
          <p className="text-base text-foreground">
            {responsibility.standard?.trim() || <span className="text-muted-foreground">{t("responsibilities.noBarYetHowIsSuccessMeasured")}</span>}
          </p>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            {conversation.canTalk ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" />
                  {t("responsibilities.editByHand")}
                </Button>
                <Button
                  size="sm"
                  variant={hasBar ? "outline" : "default"}
                  data-bar-edit-primary=""
                  disabled={conversation.start.isPending}
                  onClick={() => conversation.start.mutate()}
                >
                  {conversation.start.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <MessageSquare aria-hidden="true" />}
                  {conversation.open ? t("responsibilities.continueTheConversation") : hasBar ? t("responsibilities.editTheBar") : t("responsibilities.setTheBar")}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" data-bar-edit-primary="" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {hasBar ? t("responsibilities.editTheBar") : t("responsibilities.setTheBar")}
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {conversation.start.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("responsibilities.couldNotStartTheConversation")} {describeError(conversation.start.error).body} {t("responsibilities.youCanStillEditTheBarByHand")}
        </p>
      ) : null}
      {conversation.loadError ? (
        <QueryErrorState error={conversation.loadError} size="inline" action="load the bar conversation"
          onRetry={conversation.retry} retrying={conversation.retrying} />
      ) : null}
      {editable && conversation.state ? <BarConversationNotice state={conversation.state} agentsById={agentsById} /> : null}

      <div className="flex flex-col gap-3" data-bar-status="">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("common.status")}</span>
          <ResponsibilityStatusBlock responsibility={responsibility} agentsById={agentsById} now={now} editable={editable} />
        </div>
        {editable ? <StatusOverride responsibility={responsibility} /> : null}
      </div>

      <div className="border-t border-border pt-5" data-bar-metrics="">
        <ResponsibilityMetrics
          responsibilityId={responsibility.id}
          primary={rollup.metric}
          now={now}
          agentsById={agentsById}
          layout="grid"
          editable={editable}
          fallback={<MetricGlance metric={rollup.metric} health={rollup.health} now={now} size="hero" className="max-w-sm" />}
        />
      </div>

      {updatedAt || rollup.metric ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {updatedAt
              ? (author
                  ? t("responsibilities.updatedAgeBy", { age: describeReadingAge(updatedAt, now), author })
                  : t("responsibilities.updatedAge", { age: describeReadingAge(updatedAt, now) }))
              : t("responsibilities.noReadingYet")}
          </p>
          {editable && rollup.metric ? <RecordReading responsibility={responsibility} /> : null}
        </div>
      ) : null}
      {editable ? <EditBarDialog responsibility={responsibility} open={editing} onOpenChange={setEditing} /> : null}
    </Card>
  );
}
