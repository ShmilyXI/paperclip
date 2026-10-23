import { t } from "@/i18n";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ActivityEvent } from "@paperclipai/shared";
import { cn } from "@/lib/utils";

export type RoutineActivityEvent = Pick<ActivityEvent, "id" | "action" | "details" | "createdAt">;

function formatTime(value: string | Date): string {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(value);
  }
}

function summarizeEvent(event: RoutineActivityEvent): string {
  const details = event.details;
  if (event.action === "routine.webhook_test_received") return t("routineActivityRow.connectionWorkingNoRunOr");
  if (event.action === "routine.webhook_test_rejected") return t("routineActivityRow.updateTheKeyInYour");
  if (event.action === "routine.webhook_received") return t("routineActivityRow.authenticationPassed");
  if (event.action === "routine.webhook_rejected") return t("routineActivityRow.checkTheKeyInYour");
  if (!details) return "";
  if (typeof details.changeSummary === "string") return details.changeSummary;
  if (event.action === "routine.run_triggered") {
    const sourceLabel =
      details.source === "webhook"
        ? t("routineActivityRow.webhook")
        : details.source === "schedule"
          ? t("routineActivityRow.schedule")
          : t("common.manual");
    const statusLabel =
      details.status === "issue_created"
        ? t("routineActivityRow.taskCreated")
        : String(details.status ?? "").replaceAll("_", " ");
    return `${sourceLabel} · ${statusLabel}`;
  }
  return Object.entries(details).filter(([key]) => !/id$/i.test(key)).slice(0, 3)
    .map(([key, value]) => `${key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").toLowerCase()}: ${formatDetailValue(value)}`)
    .join(" · ");
}

function formatDetailValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "[]" : value.map(formatDetailValue).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

const actionLabels: Record<string, string> = {
  "routine.webhook_test_received": t("routineActivityRow.connectionTestPassed"),
  "routine.webhook_test_rejected": t("routineActivityRow.connectionTestRejected"),
  "routine.webhook_received": t("routineActivityRow.webhookEventReceived"),
  "routine.webhook_rejected": t("routineActivityRow.webhookAuthenticationFailed"),
  "routine.created": t("routineActivityRow.routineCreated"), "routine.updated": t("routineActivityRow.routineUpdated"),
  "routine.trigger_created": t("routineActivityRow.triggerAdded"), "routine.trigger_updated": t("routineActivityRow.triggerUpdated"),
  "routine.trigger_deleted": t("routineActivityRow.triggerRemoved"), "routine.trigger_removed": t("routineActivityRow.triggerRemoved"), "routine.trigger_restored": t("routineActivityRow.triggerRestored"), "routine.trigger_setup_finished": t("routineActivityRow.webhookSetupFinished"), "routine.trigger_secret_rotated": t("routineActivityRow.webhookKeyReplaced"),
  "routine.run_triggered": t("routineActivityRow.routineStarted"), "routine.run_created": t("routineActivityRow.runCreated"),
};
function actionLabel(action: string) {
  return actionLabels[action] ?? action.replace(/^routine[._]/, "").replaceAll("_", " ").replaceAll(".", " ").replace(/^./, (char) => char.toUpperCase());
}

/** Activity log row with an expandable JSON payload (§3.7). */
export function RoutineActivityRow({ event }: { event: RoutineActivityEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = event.details != null && Object.keys(event.details).length > 0;

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        disabled={!hasPayload}
        aria-expanded={hasPayload ? expanded : undefined}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          "flex min-w-0 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs whitespace-nowrap",
          hasPayload ? "hover:bg-accent/30" : "cursor-default",
        )}
      >
        <span className="w-16 shrink-0 whitespace-nowrap font-mono tabular-nums text-muted-foreground">
          {formatTime(event.createdAt)}
        </span>
        <span title={event.action} className="min-w-0 max-w-1/2 shrink-0 truncate font-medium text-foreground">
          {actionLabel(event.action)}
        </span>
        <span title={summarizeEvent(event)} className="min-w-0 flex-1 truncate text-muted-foreground">
          {summarizeEvent(event)}
        </span>
        {hasPayload ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
        ) : null}
      </button>
      {expanded && hasPayload ? (
        <pre className="mx-2 mb-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
          {JSON.stringify(event.details, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
