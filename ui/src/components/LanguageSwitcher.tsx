import { Languages } from "lucide-react";

import { cn } from "@/lib/utils";
import { changeLocale, useTranslation, t } from "@/i18n";
import { SELECTABLE_LOCALES } from "@/i18n/locale-constants";

interface LanguageSwitcherProps {
  className?: string;
  onAfterChange?: () => void;
}

/** Account-menu row that toggles between the shipped, fully translated locales. */
export function LanguageSwitcher({ className, onAfterChange }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const current = i18n.language;
  const next = SELECTABLE_LOCALES.find((locale) => locale.code !== current) ?? SELECTABLE_LOCALES[0];
  const currentLabel = SELECTABLE_LOCALES.find((locale) => locale.code === current)?.label ?? current;

  return (
    <button
      type="button"
      className={cn(
        "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground transition-colors hover:bg-accent",
        className,
      )}
      onClick={() => {
        changeLocale(next.code);
        onAfterChange?.();
      }}
      aria-label={t("language.switchTo", { language: next.label })}
    >
      <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        <Languages className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{t("language.label")}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{currentLabel}</span>
    </button>
  );
}
