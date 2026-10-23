import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

vi.mock("@paperclipai/adapter-utils/execution-target", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, runAdapterExecutionTargetProcess: vi.fn() };
});

import { execute } from "./execute.js";
import { runAdapterExecutionTargetProcess } from "@paperclipai/adapter-utils/execution-target";
import { createPromptContextFixture } from "@paperclipai/adapter-utils/test-fixtures/prompt-context";

const runProcessMock = vi.mocked(runAdapterExecutionTargetProcess);

function probeResult(overrides: Record<string, unknown>) {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    stdout: "",
    stderr: "",
    pid: 123,
    startedAt: new Date().toISOString(),
    ...overrides,
  } as never;
}

function providerErrorResult(message: string) {
  return probeResult({
    exitCode: 1,
    stdout: JSON.stringify({ type: "error", error: message }),
  });
}

function successResult(text: string, sessionId: string) {
  return probeResult({
    stdout: JSON.stringify({ type: "text", sessionID: sessionId, part: { text } }),
  });
}

describe("OpenCode model fallback", () => {
  let configHome: string;

  beforeEach(async () => {
    configHome = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-fallback-"));
    vi.stubEnv("XDG_CONFIG_HOME", configHome);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(configHome, { recursive: true, force: true });
  });

  function baseExecuteCall(configOverrides: Record<string, unknown> = {}) {
    const commandPath = path.join(configHome, "fake-opencode");
    return {
      runId: "run-fallback",
      agent: { id: "agent-1", companyId: "company-1", name: "OpenCode", adapterType: "opencode_local", adapterConfig: {} },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: {
        command: commandPath,
        cwd: configHome,
        model: "primary/provider-1",
        env: { OPENCODE_ALLOW_ALL_MODELS: "1" },
        ...configOverrides,
      },
      context: createPromptContextFixture(),
      onLog: async () => {},
    };
  }

  it("retries once with the fallback model when the primary model hits a 429", async () => {
    await fs.writeFile(path.join(configHome, "fake-opencode"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const logs: string[] = [];
    runProcessMock
      .mockReset()
      .mockResolvedValueOnce(providerErrorResult("429 Too Many Requests"))
      .mockResolvedValueOnce(successResult("done via backup", "session-fallback"));
    const result = await execute({
      ...baseExecuteCall({ fallbackModel: "backupco/backup-1" }),
      onLog: async (stream, chunk) => {
        logs.push(`${stream}:${chunk}`);
      },
    });
    expect(runProcessMock).toHaveBeenCalledTimes(2);
    const firstArgs = runProcessMock.mock.calls[0][3] as string[];
    const secondArgs = runProcessMock.mock.calls[1][3] as string[];
    expect(firstArgs).toContain("--model");
    expect(firstArgs[firstArgs.indexOf("--model") + 1]).toBe("primary/provider-1");
    expect(secondArgs[secondArgs.indexOf("--model") + 1]).toBe("backupco/backup-1");
    expect(result.exitCode).toBe(0);
    expect(result.errorMessage).toBeNull();
    expect(result.model).toBe("backupco/backup-1");
    expect(result.provider).toBe("backupco");
    expect(parseModelFallback(result.resultJson)).toEqual({
      from: "primary/provider-1",
      to: "backupco/backup-1",
      reason: "rate_limit",
    });
    expect(logs.join("\n")).toContain(`retrying once with fallback model "backupco/backup-1"`);
  });

  it("reports the fallback attempt's own failure when the backup also fails", async () => {
    await fs.writeFile(path.join(configHome, "fake-opencode"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    runProcessMock
      .mockReset()
      .mockResolvedValueOnce(providerErrorResult("502 Bad Gateway"))
      .mockResolvedValueOnce(providerErrorResult("connection refused by provider"));
    const result = await execute(baseExecuteCall({ fallbackModel: "backupco/backup-1" }));
    expect(runProcessMock).toHaveBeenCalledTimes(2);
    expect(result.exitCode).toBe(1);
    expect(result.model).toBe("backupco/backup-1");
    expect(String(result.errorMessage)).toContain("connection refused by provider");
    expect(parseModelFallback(result.resultJson)?.from).toBe("primary/provider-1");
  });

  it("does not retry when no fallback model is configured", async () => {
    await fs.writeFile(path.join(configHome, "fake-opencode"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    runProcessMock.mockReset().mockResolvedValueOnce(providerErrorResult("429 Too Many Requests"));
    const result = await execute(baseExecuteCall());
    expect(runProcessMock).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("primary/provider-1");
    expect(String(result.errorMessage)).toContain("429");
    expect(parseModelFallback(result.resultJson)).toBeUndefined();
  });

  it("does not retry for non-model failures even with a fallback configured", async () => {
    await fs.writeFile(path.join(configHome, "fake-opencode"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const logs: string[] = [];
    runProcessMock
      .mockReset()
      .mockResolvedValueOnce(providerErrorResult("Unauthorized"));
    const result = await execute({
      ...baseExecuteCall({ fallbackModel: "backupco/backup-1" }),
      onLog: async (stream, chunk) => {
        logs.push(`${stream}:${chunk}`);
      },
    });
    expect(runProcessMock).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("primary/provider-1");
    expect(logs.join("\n")).not.toContain("fallback model");
  });

  it("skips fallback for an invalid fallbackModel id and says so in the log", async () => {
    await fs.writeFile(path.join(configHome, "fake-opencode"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const logs: string[] = [];
    runProcessMock.mockReset().mockResolvedValueOnce(providerErrorResult("quota exceeded"));
    const result = await execute({
      ...baseExecuteCall({ fallbackModel: "no-slash-model-id" }),
      onLog: async (stream, chunk) => {
        logs.push(`${stream}:${chunk}`);
      },
    });
    expect(runProcessMock).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("primary/provider-1");
    expect(logs.join("\n")).toContain("adapterConfig.fallbackModel is not a usable fallback");
  });

  it("does not switch models on a timeout", async () => {
    await fs.writeFile(path.join(configHome, "fake-opencode"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    runProcessMock
      .mockReset()
      .mockResolvedValueOnce(probeResult({ timedOut: true, exitCode: null }));
    const result = await execute(baseExecuteCall({ fallbackModel: "backupco/backup-1" }));
    expect(runProcessMock).toHaveBeenCalledTimes(1);
    expect(result.timedOut).toBe(true);
    expect(result.model).toBe("primary/provider-1");
  });
});

function parseModelFallback(resultJson: Record<string, unknown> | null | undefined) {
  const value = resultJson?.modelFallback;
  return typeof value === "object" && value !== null ? value as { from: string; to: string; reason: string } : undefined;
}
