import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { DEFAULT_LOCALE, i18nextResources, supportedLocales } from "./locales";
import { readStoredLocale, writeStoredLocale } from "./locale-preference";

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: readStoredLocale(supportedLocales),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

export function changeLocale(locale: string) {
  writeStoredLocale(locale);
  void i18n.changeLanguage(locale);
  // Module-level constants call t() once at load time, so reload to re-evaluate them.
  if (typeof window !== "undefined" && window.location) window.location.reload();
}

/** BCP-47 locale for Intl/toLocale*String formatting that follows the UI language. */
export function dateLocale() {
  return i18n.language === "en" ? "en-US" : i18n.language;
}

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export const useTranslation = useReactI18nextTranslation;
export { i18n };

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language;
  i18n.on("languageChanged", (lng) => {
    document.documentElement.lang = lng;
  });
}
