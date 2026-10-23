import { t } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brandChipBadge, type BrandChipColor } from "@/lib/status-colors";

/**
 * The load-bearing visual grammar for the built-in bundle status panel
 * (Reflection Coach — [PAP-13099], ux-spec §4). Each variant double-encodes
 * state as glyph + word + color so it never relies on color alone
 * (WCAG 1.4.1). Colors route through the shared `brandChipBadge` families — no
 * bespoke tints are minted here (ux-spec §10).
 *
 * A single resource shows at most one readiness chip and at most one drift
 * chip; when both a readiness problem and a drift state coexist, the caller
 * suppresses the drift chip until readiness is `ready` (ux-spec §4).
 */
export type ResourceStatusVariant =
  | "ready"
  | "needs_setup"
  | "missing"
  | "error"
  | "update_available"
  | "drifted"
  | "schedule_off"
  | "schedule_on"
  | "pending_approval"
  | "proposal_pending";

interface VariantSpec {
  color: BrandChipColor;
  glyph: string;
  label: string;
  title: string;
}

const VARIANTS: Record<ResourceStatusVariant, VariantSpec> = {
  ready: { color: "green", glyph: "●", label: t("resourceStatusChip.ready"), title: t("resourceStatusChip.materializedAndMatchesTheShipped") },
  needs_setup: { color: "amber", glyph: "⚠", label: t("resourceStatusChip.needsSetup"), title: t("resourceStatusChip.presentButNotUsableYet") },
  missing: { color: "amber", glyph: "⚠", label: t("resourceStatusChip.missing"), title: t("resourceStatusChip.expectedResourceAbsentReconcileWill") },
  error: { color: "red", glyph: "✕", label: t("common.error"), title: t("resourceStatusChip.failedToLoadOrReconcile") },
  update_available: {
    color: "blue",
    glyph: "↑",
    label: t("resourceStatusChip.updateAvailable"),
    title: t("resourceStatusChip.uneditedANewerShippedDefault"),
  },
  drifted: {
    color: "gray",
    glyph: "✎",
    label: t("resourceStatusChip.drifted"),
    title: t("resourceStatusChip.youVeEditedThisYour"),
  },
  schedule_off: {
    color: "gray",
    glyph: "◌",
    label: t("resourceStatusChip.scheduleOff"),
    title: t("resourceStatusChip.noBackgroundWorkRunsUntil"),
  },
  schedule_on: { color: "green", glyph: "●", label: t("common.weekly"), title: t("resourceStatusChip.runsOnTheWeeklySchedule") },
  pending_approval: {
    color: "amber",
    glyph: "⚠",
    label: t("common.pendingApproval"),
    title: t("resourceStatusChip.waitingOnBoardHireApproval"),
  },
  proposal_pending: {
    color: "blue",
    glyph: "↑",
    label: t("resourceStatusChip.proposalPending"),
    title: t("resourceStatusChip.aProposedUpdateIsWaiting"),
  },
};

export function ResourceStatusChip({
  variant,
  label,
  compact = false,
  className,
}: {
  variant: ResourceStatusVariant;
  /** Override the default label (e.g. "Weekly · Mon 09:00 UTC"). */
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const spec = VARIANTS[variant];
  return (
    <Badge
      variant="outline"
      className={cn(
        brandChipBadge[spec.color],
        "font-medium",
        compact && "px-1.5 py-0 text-(length:--text-nano)",
        className,
      )}
      title={spec.title}
    >
      <span aria-hidden="true">{spec.glyph}</span>
      {label ?? spec.label}
    </Badge>
  );
}
