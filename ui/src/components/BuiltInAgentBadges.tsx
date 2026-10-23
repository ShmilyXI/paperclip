import { t } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brandChipBadge } from "@/lib/status-colors";
import type { BuiltInAgentStatus } from "@/api/builtInAgents";

/**
 * Derived lifecycle chip. Rendered for the amber attention states
 * (`needs_setup`, `pending_approval`). Kept separate from the real agent status
 * (`idle/active/…`) per ux-spec D1.
 */
export function BuiltInLifecycleChip({
  status,
  compact = false,
  className,
}: {
  status: BuiltInAgentStatus;
  compact?: boolean;
  className?: string;
}) {
  if (status !== "needs_setup" && status !== "pending_approval") return null;
  const isPendingApproval = status === "pending_approval";
  return (
    <Badge
      variant="outline"
      className={cn(
        brandChipBadge.amber,
        compact && "px-1.5 py-0 text-(length:--text-nano)",
        className,
      )}
      title={
        isPendingApproval
          ? t("builtInAgentBadges.waitingOnBoardHireApproval")
          : t("builtInAgentBadges.needsAdapterModelSetupBefore")
      }
    >
      {isPendingApproval ? (compact ? t("common.approval") : t("common.pendingApproval")) : compact ? t("builtInAgentBadges.setup") : t("builtInAgentBadges.needsSetup")}
    </Badge>
  );
}
