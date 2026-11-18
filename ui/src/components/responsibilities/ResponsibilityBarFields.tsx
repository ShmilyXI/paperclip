import { t } from "@/i18n";
import type { ReactNode } from "react";
import type { ResponsibilityMetricDirection, ResponsibilityMetricKind } from "@paperclipai/shared";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  describeDraftStatusRule,
  METRIC_DIRECTION_OPTIONS,
  METRIC_KIND_OPTIONS,
  type BarDraft,
  type BarField,
} from "@/lib/responsibilities";

function Field({
  label,
  hint,
  optional,
  error,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> {t("secrets.optional")}</span> : null}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

/**
 * The bar of a responsibility: the sentence, the kind of measure (its
 * template), what is measured and that template's own inputs (a direction and
 * target, a low and a high bound, or nothing for a yes or no), and
 * (optionally) a current reading, with one line on how status will be read.
 * Shared by adding a responsibility, adjusting a proposal and editing the bar.
 */
export function ResponsibilityBarFields({
  draft,
  onChange,
  missing,
  invalid,
  problems,
  showCurrent = false,
}: {
  draft: BarDraft;
  onChange: (next: BarDraft) => void;
  /** Required fields left blank, shown once the person tries to save. */
  missing?: ReadonlySet<BarField>;
  /** Number fields that are not numbers, or break the template's rules. */
  invalid?: ReadonlySet<BarField>;
  /** What is wrong with an invalid field, when it is more than "Enter a number". */
  problems?: Partial<Record<BarField, string>>;
  showCurrent?: boolean;
}) {
  const set = (patch: Partial<BarDraft>) => onChange({ ...draft, ...patch });
  const errorFor = (field: BarField, required: string) =>
    missing?.has(field) ? required : invalid?.has(field) ? problems?.[field] ?? t("responsibilities.enterANumber") : null;
  const kind = draft.metricKind;
  const template = METRIC_KIND_OPTIONS.find((option) => option.value === kind);
  const rule = describeDraftStatusRule(draft);
  const numberInput = (field: "metricTarget" | "metricLow" | "metricHigh", placeholder: string) => (
    <Input
      inputMode="decimal"
      value={draft[field]}
      placeholder={placeholder}
      aria-invalid={missing?.has(field) || invalid?.has(field) || undefined}
      onChange={(event) => set({ [field]: event.target.value })}
    />
  );
  const unitField = (
    <Field label={t("responsibilities.unit")} optional>
      <Input
        value={draft.metricUnit}
        maxLength={40}
        placeholder={kind === "range" ? t("responsibilities.unitRangePlaceholder") : t("responsibilities.unitDefaultPlaceholder")}
        onChange={(event) => set({ metricUnit: event.target.value })}
      />
    </Field>
  );
  const directionField = (
    <Field label={t("responsibilities.betterWhenItIs")}>
      <NativeSelect
        value={draft.metricDirection}
        aria-label={t("responsibilities.betterWhenItIs")}
        onChange={(event) => set({ metricDirection: event.target.value as ResponsibilityMetricDirection })}
      >
        {METRIC_DIRECTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </NativeSelect>
    </Field>
  );
  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t("responsibilities.theBar")}
        hint={t("responsibilities.howIsSuccessMeasuredHint")}
        error={errorFor("standard", t("responsibilities.describeTheBar"))}
      >
        <Textarea
          rows={2}
          value={draft.standard}
          placeholder={t("responsibilities.theBarPlaceholder")}
          aria-invalid={missing?.has("standard") || undefined}
          onChange={(event) => set({ standard: event.target.value })}
        />
      </Field>
      <Field label={t("responsibilities.kindOfMeasure")} hint={template?.summary}>
        <NativeSelect
          value={kind}
          aria-label={t("responsibilities.kindOfMeasure")}
          onChange={(event) => set({ metricKind: event.target.value as ResponsibilityMetricKind, metricCurrent: "" })}
        >
          {METRIC_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label={kind === "yes_no" ? t("responsibilities.whatShouldBeTrue") : t("responsibilities.whatYouMeasure")}
        error={errorFor("metricName", kind === "yes_no" ? t("responsibilities.sayWhatShouldBeTrue") : t("responsibilities.nameWhatYouMeasure"))}
      >
        <Input
          value={draft.metricName}
          maxLength={200}
          placeholder={kind === "yes_no" ? t("responsibilities.metricNameYesNoPlaceholder") : kind === "range" ? t("responsibilities.metricNameRangePlaceholder") : t("responsibilities.metricNameDefaultPlaceholder")}
          aria-invalid={missing?.has("metricName") || undefined}
          onChange={(event) => set({ metricName: event.target.value })}
        />
      </Field>
      {kind === "volume" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {directionField}
          <Field label={t("common.target")} error={errorFor("metricTarget", t("responsibilities.setATarget"))}>{numberInput("metricTarget", t("responsibilities.exampleValue", { value: "20" }))}</Field>
          {unitField}
        </div>
      ) : kind === "percentage" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {directionField}
          <Field label={t("responsibilities.targetPercent")} error={errorFor("metricTarget", t("responsibilities.setATarget"))}>{numberInput("metricTarget", t("responsibilities.exampleValue", { value: "90" }))}</Field>
        </div>
      ) : kind === "range" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("common.low")} error={errorFor("metricLow", t("responsibilities.setTheLowBound"))}>{numberInput("metricLow", t("responsibilities.exampleValue", { value: "12" }))}</Field>
          <Field label={t("common.high")} error={errorFor("metricHigh", t("responsibilities.setTheHighBound"))}>{numberInput("metricHigh", t("responsibilities.exampleValue", { value: "24" }))}</Field>
          {unitField}
        </div>
      ) : null}
      {rule ? <p className="text-xs text-muted-foreground" data-testid="bar-status-rule">{rule}.</p> : null}
      {showCurrent ? (
        kind === "yes_no" ? (
          <Field label={t("responsibilities.whereItIsNow")} optional hint={t("responsibilities.isItTrueTodayHint")}>
            <NativeSelect
              value={draft.metricCurrent}
              aria-label={t("responsibilities.whereItIsNow")}
              onChange={(event) => set({ metricCurrent: event.target.value })}
            >
              <option value="">{t("responsibilities.notKnownYet")}</option>
              <option value="yes">{t("common.yes")}</option>
              <option value="no">{t("common.no")}</option>
            </NativeSelect>
          </Field>
        ) : (
          <Field
            label={t("responsibilities.whereItIsNow")}
            optional
            hint={t("responsibilities.latestReadingHint")}
            error={errorFor("metricCurrent", "")}
          >
            <Input
              inputMode="decimal"
              value={draft.metricCurrent}
              placeholder={kind === "percentage" ? t("responsibilities.exampleValue", { value: "85" }) : t("responsibilities.exampleValue", { value: "9" })}
              aria-invalid={invalid?.has("metricCurrent") || undefined}
              onChange={(event) => set({ metricCurrent: event.target.value })}
            />
          </Field>
        )
      ) : null}
    </div>
  );
}
