import { describe, expect, it } from "vitest";
import {
  classifyOpenCodeModelFailure,
  describeOpenCodeModelFailureKind,
} from "./model-failure.js";

describe("classifyOpenCodeModelFailure", () => {
  it("classifies network errors", () => {
    expect(classifyOpenCodeModelFailure("fetch failed", "")).toBe("network");
    expect(classifyOpenCodeModelFailure("connect ECONNREFUSED 127.0.0.1:443", "")).toBe("network");
    expect(classifyOpenCodeModelFailure("", "Error: ETIMEDOUT")).toBe("network");
    expect(classifyOpenCodeModelFailure("getaddrinfo ENOTFOUND api.example.com", "")).toBe("network");
    expect(classifyOpenCodeModelFailure("socket hang up", "")).toBe("network");
  });

  it("classifies rate limit responses", () => {
    expect(classifyOpenCodeModelFailure("429 Too Many Requests", "")).toBe("rate_limit");
    expect(classifyOpenCodeModelFailure("Rate limit exceeded for requests", "")).toBe("rate_limit");
    expect(classifyOpenCodeModelFailure("quota exceeded: requests per minute", "")).toBe("rate_limit");
  });

  it("classifies quota exhaustion", () => {
    expect(classifyOpenCodeModelFailure("insufficient_user_quota: balance is not enough", "")).toBe("quota_exhausted");
    expect(classifyOpenCodeModelFailure("You exceeded your current quota, please add credits", "")).toBe("quota_exhausted");
    expect(classifyOpenCodeModelFailure("quota exceeded for this API key", "")).toBe("quota_exhausted");
    expect(classifyOpenCodeModelFailure("账户余额不足，请充值", "")).toBe("quota_exhausted");
    expect(classifyOpenCodeModelFailure("402 Payment Required", "")).toBe("quota_exhausted");
  });

  it("classifies provider server errors", () => {
    expect(classifyOpenCodeModelFailure("502 Bad Gateway", "")).toBe("server_error");
    expect(classifyOpenCodeModelFailure("Service Unavailable", "")).toBe("server_error");
    expect(classifyOpenCodeModelFailure("The server had an error while processing (internal server error)", "")).toBe("server_error");
    expect(classifyOpenCodeModelFailure("overloaded_error", "")).toBe("server_error");
  });

  it("reads the raw stderr channel too", () => {
    expect(classifyOpenCodeModelFailure(null, "upstream request failed: 500")).toBe("server_error");
  });

  it("does not match 5xx inside longer digit runs", () => {
    expect(classifyOpenCodeModelFailure("processed 123529 tokens", "")).toBeNull();
  });

  it("returns null for non-model failures", () => {
    expect(classifyOpenCodeModelFailure("unknown session", "")).toBeNull();
    expect(classifyOpenCodeModelFailure("Unauthorized", "")).toBeNull();
    expect(classifyOpenCodeModelFailure("Tool execution failed: file not found", "")).toBeNull();
    expect(classifyOpenCodeModelFailure("", "")).toBeNull();
    expect(classifyOpenCodeModelFailure(null, null)).toBeNull();
    expect(classifyOpenCodeModelFailure(undefined, undefined)).toBeNull();
  });
});

describe("describeOpenCodeModelFailureKind", () => {
  it("labels every kind", () => {
    expect(describeOpenCodeModelFailureKind("network")).toBe("network error");
    expect(describeOpenCodeModelFailureKind("rate_limit")).toBe("rate limit (429)");
    expect(describeOpenCodeModelFailureKind("quota_exhausted")).toBe("quota exhausted");
    expect(describeOpenCodeModelFailureKind("server_error")).toBe("provider server error (5xx)");
  });
});
