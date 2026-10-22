/** Locale shown when the user has not picked one. */
export const DEFAULT_LOCALE_PREFERENCE = "zh-CN";

/** Locales that ship complete translations and are offered in the language switcher. */
export const SELECTABLE_LOCALES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "en", label: "English" },
] as const;
