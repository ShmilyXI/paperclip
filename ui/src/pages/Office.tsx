import { useCallback } from "react";

import { t } from "@/i18n";
import { useDialogActions } from "@/context/DialogContext";
import { useNavigate } from "@/lib/router";
import { EmbeddedSite } from "./EmbeddedSite";

/** MOWA AI 工作室: the public 3D office (workspace/office, hosted on tx-cn). */
export const OFFICE_URL = "https://ai-opc-office.culud.com";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// Only these Paperclip pages may be opened by the office (task, approval, chat, new-task dialog).
const OPEN_PATH = new RegExp(`^/(?:(?:issues|approvals|chats)/[A-Za-z0-9_-]{1,64}|dashboard\\?newTask=1(?:&assignee=(${UUID}))?)$`, "i");

export type OfficeAction =
  | { kind: "navigate"; to: string }
  | { kind: "newTask"; assigneeAgentId?: string };

/** Validates the office's "open this Paperclip page" message; anything else is ignored. */
export function parseOfficeMessage(data: unknown): OfficeAction | null {
  if (!data || typeof data !== "object") return null;
  const { type, path } = data as { type?: unknown; path?: unknown };
  if (type !== "mowa-office:open" || typeof path !== "string" || path.length > 200) return null;
  const match = OPEN_PATH.exec(path);
  if (!match) return null;
  if (path.startsWith("/dashboard")) return { kind: "newTask", ...(match[1] ? { assigneeAgentId: match[1] } : {}) };
  return { kind: "navigate", to: path };
}

export function Office() {
  const navigate = useNavigate();
  const { openNewIssue } = useDialogActions();
  const onFrameMessage = useCallback(
    (data: unknown) => {
      const action = parseOfficeMessage(data);
      if (!action) return;
      if (action.kind === "navigate") navigate(action.to);
      else openNewIssue(action.assigneeAgentId ? { assigneeAgentId: action.assigneeAgentId } : {});
    },
    [navigate, openNewIssue],
  );
  return <EmbeddedSite pageKey="office" title={t("nav.office")} url={OFFICE_URL} onFrameMessage={onFrameMessage} />;
}
