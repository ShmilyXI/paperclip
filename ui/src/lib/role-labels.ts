import { AGENT_ROLE_LABELS, type AgentRole } from "@paperclipai/shared";
import { t } from "@/i18n";

/** Display names for agent roles in the current UI language (English keeps the shared labels). */
export const localizedRoleLabels: Record<string, string> = Object.fromEntries(
  (Object.keys(AGENT_ROLE_LABELS) as AgentRole[]).map((role) => [
    role,
    t(`roles.${role}`, { defaultValue: AGENT_ROLE_LABELS[role] }),
  ]),
);
