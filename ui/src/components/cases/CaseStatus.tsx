import { t } from "@/i18n";
import type { CaseStatus as CaseStatusValue } from "@/api/cases";
import { StatusBadge } from "@/components/StatusBadge";

export const CASE_STATUS_LABELS: Record<CaseStatusValue, string> = {
  draft: t("common.draft"),
  in_progress: t("common.inProgress"),
  in_review: t("common.inReview"),
  approved: t("common.approved"),
  done: t("common.done"),
  cancelled: t("common.cancelled"),
};

export function CaseStatus({ status, className }: { status: CaseStatusValue; className?: string }) {
  return <StatusBadge status={status} label={CASE_STATUS_LABELS[status]} className={className} />;
}
