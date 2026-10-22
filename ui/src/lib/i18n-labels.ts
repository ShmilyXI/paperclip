import { i18n, t } from "@/i18n";

function humanize(value: string, titleCase: boolean) {
  const spaced = value.replace(/_/g, " ");
  return titleCase ? spaced.replace(/\b\w/g, (c) => c.toUpperCase()) : spaced;
}

function translated(group: string, value: string | null | undefined, titleCase: boolean): string {
  if (!value) return "";
  const key = `labels.${group}.${value}`;
  // English keeps the original humanized rendering so existing wording/capitalization is unchanged.
  if (i18n.language !== "en" && i18n.exists(key)) return t(key);
  return humanize(value, titleCase);
}

/** Display label for a status value (issue, agent, run, approval...). Unknown values fall back to a humanized form. */
export function statusLabel(status: string | null | undefined, titleCase = false): string {
  if (status && i18n.language !== "en" && !i18n.exists(`labels.status.${status}`) && i18n.exists(`labels.priority.${status}`)) {
    return translated("priority", status, titleCase);
  }
  return translated("status", status, titleCase);
}

/** Display label for an issue priority. */
export function priorityLabel(priority: string | null | undefined, titleCase = false): string {
  return translated("priority", priority, titleCase);
}
