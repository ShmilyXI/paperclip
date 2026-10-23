import { t } from "@/i18n";
import { useMemo } from "react";
import {
  humanizeConnectionDisplayName,
  type Agent,
  type ToolCallEvent,
  type ToolConnectionLifecycleEvent,
} from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { appTabHref } from "../app-tabs";
import type { ActivityPanelProps } from "./types";

export function ActivityPanel(props: ActivityPanelProps) {
  return <RecentActivity {...props} />;
}

type TimelineRow = {
  key: string;
  createdAt: Date | string;
  primary: string;
  dotClass: string;
  /** Secondary "while working on PAP-…" issue link, tool-call rows only. */
  issue?: { identifier: string } | null;
  /** Deep-link rendered after the timestamp, lifecycle rows only. */
  link?: { to: string; label: string } | null;
};

function RecentActivity({
  events,
  lifecycleEvents,
  issues,
  actionRequests,
  loading,
  agents,
  connectionId,
  appName,
  userLabelById,
}: ActivityPanelProps) {
  const nameById = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents]);

  const rows = useMemo<TimelineRow[]>(() => {
    const callRows: TimelineRow[] = events
      .filter((e) => HUMANIZED_EVENTS.has(e.eventType))
      .map((event) => {
        const row = humanizeEvent(
          event,
          nameById.get(event.agentId ?? "") ?? null,
          event.actionRequestId ? actionRequests[event.actionRequestId] : undefined,
          isTestEvent(event) ? resolveActorLabel(event.actorId, userLabelById) : null,
        );
        return {
          key: `call:${event.id}`,
          createdAt: event.createdAt,
          primary: row.primary,
          dotClass: dotColor(event),
          issue: event.issueId ? issues[event.issueId] ?? null : null,
        };
      });

    const permissionsHref = appTabHref(connectionId, "permissions");
    const lifecycleRows: TimelineRow[] = lifecycleEvents.map((event) => ({
      key: `lifecycle:${event.id}`,
      createdAt: event.createdAt,
      primary: humanizeLifecycleEvent(event, appName, nameById.get(event.agentId ?? "") ?? null),
      dotClass: lifecycleDotColor(event),
      link: { to: permissionsHref, label: lifecycleLinkLabel(event) },
    }));

    return [...callRows, ...lifecycleRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [events, lifecycleEvents, issues, actionRequests, nameById, connectionId, appName, userLabelById]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("appDetailActivityPanel.recentActivity")}</h2>
      </div>
      {loading ? (
        <div className="space-y-2 py-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-5 text-sm text-muted-foreground">{t("appDetailActivityPanel.noActivityYet")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start gap-3 py-3 text-sm">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", row.dotClass)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-foreground">{row.primary}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.issue ? (
                    <>
                      {t("appDetailActivityPanel.whileWorkingOn")}{" "}
                      <Link
                        to={`/issues/${row.issue.identifier}`}
                        className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {row.issue.identifier}
                      </Link>
                      {" · "}
                    </>
                  ) : null}
                  {timeAgo(row.createdAt)}
                  {row.link ? (
                    <>
                      {" · "}
                      <Link
                        to={row.link.to}
                        className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {row.link.label}
                      </Link>
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const HUMANIZED_EVENTS = new Set<ToolCallEvent["eventType"]>([
  "call_completed",
  "call_failed",
  "call_denied",
  "approval_requested",
  "approval_resolved",
]);

/**
 * A row is a prosumer Test-tab call (vs. a real heartbeat-driven agent run) when
 * the gateway tagged the audit event `metadata.source === "test"` (PAP-11349).
 */
export function isTestEvent(event: ToolCallEvent): boolean {
  return (event.metadata as { source?: unknown } | null)?.source === "test";
}

/** Display name for the human who ran a Test-tab call, from the company directory. */
export function resolveActorLabel(
  actorId: string | null,
  userLabelById: Map<string, string> | undefined,
): string {
  if (actorId) {
    const label = userLabelById?.get(actorId);
    if (label) return label;
    if (actorId === "local-board") return t("common.board");
  }
  return t("appDetailActivityPanel.someone");
}

export function humanizeEvent(
  event: ToolCallEvent,
  agentName: string | null,
  actionRequest?: ActivityPanelProps["actionRequests"][string],
  /** When set, this row is a Test-tab call run by the named user; prefix accordingly. */
  testRunnerLabel?: string | null,
): { primary: string } {
  // For Test-tab calls, surface "<User> {t("appDetailActivityPanel.testedAs")} <Agent>" so prosumer test runs are
  // distinguishable from real heartbeat agent activity in the audit trail (PAP-11415).
  const whoIsAgentPlaceholder = !testRunnerLabel && !agentName;
  const who = testRunnerLabel
    ? t("appDetailActivityPanel.testedAsAgent", { runner: testRunnerLabel, agent: agentName ?? t("appDetailActivityPanel.anAgent") })
    : agentName ?? t("appDetailActivityPanel.anAgent");
  // The raw gateway tool name is prefixed (e.g. `mcp.app-gallery-link-…:kv-set`);
  // humanize it to "Kv Set" to match the cross-app Activity view (PAP-11105).
  const action = event.toolName ? humanizeConnectionDisplayName(event.toolName) : t("appDetailActivityPanel.anAction");
  switch (event.eventType) {
    case "call_completed":
      return {
        primary: event.outcome === "success"
          ? t("appDetailActivityPanel.whoUsedAction", { who, action })
          : t("appDetailActivityPanel.whoRanActionButDidNotFinish", { who, action }),
      };
    case "call_failed":
      return { primary: t("appDetailActivityPanel.actionDidNotWorkFor", { action, who: whoIsAgentPlaceholder ? lowerLead(who) : who }) };
    case "call_denied":
      return {
        primary: testRunnerLabel
          ? t("appDetailActivityPanel.whoDashActionTurnedOff", { who, action })
          : t("appDetailActivityPanel.blockedActionItIsnT", { action }),
      };
    case "approval_requested":
      return { primary: t("appDetailActivityPanel.whoAskedBeforeRunning", { who, action }) };
    case "approval_resolved":
      return { primary: humanizeApprovalResolved(action, actionRequest) };
    default:
      return { primary: t("appDetailActivityPanel.whoUsedAction", { who, action }) };
  }
}

function humanizeApprovalResolved(
  action: string,
  actionRequest?: ActivityPanelProps["actionRequests"][string],
): string {
  const resolver = actionRequest?.resolverDisplayName ?? t("appDetailActivityPanel.someone");
  if (actionRequest?.status === "approved") return t("appDetailActivityPanel.approvedAction", { resolver, action });
  if (actionRequest?.status === "rejected") return t("appDetailActivityPanel.saidNoToAction", { resolver, action });
  return t("appDetailActivityPanel.reviewedAction", { resolver, action });
}

/** Humanize a connection lifecycle event into a prosumer sentence (PAP-11284). */
function humanizeLifecycleEvent(
  event: ToolConnectionLifecycleEvent,
  appName: string,
  agentName: string | null,
): string {
  const who = event.actorDisplayName ?? agentName ?? t("appDetailActivityPanel.someone");
  switch (event.type) {
    case "app_connected":
      return t("appDetailActivityPanel.whoConnectedApp", { who, app: appName });
    case "app_paused":
      return t("appDetailActivityPanel.whoPausedThisApp", { who });
    case "app_resumed":
      return t("appDetailActivityPanel.whoResumedThisApp", { who });
    case "reconnected":
      return t("appDetailActivityPanel.whoReconnectedApp", { who, app: appName });
    case "disconnected":
      return t("appDetailActivityPanel.whoDisconnectedApp", { who, app: appName });
    case "allowlist_changed":
      return humanizeAllowlistChange(who, event.details);
    case "actions_quarantined": {
      const count = numberFrom(event.details?.count);
      return t("appDetailActivityPanel.newActionsNeedReview", { count });
    }
    default:
      return t("appDetailActivityPanel.whoUpdatedThisApp", { who });
  }
}

function humanizeAllowlistChange(who: string, details: Record<string, unknown> | null): string {
  const added = numberFrom(details?.added);
  const removed = numberFrom(details?.removed);
  if (added > 0 && removed === 0) {
    return t("appDetailActivityPanel.whoAddedSheets", { who, count: added });
  }
  if (removed > 0 && added === 0) {
    return t("appDetailActivityPanel.whoRemovedSheets", { who, count: removed });
  }
  if (added > 0 && removed > 0) {
    return t("appDetailActivityPanel.whoUpdatedAllowlistCounts", { who, added, removed });
  }
  return t("appDetailActivityPanel.whoUpdatedAllowlist", { who });
}

function lifecycleLinkLabel(event: ToolConnectionLifecycleEvent): string {
  return event.type === "actions_quarantined" ? t("appDetailActivityPanel.reviewPermissions") : t("appDetailActivityPanel.viewPermissions");
}

function numberFrom(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** The generic agent placeholder reads mid-sentence: "an agent", not "An agent". */
function lowerLead(who: string): string {
  return who.charAt(0).toLowerCase() + who.slice(1);
}

function dotColor(event: ToolCallEvent): string {
  if (event.eventType === "call_failed" || event.outcome === "failure" || event.outcome === "timeout") {
    return "bg-red-400";
  }
  if (event.eventType === "call_denied" || event.outcome === "denied") return "bg-amber-400";
  if (event.eventType === "approval_requested") return "bg-amber-400";
  return "bg-emerald-400";
}

function lifecycleDotColor(event: ToolConnectionLifecycleEvent): string {
  if (event.type === "disconnected") return "bg-red-400";
  if (event.type === "app_paused" || event.type === "actions_quarantined") return "bg-amber-400";
  return "bg-emerald-400";
}
