import { DEFAULT_LOCALE_PREFERENCE } from "./locale-constants";

export const LOCALE_STORAGE_KEY = "paperclip.locale";

export function readStoredLocale(supported: readonly string[]): string {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && supported.includes(stored)) return stored;
  } catch {
    // localStorage can be unavailable (private mode, blocked storage).
  }
  return DEFAULT_LOCALE_PREFERENCE;
}

export function writeStoredLocale(locale: string) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Preference simply won't persist.
  }
}
