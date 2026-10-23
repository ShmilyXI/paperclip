import { t } from "@/i18n";
import { useId } from "react";
import { AGENT_ROLES, } from "@paperclipai/shared";
import { localizedRoleLabels } from "@/lib/role-labels";
import type { MuseInvitationDraft } from "@/lib/muse-invitation-draft";
import { Input } from "../ui/input";
import { Link } from "@/lib/router";
import { ArrowLeft, Bot, Check, Circle, CircleAlert, Loader2 } from "lucide-react";
import { AdapterMark } from "../AdapterMark";
import { AgentSetupPrompt } from "../AgentSetupPrompt";
import { Button } from "../ui/button";
import { DialogDescription, DialogTitle } from "../ui/dialog";
import { cn } from "@/lib/utils";

export type ExternalAgentPreset = "dot" | "grok_bot" | "muse" | "hermes" | "other";
export type DotConnectionState = {
  phase: "waiting" | "connected" | "subscribed" | "testing" | "finishing" | "ready";
  problem?: "event_timeout" | "prompt_unavailable" | "offline" | "agent_unavailable";
};

const presets = [
  { id: "dot", name: "Dot", adapter: "openai_dot", description: t("externalAgentInviteContent.yourDotInChatgpt") },
  { id: "grok_bot", name: "Grok Bot", adapter: "grok_bot", description: t("externalAgentInviteContent.anExistingBotInGrok") },
  { id: "muse", name: t("externalAgentInviteContent.musePersonalAgent"), adapter: "muse", description: t("externalAgentInviteContent.yourPersonalMuseAtMuse") },
  { id: "hermes", name: "Hermes", adapter: "hermes_gateway", description: t("externalAgentInviteContent.anExistingHermesAgent") },
  { id: "other", name: t("externalAgentInviteContent.other"), adapter: "http", description: t("externalAgentInviteContent.anyAgentThatCanConnect") },
] as const;

export function ExternalAgentPresetPicker({ onSelect, dotDisabledReason, grokDisabledReason, museEnabled = false }: { onSelect: (preset: ExternalAgentPreset) => void; dotDisabledReason?: string; grokDisabledReason?: string; museEnabled?: boolean }) {
  return <div className={cn("grid grid-cols-2 gap-3", !museEnabled && "sm:grid-cols-4")}>
    {presets.filter(preset => preset.id !== "muse" || museEnabled).map(preset => <button
      key={preset.id}
      type="button"
      onClick={() => onSelect(preset.id)}
      disabled={preset.id === "dot" && !!dotDisabledReason || preset.id === "grok_bot" && !!grokDisabledReason}
      title={preset.id === "dot" ? dotDisabledReason : preset.id === "grok_bot" ? grokDisabledReason : undefined}
      className="flex aspect-square flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-3 py-4 text-center transition-colors disabled:opacity-50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AdapterMark type={preset.adapter} className="size-8" />
      <span className="text-sm font-medium">{preset.name}</span>
      <span className="sr-only">{preset.description}</span>
    </button>)}
  </div>;
}

const checks = [
  { title: t("externalAgentInviteContent.connectedToPaperclip"), description: t("externalAgentInviteContent.yourDotHasConnectedTo") },
  { title: t("externalAgentInviteContent.taskUpdatesEnabled"), description: t("externalAgentInviteContent.yourDotIsSubscribedTo") },
  { title: t("externalAgentInviteContent.testEventConfirmed"), description: t("externalAgentInviteContent.yourDotReceivedOurTest") },
];

