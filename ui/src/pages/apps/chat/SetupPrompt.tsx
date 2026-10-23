import { t } from "@/i18n";

export { AgentSetupPrompt as SetupPrompt } from "@/components/AgentSetupPrompt";

export function buildSetupPrompt(instanceUrl: string, instructions: string) {
  let instanceOrigin: string | null = null;
  try {
    const url = new URL(instanceUrl);
    if (url.protocol === "http:" || url.protocol === "https:") instanceOrigin = url.origin;
  } catch {
    // A preview can have no configured instance. Do not substitute its own URL.
  }
  const context = instanceOrigin
    ? `${t("setupPrompt.instanceUrlContext", { origin: instanceOrigin })}\n${t("setupPrompt.instanceUrlUsage")}`
    : t("setupPrompt.instanceUrlUnavailable");
  return `${context}\n\n${instructions}`;
}
