import { t } from "@/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { McpAppCallToolResult, McpAppModelContext, McpAppViewDetail, McpAppViewSummary } from "@paperclipai/shared";
import { mcpAppsApi } from "@/api/mcpApps";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { McpAppFrame } from "./McpAppFrame";
import { useMcpAppSendMessage } from "./McpAppIssueContext";
import { mcpAppNavigationGuardSupported, type McpAppDisplayMode } from "./mcp-app-host";

const UNSUPPORTED_BROWSER_MESSAGE = t("mcpAppView.unsupportedBrowserMessage");

/** A message a view proposed for the chat, waiting for the viewer. */
export interface McpAppMessageProposal {
  text: string;
  status: "pending" | "sending" | "error";
  errorMessage?: string | null;
}

/**
 * "Circleback wants to send: …". Nothing is sent until the viewer clicks Send;
 * the text is shown exactly as it will be posted.
 */
export function McpAppMessageProposalCard({ applicationName, proposal, onSend, onDismiss }: {
  applicationName: string;
  proposal: McpAppMessageProposal;
  onSend: () => void;
  onDismiss: () => void;
}) {
  const sending = proposal.status === "sending";
  return (
    <div
      role="group"
      aria-label={t("mcpAppView.wantsToSendAMessage", { app: applicationName })}
      data-testid="mcp-app-message-proposal"
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
    >
      <p className="text-xs text-muted-foreground">{t("mcpAppView.wantsToSend", { app: applicationName })}</p>
      <blockquote className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-border pl-2.5 text-sm text-foreground">
        {proposal.text}
      </blockquote>
      {proposal.status === "error" ? (
        <p role="alert" className="text-xs text-destructive">{proposal.errorMessage ?? t("mcpAppView.messageCouldNotBeSent")}</p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss} disabled={sending}>{t("common.dismiss")}</Button>
        <Button type="button" size="sm" onClick={onSend} disabled={sending}>{sending ? t("taskChatBubble.sending") : t("common.send")}</Button>
      </div>
    </div>
  );
}

export interface McpAppViewContentProps {
  detail: McpAppViewDetail | undefined;
  status: "loading" | "error" | "ready";
  errorMessage?: string | null;
  callTool: (name: string, args: Record<string, unknown>) => Promise<McpAppCallToolResult>;
  displayName: string;
  displayMode?: McpAppDisplayMode;
  /** The view or the viewer changed the display mode. Without it, views stay inline. */
  onDisplayModeChange?: (mode: McpAppDisplayMode) => void;
  proposeMessage?: (text: string) => Promise<void>;
  updateModelContext?: (context: McpAppModelContext | null) => Promise<void>;
  proposal?: McpAppMessageProposal | null;
  onSendProposal?: () => void;
  onDismissProposal?: () => void;
}

/** Presentational shell, shared by the live view and its stories. */
export function McpAppViewContent({
  detail, status, errorMessage, callTool, displayName,
  displayMode = "inline", onDisplayModeChange, proposeMessage, updateModelContext,
  proposal, onSendProposal, onDismissProposal,
}: McpAppViewContentProps) {
  const unsupported = !mcpAppNavigationGuardSupported();
  if (status === "error" || unsupported) {
    return (
      <div role="status" data-testid="mcp-app-view-error" className="ml-1.5 mt-0.5 border-l-2 border-border py-1 pl-2.5 text-(length:--text-micro) text-muted-foreground">
        {unsupported ? UNSUPPORTED_BROWSER_MESSAGE : errorMessage ?? t("mcpAppView.viewCouldNotBeShown")}
      </div>
    );
  }
  const applicationName = detail?.applicationName ?? t("profileDetail.app");
  const fullscreen = displayMode === "fullscreen" && Boolean(detail) && Boolean(onDisplayModeChange);
  // One frame at a time: the fullscreen dialog hosts its own frame while the
  // inline slot waits, so the view never runs twice.
  const frame = detail ? (
    <McpAppFrame
      title={t("mcpAppView.frameTitle", { app: detail.applicationName, name: displayName })}
      viewId={detail.id}
      toolName={detail.upstreamToolName}
      resource={detail.resource}
      toolInput={detail.toolInput}
      toolResult={detail.toolResult}
      callTool={callTool}
      displayMode={fullscreen ? "fullscreen" : "inline"}
      onRequestDisplayMode={onDisplayModeChange}
      proposeMessage={proposeMessage}
      updateModelContext={updateModelContext}
      className={fullscreen ? "min-h-0 flex-1" : undefined}
    />
  ) : null;
  const proposalCard = proposal && onSendProposal && onDismissProposal ? (
    <McpAppMessageProposalCard applicationName={applicationName} proposal={proposal} onSend={onSendProposal} onDismiss={onDismissProposal} />
  ) : null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        data-testid="mcp-app-view"
        className={cn(
          "min-w-0 max-w-full overflow-hidden",
          detail?.resource.prefersBorder !== false && "rounded-lg border border-border bg-card p-3",
        )}
      >
        {status === "loading" || !detail ? (
          <div role="status" aria-label={t("mcpAppView.loadingView", { app: detail?.applicationName ?? t("mcpAppView.appFallback") })} className="h-24 animate-pulse bg-muted/40" />
        ) : fullscreen ? (
          <div role="status" data-testid="mcp-app-view-fullscreen-placeholder" className="flex items-center justify-between gap-2 py-2 text-xs text-muted-foreground">
            <span>{t("mcpAppView.showingFullScreen")}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onDisplayModeChange?.("inline")}>{t("mcpAppView.backToChat")}</Button>
          </div>
        ) : frame}
      </div>
      {fullscreen ? null : proposalCard}
      {fullscreen ? (
        <Dialog open onOpenChange={(open) => { if (!open) onDisplayModeChange?.("inline"); }}>
          <DialogContent
            data-testid="mcp-app-fullscreen"
            showCloseButton={false}
            className="inset-4 top-4 left-4 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 p-0 sm:max-w-none md:top-4 md:translate-y-0"
          >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-medium">{displayName}</DialogTitle>
                <DialogDescription className="text-xs">{t("mcpAppView.widgetFrom", { app: applicationName })}</DialogDescription>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onDisplayModeChange?.("inline")}>{t("mcpAppView.exitFullScreen")}</Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
              {frame}
              {proposalCard}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function viewErrorMessage(error: unknown, applicationName: string): string {
  if (error instanceof ApiError && error.status === 404) return t("mcpAppView.viewNoLongerAvailable", { app: applicationName });
  return t("mcpAppView.couldNotShowThisView", { app: applicationName });
}

function sendErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : t("mcpAppView.messageCouldNotBeSent");
}

/**
 * The view's `ui/message` proposals. At most one waits per view; the view
 * hears "sent" only after the viewer clicked Send and the comment went out.
 */
export function useMcpAppMessageProposal(issueId: string, viewId: string) {
  const sendMessage = useMcpAppSendMessage();
  const [proposal, setProposal] = useState<McpAppMessageProposal | null>(null);
  // One request id per proposal: a retry after a lost response reuses it, so
  // the comment endpoint's duplicate protection keeps it to one comment.
  const pending = useRef<{ text: string; clientRequestId: string; resolve: () => void; reject: (error: Error) => void } | null>(null);

  useEffect(() => () => {
    pending.current?.reject(new Error("The view was closed"));
    pending.current = null;
  }, []);

  const proposeMessage = useCallback((text: string) => new Promise<void>((resolve, reject) => {
    if (pending.current) {
      reject(new Error("A message from this view is already waiting for the user"));
      return;
    }
    pending.current = { text, clientRequestId: crypto.randomUUID(), resolve, reject };
    setProposal({ text, status: "pending" });
  }), []);

  const onSend = useCallback(async () => {
    const current = pending.current;
    if (!current || !sendMessage) return;
    setProposal({ text: current.text, status: "sending" });
    const { clientRequestId } = current;
    try {
      await sendMessage(current.text, clientRequestId);
    } catch (error) {
      setProposal({ text: current.text, status: "error", errorMessage: sendErrorMessage(error) });
      return;
    }
    // The comment is sent; recording where it came from must not undo that.
    void mcpAppsApi.messageSent(issueId, viewId, clientRequestId).catch(() => undefined);
    pending.current = null;
    setProposal(null);
    current.resolve();
  }, [issueId, viewId, sendMessage]);

  const onDismiss = useCallback(() => {
    pending.current?.reject(new Error("Message sending denied"));
    pending.current = null;
    setProposal(null);
  }, []);

  return sendMessage
    ? { proposeMessage, proposal, onSend: () => void onSend(), onDismiss }
    : { proposeMessage: undefined, proposal: null, onSend: undefined, onDismiss: undefined };
}

/** Loads a recorded view and renders it under its tool row. */
export function McpAppView({ issueId, view, displayName, displayMode, onDisplayModeChange }: {
  issueId: string;
  view: McpAppViewSummary;
  displayName: string;
  displayMode?: McpAppDisplayMode;
  onDisplayModeChange?: (mode: McpAppDisplayMode) => void;
}) {
  const query = useQuery({
    queryKey: queryKeys.mcpApps.detail(issueId, view.id),
    queryFn: ({ signal }) => mcpAppsApi.detail(issueId, view.id, signal),
    // No document download where the view cannot be shown safely.
    enabled: mcpAppNavigationGuardSupported(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const callTool = useCallback(
    (name: string, args: Record<string, unknown>) => mcpAppsApi.callTool(issueId, view.id, name, args),
    [issueId, view.id],
  );
  const { proposeMessage, proposal, onSend, onDismiss } = useMcpAppMessageProposal(issueId, view.id);
  // Context goes with messages: a viewer who can't post here can't steer the agent either.
  // Writes are ordered per view, across frames: a write from a frame replaced
  // by the full-screen one always lands before the new frame's writes.
  const contextWrites = useRef<Promise<unknown>>(Promise.resolve());
  const updateModelContext = useCallback((context: McpAppModelContext | null) => {
    const write = contextWrites.current.catch(() => undefined)
      .then(() => mcpAppsApi.updateModelContext(issueId, view.id, context));
    contextWrites.current = write;
    return write.then(() => undefined);
  }, [issueId, view.id]);
  return (
    <McpAppViewContent
      detail={query.data}
      status={query.data ? "ready" : query.error ? "error" : "loading"}
      errorMessage={!query.data && query.error ? viewErrorMessage(query.error, view.applicationName) : null}
      callTool={callTool}
      displayName={displayName}
      displayMode={displayMode}
      onDisplayModeChange={onDisplayModeChange}
      proposeMessage={proposeMessage}
      updateModelContext={proposeMessage ? updateModelContext : undefined}
      proposal={proposal}
      onSendProposal={onSend}
      onDismissProposal={onDismiss}
    />
  );
}