/** Controlled by server evidence in the invite controller, never by copying a prompt. */
export function DotConnectionChecks({ state }: { state: DotConnectionState }) {
  const completed = { waiting: 0, connected: 1, subscribed: 2, testing: 2, finishing: 3, ready: 3 }[state.phase];
  const message = state.problem === "agent_unavailable" ? t("externalAgentInviteContent.connectionChecksPassedButThis")
    : state.problem === "offline" ? t("externalAgentInviteContent.connectionUpdatesPausedReconnectTo")
    : state.problem === "prompt_unavailable" ? t("externalAgentInviteContent.thisSetupPromptWasReplaced")
    : state.problem === "event_timeout" ? t("externalAgentInviteContent.yourDotConnectedButHasn")
    : state.phase === "finishing" ? t("externalAgentInviteContent.yourDotConfirmedTheTest")
    : state.phase === "ready" ? t("externalAgentInviteContent.yourDotIsReadyFor")
    : state.phase === "waiting" ? t("externalAgentInviteContent.watchingForYourDotUpdates")
    : state.phase === "connected" ? t("externalAgentInviteContent.yourDotConnectedWaitingFor")
    : t("externalAgentInviteContent.waitingForYourDotTo");
  return <section aria-label={t("externalAgentInviteContent.dotConnectionChecks")} className="space-y-4">
    <ol className="space-y-4">
      {checks.map((check, index) => {
        const done = index < completed;
        const failed = index === completed && state.problem === "event_timeout";
        const active = index === completed && !state.problem;
        const Icon = done ? Check : failed ? CircleAlert : active ? Loader2 : Circle;
        return <li key={check.title} className="flex items-start gap-3" aria-current={active ? "step" : undefined}>
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", done ? "bg-accent text-foreground" : failed ? "text-destructive" : "text-muted-foreground")}>
            <Icon className={cn("size-4", active && "animate-spin motion-reduce:animate-none")} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn("text-sm", done || active || failed ? "font-medium" : "text-muted-foreground")}>
              {check.title}<span className="sr-only">{done ? ": complete" : failed ? ": needs attention" : active ? ": in progress" : ": waiting"}</span>
            </p>
            {done && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.description}</p>}
          </div>
        </li>;
      })}
    </ol>
    <p role={state.problem && state.problem !== "prompt_unavailable" ? "alert" : "status"} aria-live="polite" className={cn("text-sm leading-relaxed", state.problem && state.problem !== "prompt_unavailable" ? "text-destructive" : "text-muted-foreground")}>{message}</p>
  </section>;
}

export type MuseConnectionState = {
  paired: boolean;
  receiverDetected: boolean;
  backgroundReplyVerified: boolean;
  ready: boolean;
  finishing?: boolean;
  testing?: boolean;
  problem?: "no_recent_response" | "prompt_unavailable" | "offline" | "agent_unavailable" | "disconnected" | "disabled" | "connection_expired";
};

