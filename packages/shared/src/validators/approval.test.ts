import { describe, expect, it } from "vitest";
import {
  addApprovalCommentSchema,
  createApprovalSchema,
  requestApprovalRevisionSchema,
  resolveApprovalSchema,
  resubmitApprovalSchema,
} from "./approval.js";

describe("approval validators", () => {
  it("passes real line breaks through unchanged", () => {
    expect(addApprovalCommentSchema.parse({ body: "Looks good\n\nApproved." }).body)
      .toBe("Looks good\n\nApproved.");
    expect(resolveApprovalSchema.parse({ decisionNote: "Decision\n\nApproved." }).decisionNote)
      .toBe("Decision\n\nApproved.");
  });

  it("accepts null and omitted optional decision notes", () => {
    expect(resolveApprovalSchema.parse({ decisionNote: null }).decisionNote).toBeNull();
    expect(resolveApprovalSchema.parse({}).decisionNote).toBeUndefined();
    expect(requestApprovalRevisionSchema.parse({ decisionNote: null }).decisionNote).toBeNull();
    expect(requestApprovalRevisionSchema.parse({}).decisionNote).toBeUndefined();
  });

  it("normalizes escaped line breaks in approval comments and decision notes", () => {
    expect(addApprovalCommentSchema.parse({ body: "Looks good\\n\\nApproved." }).body)
      .toBe("Looks good\n\nApproved.");
    expect(resolveApprovalSchema.parse({ decisionNote: "Decision\\n\\nApproved." }).decisionNote)
      .toBe("Decision\n\nApproved.");
    expect(requestApprovalRevisionSchema.parse({ decisionNote: "Decision\\r\\nRevise." }).decisionNote)
      .toBe("Decision\nRevise.");
  });
});

describe("createApprovalSchema", () => {
  const base = {
    type: "request_board_approval" as const,
    payload: { title: "发布确认", reviewDoc: "MOW-731" },
  };

  it("keeps top-level media/attachments instead of silently stripping them", () => {
    const parsed = createApprovalSchema.parse({
      ...base,
      media: ["/paperclip/assets/a/card_1.png", "/paperclip/assets/a/card_2.png"],
      attachments: "/paperclip/assets/a/video.mp4",
    });
    expect(parsed.media).toEqual(["/paperclip/assets/a/card_1.png", "/paperclip/assets/a/card_2.png"]);
    expect(parsed.attachments).toEqual("/paperclip/assets/a/video.mp4");
  });

  it("still accepts the legacy nested payload.media form", () => {
    const parsed = createApprovalSchema.parse({
      ...base,
      payload: { ...base.payload, media: ["/paperclip/assets/a/card_1.png"] },
    });
    expect(parsed.payload.media).toEqual(["/paperclip/assets/a/card_1.png"]);
    expect(parsed.media).toBeUndefined();
  });
});

describe("resubmitApprovalSchema", () => {
  it("keeps top-level media/attachments on resubmit", () => {
    const parsed = resubmitApprovalSchema.parse({
      payload: { title: "第 2 版" },
      media: ["/paperclip/assets/a/card_1.png"],
    });
    expect(parsed.media).toEqual(["/paperclip/assets/a/card_1.png"]);
    expect(parsed.payload).toEqual({ title: "第 2 版" });
  });
});
