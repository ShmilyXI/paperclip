import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { apiErrorMessage, classifyError, describeError, errorCopy, isConnectivityError } from "@/api/errors";
import { ApiUnavailableError } from "@/api/response";
import { ConnectionStatusMessage, pendingWritesCopy } from "./ConnectionStatusBanner";
import { QueryErrorState, QueryPlaceholder, QueryStaleHint, queryViewKind } from "./QueryView";

const originalLanguage = i18n.language;

beforeEach(async () => { await i18n.changeLanguage("zh-CN"); });
afterEach(async () => { await i18n.changeLanguage(originalLanguage); });

describe("shared error localization for the upstream sync", () => {
  it("reads copy in the current language instead of capturing it at module load", async () => {
    const outage = new ApiUnavailableError(502);
    expect(describeError(outage)).toEqual({
      title: "连接中断",
      body: "Paperclip 暂时不可用，请稍后重试。",
      retryable: true,
    });
    expect(errorCopy("tenant_app_unavailable").title).toBe("正在重新连接 Paperclip");
    await i18n.changeLanguage("en");
    expect(describeError(outage).title).toBe("Connection interrupted");
    expect(errorCopy("tenant_app_unavailable").title).toBe("Reconnecting to Paperclip");
  });

  it("accepts both known English actions and already-localized actions", () => {
    expect(describeError({ status: 500 }, { action: "load this task" }).title).toBe("无法加载此任务");
    expect(describeError({ status: 500 }, { action: "load the skill" }).title).toBe("无法加载技能");
    expect(describeError({ status: 500 }, { action: "加载此智能体的产物" }).title).toBe("无法加载此智能体的产物");
  });

  it("uses a localized generic title for an unknown English action", async () => {
    expect(describeError({ status: 500 }, { action: "frobnicate the widget" }).title).toBe("操作失败");
    await i18n.changeLanguage("en");
    expect(describeError({ status: 500 }, { action: "frobnicate the widget" }).title).toBe("Couldn't frobnicate the widget");
  });

  it("preserves server messages and filters the original English outage sentinel", () => {
    const message = "Document is locked by Alice";
    expect(apiErrorMessage(409, { error: message })).toBe(message);
    expect(describeError({ status: 409, body: { message } }).body).toBe(message);
    expect(describeError(new Error("Paperclip is temporarily unavailable. Please try again in a moment.")).body)
      .toBe("发生意外错误，请重试。");
    expect(apiErrorMessage(503, { error: "tenant_app_unavailable" })).toBe("Paperclip 正在重启或更新，请稍后重试。");
  });

  it("never uses translated copy to determine classification or query state", async () => {
    const cases = [
      { error: { status: 404, body: { error: "tenant_app_unavailable" } }, kind: "transient", connectivity: true },
      { error: { status: 503, body: { code: "WORKER_UNAVAILABLE" } }, kind: "transient", connectivity: false },
      { error: { status: 403, message: "连接中断" }, kind: "forbidden", connectivity: false },
      { error: new Error("Paperclip 暂时不可用，请稍后重试。"), kind: "unknown", connectivity: false },
      { error: new TypeError("Failed to fetch"), kind: "transient", connectivity: true },
      { error: new ApiUnavailableError(200), kind: "transient", connectivity: true },
    ];
    for (const locale of ["en", "zh-CN"]) {
      await i18n.changeLanguage(locale);
      for (const { error, kind, connectivity } of cases) {
        expect(classifyError(error)).toBe(kind);
        expect(isConnectivityError(error)).toBe(connectivity);
        expect(queryViewKind({ data: 1, error, status: "error", fetchStatus: "idle" }))
          .toBe(kind === "transient" ? "stale" : "error");
      }
    }
  });

  it("localizes retry controls without changing retry permissions", () => {
    const retry = renderToStaticMarkup(<QueryErrorState error={{ status: 500 }} action="load this task" onRetry={() => {}} />);
    expect(retry).toContain("无法加载此任务");
    expect(retry).toContain("发生意外错误，请重试。");
    expect(retry).toContain(">重试</button>");
    const retrying = renderToStaticMarkup(<QueryErrorState error={{ status: 500 }} onRetry={() => {}} retrying />);
    expect(retrying).toContain("正在重试…");
    expect(retrying).toContain("disabled");
    for (const status of [401, 403, 404]) {
      expect(renderToStaticMarkup(<QueryErrorState error={{ status }} onRetry={() => {}} />)).not.toContain("<button");
    }
  });

  it("localizes placeholders while retaining caller-provided labels", () => {
    expect(renderToStaticMarkup(<QueryPlaceholder />)).toContain('aria-label="正在加载"');
    expect(renderToStaticMarkup(<QueryPlaceholder label="Custom label" />)).toContain('aria-label="Custom label"');
    expect(renderToStaticMarkup(<QueryStaleHint />)).toContain("正在重新连接，更新已暂停…");
  });

  it("localizes all banner states and pending write counts", () => {
    expect(pendingWritesCopy(0)).toBeNull();
    expect(pendingWritesCopy(1)).toBe("网络恢复后将发送 1 项更改。");
    expect(pendingWritesCopy(3)).toBe("网络恢复后将发送 3 项更改。");
    expect(renderToStaticMarkup(<ConnectionStatusMessage view="offline" pendingWrites={3} />))
      .toContain("网络已断开，网络恢复后将重新连接…");
    expect(renderToStaticMarkup(<ConnectionStatusMessage view="reconnecting" />))
      .toContain("连接中断，正在自动重新连接…");
    const recovered = renderToStaticMarkup(<ConnectionStatusMessage view="back_online" pendingWrites={3} />);
    expect(recovered).toContain("连接已恢复。");
    expect(recovered).not.toContain("3 项更改");
  });
});