/** Receiver contact is separate from an authenticated, independent worker reply. */
export function MuseConnectionChecks({ state }: { state: MuseConnectionState }) {
  const milestones = [
    { title: t("externalAgentInviteContent.pairedWithPaperclip"), done: state.paired, description: t("externalAgentInviteContent.paperclipAuthorizedTheScopedMuse") },
    { title: t("externalAgentInviteContent.receiverDetected"), done: state.receiverDetected, description: t("externalAgentInviteContent.paperclipObservedAPublicReceiver") },
    { title: t("externalAgentInviteContent.backgroundReplyVerified"), done: state.backgroundReplyVerified, description: t("externalAgentInviteContent.museRepliedToAnIndependent") },
  ];
  const checksPassed = milestones.every(item => item.done);
  const message = state.problem === "offline" ? t("externalAgentInviteContent.connectionUpdatesPausedRefreshTo")
    : state.problem === "disconnected" ? t("externalAgentInviteContent.disconnectedTheseAreTheLast")
    : state.problem === "connection_expired" ? t("externalAgentInviteContent.thisMuseConnectionExpiredReconnect")
    : state.problem === "disabled" ? t("externalAgentInviteContent.museIsDisabledTheseAre")
    : state.problem === "prompt_unavailable" ? t("externalAgentInviteContent.thisSetupPromptWasReplaced2")
    : state.problem === "agent_unavailable" ? t("externalAgentInviteContent.connectionChecksPassedResolveThis")
    : state.problem === "no_recent_response" ? t("externalAgentInviteContent.noRecentResponseOpenMuse")
    : state.testing ? t("externalAgentInviteContent.waitingForMuseToReply")
    : checksPassed && state.ready ? t("externalAgentInviteContent.museIsReadyForTasks")
    : checksPassed ? t("externalAgentInviteContent.allConnectionChecksPassedPaperclip")
    : !state.paired ? t("externalAgentInviteContent.watchingForMuseToPair")
    : !state.receiverDetected ? t("externalAgentInviteContent.museIsPairedWaitingFor")
    : t("externalAgentInviteContent.receiverDetectedWaitingForMuse");
  return <section aria-label={t("externalAgentInviteContent.museConnectionChecks")} className="space-y-4">
    <ol className="space-y-4">
      {milestones.map(item => <li key={item.title} className="flex items-start gap-3">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", item.done ? "bg-accent text-foreground" : "text-muted-foreground")}>
          {item.done ? <Check className="size-4" /> : <Circle className="size-4" />}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className={cn("text-sm", item.done ? "font-medium" : "text-muted-foreground")}>
            {item.title}<span className="sr-only">{item.done ? ": complete" : ": waiting"}</span>
          </p>
          {item.done && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
        </div>
      </li>)}
    </ol>
    <p role="status" aria-live="polite" className="text-sm leading-relaxed text-muted-foreground">{message}</p>
  </section>;
}

/** Shared presentation for the invitation flow. The caller owns invitations and watching. */
export function ExternalAgentInviteContent({
  preset, prompt, companyName, connection, onSelect, onBack, onClose, onCopied, onRetry, onNewPrompt,
  dotDisabledReason, grokDisabledReason, busy = false, error, approvalHref, museEnabled = false, museConnection, museDraft, onMuseDraftChange, onMuseContinue,
}: {
  museEnabled?: boolean;
  museConnection?: MuseConnectionState;
  museDraft?: MuseInvitationDraft;
  onMuseDraftChange?: (draft: MuseInvitationDraft) => void;
  onMuseContinue?: () => void;
  dotDisabledReason?: string;
  grokDisabledReason?: string;
  busy?: boolean;
  error?: string;
  approvalHref?: string;
  preset: ExternalAgentPreset | null;
  prompt: string;
  companyName: string;
  connection: DotConnectionState;
  onSelect: (preset: ExternalAgentPreset) => void;
  onBack: () => void;
  onClose: () => void;
  onCopied: () => void;
  onRetry: () => void;
  onNewPrompt: () => void;
}) {
  const detailsId = useId();
  const muse = preset === "muse";
  const museDetails = muse && !!museDraft;
  const museAwaitingInvitation = muse && !museDetails && !museConnection && !approvalHref;
  const museReady = muse && !!museConnection?.ready && museConnection.paired && museConnection.receiverDetected && museConnection.backgroundReplyVerified && !museConnection.problem && !museConnection.testing;
  const provider = presets.find(item => item.id === preset);
  const dot = preset === "dot";
  const ready = museReady || (dot && connection.phase === "ready" && !connection.problem);
  const connecting = dot && connection.phase !== "waiting";
  const progressLabel = connection.problem === "agent_unavailable" ? t("externalAgentInviteContent.agentUnavailable")
    : connection.problem === "offline" ? t("externalAgentInviteContent.updatesPaused")
    : connection.problem === "event_timeout" ? t("externalAgentInviteContent.needsAttention")
    : connection.phase === "finishing" ? t("externalAgentInviteContent.finishingSetup")
    : connection.phase === "connected" ? t("externalAgentInviteContent.connecting") : t("externalAgentInviteContent.confirmingConnection");
  return <>
    <div className="min-h-0 space-y-6 overflow-y-auto px-6 pb-6 pt-8 sm:px-8">
      <div className="space-y-3 pr-5">
        {muse && <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" />{t("common.back")}</Button>}
        {provider && <AdapterMark type={provider.adapter} className="size-10" />}
        <div className="space-y-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {!provider ? t("externalAgentInviteContent.inviteAnExternalAgent") : muse ? ready ? t("externalAgentInviteContent.museIsConnected") : museDetails || museAwaitingInvitation ? t("externalAgentInviteContent.inviteYourMuse") : t("externalAgentInviteContent.connectYourMuse") : dot ? ready ? t("externalAgentInviteContent.yourDotIsConnected") : t("externalAgentInviteContent.connectYourDot") : preset === "hermes" ? t("externalAgentInviteContent.inviteYourHermesAgent") : t("externalAgentInviteContent.inviteYourAgent")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {!provider ? t("externalAgentInviteContent.bringAnAgentYouAlready", { companyName })
              : muse ? museDetails ? t("externalAgentInviteContent.giveYourPersonalMuseA", { companyName })
              : museAwaitingInvitation ? t("externalAgentInviteContent.museRequiresAnAuthenticatedPaperclip")
              : ready ? t("externalAgentInviteContent.museCanReceiveAssignmentsAnd", { companyName })
              : !prompt && !museConnection?.paired ? t("externalAgentInviteContent.weReCheckingWhetherThis")
              : t("externalAgentInviteContent.pasteTheSetupPromptInto")
              : ready ? t("externalAgentInviteContent.yourDotCanNowReceive", { companyName })
              : connection.problem === "agent_unavailable" ? t("externalAgentInviteContent.yourDotIsConnectedThis")
              : connection.phase === "finishing" ? t("externalAgentInviteContent.yourDotHasConnectedAnd")
              : connecting ? t("externalAgentInviteContent.yourDotHasConnectedWe")
              : dot ? t("externalAgentInviteContent.copyTheSetupPromptAnd")
              : t("externalAgentInviteContent.copyTheInvitationPromptAnd", { mark: preset === "hermes" ? "Hermes " : "" })}
          </DialogDescription>
        </div>
      </div>
      {error && <div role="alert" className="space-y-3 text-sm text-destructive"><p>{error}</p>{!museAwaitingInvitation && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("common.tryAgain")}</Button>}</div>}
      {!provider ? <><ExternalAgentPresetPicker onSelect={onSelect} dotDisabledReason={dotDisabledReason} grokDisabledReason={grokDisabledReason} museEnabled={museEnabled} />
        {dotDisabledReason && <p className="text-sm text-muted-foreground">{dotDisabledReason}</p>}{grokDisabledReason && grokDisabledReason !== dotDisabledReason && <p className="text-sm text-muted-foreground">{grokDisabledReason}</p>}</>
        : approvalHref ? <p className="text-sm text-muted-foreground">An organization admin needs to approve this agent before {muse ? "Muse" : "Dot"} can connect. This page will update after approval.</p>
        : museAwaitingInvitation ? busy ? <p role="status" className="text-sm text-muted-foreground">{t("externalAgentInviteContent.loadingMuseInvitation")}</p> : null
        : muse && busy && !museDetails && !prompt && !museConnection?.paired ? <p role="status" className="text-sm text-muted-foreground">{t("externalAgentInviteContent.loadingMuseSetup")}</p>
        : museDetails ? <form id={detailsId} className="space-y-4" onSubmit={event => { event.preventDefault(); if (museDraft.name.trim() && !busy) onMuseContinue?.(); }}>
          <div className="space-y-2">
            <label htmlFor={`${detailsId}-name`} className="text-sm font-medium">{t("externalAgentInviteContent.agentName")}</label>
            <Input id={`${detailsId}-name`} disabled={busy} autoFocus maxLength={100} value={museDraft.name} placeholder="Muse" onChange={event => onMuseDraftChange?.({ ...museDraft, name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${detailsId}-role`} className="text-sm font-medium">{t("common.role")}</label>
            <select id={`${detailsId}-role`} disabled={busy} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={museDraft.role} onChange={event => {
              const role = AGENT_ROLES.find(value => value === event.target.value);
              if (role) onMuseDraftChange?.({ ...museDraft, role });
            }}>{AGENT_ROLES.map(role => <option key={role} value={role}>{localizedRoleLabels[role]}</option>)}</select>
          </div>
          <p className="text-xs text-muted-foreground">{t("externalAgentInviteContent.museUsesItsOwnApproved")}</p>
        </form>
        : muse && museConnection ? <>
          <MuseConnectionChecks state={museConnection} />
          {museConnection.problem === "no_recent_response" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("externalAgentInviteContent.testBackgroundReply")}</Button>}
          {museConnection.problem === "offline" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("externalAgentInviteContent.refreshConnection")}</Button>}
          {!museConnection.paired && <a href="https://muse.ai" target="_blank" rel="noopener noreferrer" className="inline-flex text-sm text-foreground underline underline-offset-4">{t("externalAgentInviteContent.openMuse")}</a>}
          <p className="text-xs text-muted-foreground">{t("externalAgentInviteContent.receiverContactIsPersistedIn")}</p>
        </>
        : busy && !prompt && connection.phase === "waiting" ? <p role="status" className="text-sm text-muted-foreground">{t("externalAgentInviteContent.preparingYourInvitation")}</p> : dot ? <>
        <div className="border-t pt-6"><DotConnectionChecks state={connection} />
          {connection.phase === "waiting" && <p className="mt-4 text-xs text-muted-foreground">{t("externalAgentInviteContent.dotUsesYourOpenaiAccount")}</p>}</div>
        {connection.problem === "event_timeout" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("externalAgentInviteContent.retryTestEvent")}</Button>}
        {connection.problem === "offline" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("externalAgentInviteContent.reconnectUpdates")}</Button>}
      </> : <p className="text-sm leading-relaxed text-muted-foreground">The invitation includes everything your agent needs to join {companyName}. You can review its request before granting access.</p>}
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={muse ? onClose : provider ? onBack : onClose}>
          {provider && !muse && <ArrowLeft className="size-4" />}{muse ? ready ? t("common.close") : t("common.saveExit") : provider ? t("common.back") : t("common.cancel")}
        </Button>
      </div>
      {provider && (approvalHref ? <Button asChild><Link to={approvalHref} onClick={onClose}>{t("externalAgentInviteContent.reviewApproval")}</Link></Button>
        : museDetails ? <Button type="submit" form={detailsId} disabled={busy || !museDraft.name.trim()}>{busy ? t("externalAgentInviteContent.preparing") : t("common.continue")}</Button>
        : ready ? <Button onClick={onClose}>{t("common.done")}</Button>
        : museAwaitingInvitation ? <Button disabled={busy} onClick={onRetry}>{busy ? t("externalAgentInviteContent.loadingSetup") : t("externalAgentInviteContent.refreshSetup")}</Button>
        : muse ? museConnection?.problem === "disconnected" || museConnection?.problem === "connection_expired" ? <Button disabled={busy} onClick={onNewPrompt}>{t("externalAgentInviteContent.reconnectMuse")}</Button>
          : museConnection?.problem === "prompt_unavailable" ? <Button disabled={busy} onClick={onNewPrompt}>{t("externalAgentInviteContent.createANewPrompt")}</Button>
          : !museConnection?.paired && prompt ? <AgentSetupPrompt key={prompt} prompt={prompt} label={t("externalAgentInviteContent.copySetupPrompt")} title={t("externalAgentInviteContent.connectYourMuse")} agent={{ name: "Muse", icon: <Bot className="size-5" /> }} description={t("externalAgentInviteContent.sendThisWholePromptTo")} align="end" className="min-w-0 shrink" onCopied={onCopied} />
          : busy ? <Button disabled>{t("externalAgentInviteContent.preparing")}</Button>
          : <Button asChild><a href="https://muse.ai" target="_blank" rel="noopener noreferrer">{t("externalAgentInviteContent.openMuse")}</a></Button>
        : connecting ? <Button disabled aria-live="polite">
          {!connection.problem && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {progressLabel}
        </Button>
        : dot && connection.problem === "prompt_unavailable" ? <Button disabled={busy} onClick={onNewPrompt}>{t("externalAgentInviteContent.createANewPrompt")}</Button>
        : !prompt || busy ? <Button disabled>{busy ? t("externalAgentInviteContent.preparing") : t("externalAgentInviteContent.waitingForDot")}</Button>
        : <AgentSetupPrompt
          key={preset}
          prompt={prompt}
          label={dot ? t("externalAgentInviteContent.copySetupPrompt") : t("externalAgentInviteContent.copyInvitationPrompt")}
          title={dot ? t("externalAgentInviteContent.connectYourDot") : t("externalAgentInviteContent.inviteYourAgent")}
          description={dot ? t("externalAgentInviteContent.sendThisWholePromptTo2") : t("externalAgentInviteContent.sendThisWholePromptTo3")}
          agent={dot ? { name: "Dot", src: "/brands/adapters/openai-dot.svg" } : undefined}
          align="end"
          className="min-w-0 shrink"
          onCopied={onCopied}
        />)}
    </div>
  </>;
}
