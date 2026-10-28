import { t } from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectPopover } from "../../components/ui/select";
import { AdapterMark } from "../../components/AdapterMark";
import { MuseRunnerConnection } from "../../components/MuseRunnerConnection";
import { GrokBotConnection } from "../../components/GrokBotConnection";
import { DotRunnerConnection } from "../../components/DotRunnerConnection";
import { configFieldsForSection } from "../config-sections";
import type { AdapterConfigFieldsProps } from "../types";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { buildCodexLocalConfig } from "@paperclipai/adapter-codex-local/ui";
import {
  Field,
  ToggleField,
  DraftInput,
  DraftNumberInput,
  help,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";
import { LocalWorkspaceRuntimeFields } from "../local-workspace-runtime-fields";
import {
  DEFAULT_CODEX_LOCAL_MODEL,
  CODEX_LOCAL_FAST_MODE_SUPPORTED_MODELS,
  isCodexLocalFastModeSupported,
  isCodexLocalManualModel,
  resolveCodexLocalCliPolicy,
} from "@paperclipai/adapter-codex-local";
import {
  PAPERCLIP_RUNNER_IDLE_TIMEOUT_DEFAULT_MS,
  PAPERCLIP_RUNNER_IDLE_TIMEOUT_MAX_MS,
  PAPERCLIP_RUNNER_PERMISSION_CAPABILITIES,
  PAPERCLIP_RUNNER_ACPX_PROFILES,
  isPaperclipRunnerProvider,
  resolvePaperclipRunnerIdleTimeoutMs,
  resolvePaperclipRunnerPermissionMode,
  type PaperclipRunnerPermissionMode,
  type PaperclipRunnerPermissionCapability,
} from "@paperclipai/adapter-utils";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  t("codexLocal.instructionsFileHint");
const defaultOpenCodeRunnerModel = "openrouter/deepseek/deepseek-v4-flash-0731";
const defaultAcpxClaudeModel = "claude-opus-5-5";
const defaultClaudeManagedModel = "claude-sonnet-5";
const defaultAwsAgentCoreModel = "global.anthropic.claude-sonnet-4-6";
const runnerHarnessOptions = [
  { value: "codex", label: "Codex", adapter: "codex_local" },
  { value: "opencode", label: "OpenCode 1.18.34", adapter: "opencode_local" },
  { value: "claude_managed", label: "Claude Managed", adapter: "claude_local" },
  { value: "aws_agentcore", label: "AWS AgentCore", adapter: "aws_agentcore" },
  { value: "acpx", label: "ACP agents", adapter: "acpx_local" },
  { value: "grok", label: "Grok Build", adapter: "grok_local" },
];

export function buildCodexRunnerConfig(values: CreateConfigValues): Record<string, unknown> {
  const config = buildCodexLocalConfig(values);
  if (values.codexLegacySandboxBypass !== undefined) {
    config.dangerouslyBypassApprovalsAndSandbox = values.codexLegacySandboxBypass;
  } else if (values.runner !== "legacy") {
    delete config.dangerouslyBypassApprovalsAndSandbox;
  }
  return {
    ...config,
    ...(values.codexPermissionMode !== undefined ? { codexPermissionMode: values.codexPermissionMode } : {}),
    ...(values.paperclipRunnerLifecycleMode !== undefined ? { lifecycleMode: values.paperclipRunnerLifecycleMode } : {}),
    ...(values.paperclipRunnerIdleTimeoutMs !== undefined ? { idleTimeoutMs: values.paperclipRunnerIdleTimeoutMs } : {}),
  };
}

export function CodexLocalConfigFields({
  section,
  companyId,
  agentId,
  mode,
  isCreate,
  adapterType,
  values,
  set,
  config,
  eff,
  mark,
  models,
  hideInstructionsFile,
  managedSandboxOnly,
  hideRunnerHarness,
}: AdapterConfigFieldsProps) {
  const runnerManaged = adapterType === "paperclip_runner";
  // The execution engine picks which binary runs on the execution host, and the
  // ACP sub-fields below name host paths. The platform-managed environment owns
  // both, so the managed-sandbox-only policy hides them the same way
  // `runnerManaged` already does for the Paperclip Runner.
  const hideEngineChoice = runnerManaged || managedSandboxOnly === true;
  const configuredRunnerProvider = runnerManaged
    ? isCreate
      ? values!.adapterSchemaValues?.provider
      : eff("adapterConfig", "provider", config.provider === "acpx" && config.acpxAgent === "codex" ? "codex" : config.provider ?? "codex")
    : "codex";
  const runnerProvider = String(configuredRunnerProvider ?? "codex");
  const runnerPermissionCapability: PaperclipRunnerPermissionCapability =
    isPaperclipRunnerProvider(runnerProvider)
      ? PAPERCLIP_RUNNER_PERMISSION_CAPABILITIES[runnerProvider]
      : { configurable: false, defaultMode: "provider-managed", options: [], description: t("codexLocal.unknownProviderConfiguration") };
  const isMuse = runnerProvider === "muse";
  const isExternal = isMuse || runnerProvider === "openai_dot" || runnerProvider === "grok_bot";
  const configuredRunnerPermissionMode =
    runnerManaged && runnerPermissionCapability.configurable
      ? isCreate
        ? (values!.adapterSchemaValues?.[
            runnerPermissionCapability.configKey
          ] ??
          (runnerProvider === "codex"
            ? values!.codexPermissionMode
            : undefined))
        : eff(
            "adapterConfig",
            runnerPermissionCapability.configKey,
            config[runnerPermissionCapability.configKey],
          )
      : undefined;
  const runnerPermissionModeUnsupported =
    runnerManaged &&
    runnerPermissionCapability.configurable &&
    configuredRunnerPermissionMode !== undefined &&
    !runnerPermissionCapability.options.some(
      (option) => option.value === configuredRunnerPermissionMode,
    );
  const runnerPermissionMode =
    runnerManaged && runnerPermissionCapability.configurable
      ? resolvePaperclipRunnerPermissionMode(
          isPaperclipRunnerProvider(runnerProvider) ? runnerProvider : "codex",
          configuredRunnerPermissionMode,
        )
      : runnerPermissionCapability.defaultMode;
  const runnerSchemaValue = (key: string, fallback: unknown): unknown =>
    isCreate
      ? (values!.adapterSchemaValues?.[key] ?? fallback)
      : eff("adapterConfig", key, config[key] ?? fallback);
  const updateRunnerSchemaValue = (key: string, value: unknown): void => {
    if (isCreate) {
      set!({
        adapterSchemaValues: {
          ...values!.adapterSchemaValues,
          [key]: value,
        },
      });
    } else {
      mark("adapterConfig", key, value);
    }
  };
  const runnerLifecycleMode = runnerManaged
    ? isCreate
      ? (values!.paperclipRunnerLifecycleMode ?? "per_turn")
      : eff(
          "adapterConfig",
          "lifecycleMode",
          config.lifecycleMode === "warm" ? "warm" : "per_turn",
        )
    : "per_turn";
  const runnerIdleTimeoutMs = runnerManaged
    ? resolvePaperclipRunnerIdleTimeoutMs(
        isCreate
          ? values!.paperclipRunnerIdleTimeoutMs
          : eff("adapterConfig", "idleTimeoutMs", config.idleTimeoutMs),
      )
    : PAPERCLIP_RUNNER_IDLE_TIMEOUT_DEFAULT_MS;
  const rawEngine = runnerManaged
    ? "cli"
    : isCreate
      ? (values!.codexEngine ?? "auto")
      : eff("adapterConfig", "engine", String(config.engine ?? "auto"));
  const engine =
    rawEngine === "acp" || rawEngine === "cli" ? rawEngine : "auto";
  const acpSelected = engine === "acp";
  const bypassEnabled = resolveCodexLocalCliPolicy({
    ...config,
    dangerouslyBypassApprovalsAndSandbox: eff("adapterConfig", "dangerouslyBypassApprovalsAndSandbox", config.dangerouslyBypassApprovalsAndSandbox),
    dangerouslyBypassSandbox: eff("adapterConfig", "dangerouslyBypassSandbox", config.dangerouslyBypassSandbox),
    extraArgs: eff("adapterConfig", "extraArgs", config.extraArgs),
    args: eff("adapterConfig", "args", config.args),
  }).bypass;
  const fastModeEnabled = isCreate
    ? Boolean(values!.fastMode)
    : eff("adapterConfig", "fastMode", Boolean(config.fastMode));
  const currentModel = isCreate
    ? String(values!.model ?? "")
    : eff("adapterConfig", "model", String(config.model ?? ""));
  const fastModeManualModel = isCodexLocalManualModel(currentModel);
  const fastModeSupported = isCodexLocalFastModeSupported(currentModel);
  const supportedModelsLabel =
    CODEX_LOCAL_FAST_MODE_SUPPORTED_MODELS.join(", ");
  const fastModeMessage = fastModeManualModel
    ? t("codexLocal.fastModeManualModelHint")
    : fastModeSupported
      ? t("codexLocal.fastModeSupportedHint")
      : t("codexLocal.fastModeUnsupportedHint", { model: supportedModelsLabel });

  return configFieldsForSection(section, (
    <>
      {!hideEngineChoice && (
        <Field
          label={t("adapterConfigFields.executionEngine")}
          hint={t("adapterConfigFields.executionEngineHint")}
        >
          <SelectPopover
            aria-label={t("adapterConfigFields.executionEngine")}
            value={engine}
            onValueChange={(next) => {
              const value =
                next === "acp"
                  ? "acp"
                  : next === "cli"
                    ? "cli"
                    : "auto";
              isCreate
                ? set!({ codexEngine: value })
                : mark(
                    "adapterConfig",
                    "engine",
                    value === "auto" ? undefined : value,
                  );
            }}
            options={[
              { value: "auto", label: t("codexLocal.engineDefaultAcp") },
              { value: "cli", label: "Codex CLI" },
              { value: "acp", label: "ACP" },
            ]}
          />
        </Field>
      )}
      {runnerManaged && !hideRunnerHarness && !isExternal && (
        <Field configSection="adapter"
          label={t("codexLocal.harness")}
          hint={t("codexLocal.harnessHint")}
        >
          <Select
            value={runnerProvider === "acpx" && runnerSchemaValue("acpxAgent", "claude") === "grok" ? "grok" : runnerProvider}
            onValueChange={(value) => {
              const grok = value === "grok";
              const provider = grok ? "acpx" : isPaperclipRunnerProvider(value)
                ? value
                : "codex";
              const model =
                provider === "openai_dot"
                  ? ""
                  : provider === "opencode"
                  ? defaultOpenCodeRunnerModel
                  : provider === "claude_managed"
                    ? defaultClaudeManagedModel
                    : provider === "aws_agentcore"
                      ? defaultAwsAgentCoreModel
                      : provider === "acpx"
                        ? grok ? "grok-4.7" : defaultAcpxClaudeModel
                        : DEFAULT_CODEX_LOCAL_MODEL;
              if (isCreate) {
                set!({
                  model,
                  adapterSchemaValues: {
                    ...values!.adapterSchemaValues,
                    provider,
                    acpxSessionMode: undefined,
                    piThinkingLevel: undefined,
                    ...(provider === "acpx" ? { acpxAgent: grok ? "grok" : "claude" } : {}),
                  },
                });
              } else {
                mark("adapterConfig", "provider", provider);
                mark("adapterConfig", "acpxSessionMode", undefined);
                mark("adapterConfig", "piThinkingLevel", undefined);
                mark("adapterConfig", "model", model);
                if (provider === "openai_dot") {
                  mark("adapterConfig", "lifecycleMode", "per_turn");
                  for (const key of ["cwd", "env", "instructionsFilePath", "command", "extraArgs", "engine", "modelReasoningEffort", "workspaceStrategy", "workspaceRuntime", "idleTimeoutMs", "acpxAgent", "managedProfileId", "agentCoreProfileId"]) mark("adapterConfig", key, undefined);
                }
                if (provider === "acpx") {
                  mark("adapterConfig", "acpxAgent", grok ? "grok" : "claude");
                }
              }
            }}
          >
            <SelectTrigger className="w-full" aria-label={t("codexLocal.harness")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {!isPaperclipRunnerProvider(runnerProvider) && <SelectItem value={runnerProvider} disabled>{runnerProvider} (unknown provider)</SelectItem>}
              {runnerHarnessOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <AdapterMark type={option.adapter} className="size-4" />
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {runnerManaged && runnerProvider === "grok_bot" && <GrokBotConnection companyId={companyId} agentId={agentId} />}
      {runnerManaged && runnerProvider === "openai_dot" && <>
        <Field configSection="adapter" label={t("codexLocal.dotConnection")} hint={t("codexLocal.dotConnectionHint")}>
          <DotRunnerConnection companyId={companyId} agentId={agentId} bindingId={String(runnerSchemaValue("dotBindingId", ""))} onBinding={id => updateRunnerSchemaValue("dotBindingId", id)} />
        </Field>
        <ToggleField label={t("codexLocal.readTaskAttachments")} hint={t("codexLocal.readTaskAttachmentsHint")}
          checked={runnerSchemaValue("dotAttachmentAccess", false) === true} onChange={value => updateRunnerSchemaValue("dotAttachmentAccess", value)} />
        <ToggleField label={t("codexLocal.workspaceFilesAndCommands")} hint={t("codexLocal.workspaceFilesAndCommandsHint")}
          checked={runnerSchemaValue("dotWorkspaceAccess", false) === true} onChange={value => updateRunnerSchemaValue("dotWorkspaceAccess", value)} />
        <ToggleField label="Allow externally billed provider" hint={t("codexLocal.dotUnmeteredHint")}
          checked={runnerSchemaValue("allowUnmeteredProvider", false) === true} onChange={value => updateRunnerSchemaValue("allowUnmeteredProvider", value)} />
      </>}
      {runnerManaged && isMuse && <>
        <Field configSection="adapter" label={t("codexLocal.museConnection")} hint={t("codexLocal.museConnectionHint")}>
          <MuseRunnerConnection companyId={companyId} agentId={agentId} />
        </Field>
        <ToggleField label="Allow externally billed provider" hint={t("codexLocal.museUnmeteredHint")}
          checked={runnerSchemaValue("allowUnmeteredProvider", false) === true} onChange={value => updateRunnerSchemaValue("allowUnmeteredProvider", value)} />
      </>}
      {runnerManaged && !hideRunnerHarness && runnerProvider === "acpx" && runnerSchemaValue("acpxAgent", "claude") !== "grok" && (
        <Field configSection="adapter" label={t("codexLocal.acpAgent")} hint={t("codexLocal.acpAgentHint")}>
          <Select
            value={String(isCreate ? values!.adapterSchemaValues?.acpxAgent ?? "claude" : eff("adapterConfig", "acpxAgent", config.acpxAgent ?? "claude"))}
            onValueChange={(value) => {
              const profile = PAPERCLIP_RUNNER_ACPX_PROFILES.find(entry => entry.value === value);
              const acpxSessionMode = profile?.value === "cursor" ? "agent" : undefined;
              const piThinkingLevel = profile?.value === "pi" ? "low" : undefined;
              if (!profile?.qualified) return;
              if (isCreate) set!({ model: profile.value === "claude" ? defaultAcpxClaudeModel : "",
                adapterSchemaValues: { ...values!.adapterSchemaValues, acpxAgent: profile.value, acpxSessionMode, piThinkingLevel } });
              else { mark("adapterConfig", "acpxAgent", profile.value); mark("adapterConfig", "acpxSessionMode", acpxSessionMode); mark("adapterConfig", "piThinkingLevel", piThinkingLevel); mark("adapterConfig", "model", profile.value === "claude" ? defaultAcpxClaudeModel : ""); }
            }}>
            <SelectTrigger className="w-full" aria-label={t("codexLocal.acpAgent")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAPERCLIP_RUNNER_ACPX_PROFILES.map(profile => (
                <SelectItem key={profile.value} value={profile.value} disabled={!profile.qualified}>
                  <AdapterMark type={profile.value === "cursor" ? "cursor" : `${profile.value}_local`} className="size-4" />
                  {profile.label}{profile.qualified ? "" : ` ${t("codexLocal.qualificationPending")}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {runnerManaged && runnerProvider === "acpx" && runnerSchemaValue("acpxAgent", "claude") === "cursor" && (
        <Field configSection="adapter" label={t("codexLocal.cursorMode")} hint={t("codexLocal.cursorModeHint")}>
          <select className={inputClass} aria-label={t("codexLocal.cursorMode")}
            value={String(runnerSchemaValue("acpxSessionMode", "agent"))}
            onChange={(event) => updateRunnerSchemaValue("acpxSessionMode", event.target.value)}>
            {!["agent", "plan", "ask"].includes(String(runnerSchemaValue("acpxSessionMode", "agent"))) && (
              <option value={String(runnerSchemaValue("acpxSessionMode", "agent"))} disabled>{t("codexLocal.unsupportedSavedCursorMode")}</option>
            )}
            <option value="agent">{t("codexLocal.cursorModeAgent")}</option>
            <option value="plan">{t("codexLocal.cursorModePlan")}</option>
            <option value="ask">{t("codexLocal.cursorModeAsk")}</option>
          </select>
        </Field>
      )}
      {runnerManaged && runnerProvider === "acpx" && runnerSchemaValue("acpxAgent", "claude") === "pi" && (
        <Field configSection="adapter" label={t("codexLocal.piThinkingLevel")} hint={t("codexLocal.piThinkingLevelHint")}>
          <select className={inputClass} aria-label={t("codexLocal.piThinkingLevel")} value={String(runnerSchemaValue("piThinkingLevel", "low"))}
            onChange={(event) => updateRunnerSchemaValue("piThinkingLevel", event.target.value)}>
            {!["off", "low", "high", "max"].includes(String(runnerSchemaValue("piThinkingLevel", "low"))) && <option value={String(runnerSchemaValue("piThinkingLevel", "low"))} disabled>{t("codexLocal.unsupportedSavedThinkingLevel")}</option>}
            <option value="off">{t("codexLocal.thinkingOff")}</option><option value="low">{t("codexLocal.thinkingLow")}</option><option value="high">{t("codexLocal.thinkingHigh")}</option><option value="max">{t("codexLocal.thinkingMax")}</option>
          </select>
        </Field>
      )}
      {runnerManaged && runnerProvider === "claude_managed" && (
        <>
          <Field
            label={t("codexLocal.managedAgentProfile")}
            hint={t("codexLocal.managedAgentProfileHint")}
          >
            <DraftInput
              value={String(runnerSchemaValue("managedProfileId", ""))}
              onCommit={(value) =>
                updateRunnerSchemaValue("managedProfileId", value.trim())
              }
              immediate
              className={inputClass}
              placeholder="managed-primary"
            />
          </Field>
          <Field
            label={t("codexLocal.sessionSpendCeiling")}
            hint={t("codexLocal.sessionSpendCeilingHint")}
          >
            <DraftNumberInput
              value={Number(runnerSchemaValue("maxSessionListCostUsd", 1))}
              min={0.01}
              onCommit={(value) =>
                updateRunnerSchemaValue("maxSessionListCostUsd", value)
              }
              immediate
              className={inputClass}
            />
          </Field>
          <ToggleField
            label={t("codexLocal.acknowledgeManagedRetention")}
            hint={t("codexLocal.acknowledgeManagedRetentionHint")}
            checked={
              runnerSchemaValue("managedAgentsRetentionAcknowledged", false) ===
              true
            }
            onChange={(value) =>
              updateRunnerSchemaValue(
                "managedAgentsRetentionAcknowledged",
                value,
              )
            }
          />
        </>
      )}
      {runnerManaged && runnerProvider === "aws_agentcore" && (
        <>
          <Field
            label={t("codexLocal.agentCoreProfile")}
            hint={t("codexLocal.agentCoreProfileHint")}
          >
            <DraftInput
              value={String(runnerSchemaValue("agentCoreProfileId", ""))}
              onCommit={(value) =>
                updateRunnerSchemaValue("agentCoreProfileId", value.trim())
              }
              immediate
              className={inputClass}
              placeholder="agentcore-primary"
            />
          </Field>
          <Field
            label={t("codexLocal.estimatedSessionCeiling")}
            hint={t("codexLocal.estimatedSessionCeilingHint")}
          >
            <DraftNumberInput
              value={Number(runnerSchemaValue("maxEstimatedSessionCostUsd", 1))}
              min={0.01}
              onCommit={(value) =>
                updateRunnerSchemaValue("maxEstimatedSessionCostUsd", value)
              }
              immediate
              className={inputClass}
            />
          </Field>
          <Field
            label={t("codexLocal.maximumIterations")}
            hint={t("codexLocal.maximumIterationsHint")}
          >
            <DraftNumberInput
              value={Number(runnerSchemaValue("maxIterations", 8))}
              min={1}
              max={8}
              onCommit={(value) =>
                updateRunnerSchemaValue("maxIterations", value)
              }
              immediate
              className={inputClass}
            />
          </Field>
          <Field
            label={t("codexLocal.maximumOutputTokens")}
            hint={t("codexLocal.maximumOutputTokensHint")}
          >
            <DraftNumberInput
              value={Number(runnerSchemaValue("maxOutputTokens", 4_096))}
              min={1}
              max={4_096}
              onCommit={(value) =>
                updateRunnerSchemaValue("maxOutputTokens", value)
              }
              immediate
              className={inputClass}
            />
          </Field>
          <Field configSection="runPolicy"
            label={t("codexLocal.invocationTimeout")}
            hint={t("codexLocal.invocationTimeoutHint")}
          >
            <DraftNumberInput
              value={Number(runnerSchemaValue("timeoutSeconds", 300))}
              min={1}
              max={300}
              onCommit={(value) =>
                updateRunnerSchemaValue("timeoutSeconds", value)
              }
              immediate
              className={inputClass}
            />
          </Field>
          <ToggleField
            label={t("codexLocal.acknowledgeMemoryRetention")}
            hint={t("codexLocal.acknowledgeMemoryRetentionHint")}
            checked={
              runnerSchemaValue("agentCoreRetentionAcknowledged", false) ===
              true
            }
            onChange={(value) =>
              updateRunnerSchemaValue("agentCoreRetentionAcknowledged", value)
            }
          />
        </>
      )}
      {runnerManaged && !isExternal && runnerPermissionCapability.configurable && (runnerPermissionCapability.options.length > 1 || runnerPermissionModeUnsupported) && (
        <Field
          label={t("adapterConfigFields.permissionMode")}
          hint={t("codexLocal.permissionModeHint", { description: runnerPermissionCapability.description })}
        >
          <Select
            value={
              runnerPermissionModeUnsupported
                ? "__unsupported__"
                : runnerPermissionMode
            }
            onValueChange={(selectedMode) => {
              const value = resolvePaperclipRunnerPermissionMode(
                isPaperclipRunnerProvider(runnerProvider) ? runnerProvider : "codex",
                selectedMode,
              ) as PaperclipRunnerPermissionMode;
              if (isCreate) {
                set!({
                  adapterSchemaValues: {
                    ...values!.adapterSchemaValues,
                    [runnerPermissionCapability.configKey]: value,
                  },
                });
              } else {
                mark(
                  "adapterConfig",
                  runnerPermissionCapability.configKey,
                  value,
                );
              }
            }}
          >
            <SelectTrigger aria-label={t("adapterConfigFields.permissionMode")} className="w-full font-sans">
              <SelectValue>
                {runnerPermissionModeUnsupported
                  ? t("codexLocal.unsupportedSavedQualifiedMode")
                  : runnerPermissionCapability.options.find((option) => option.value === runnerPermissionMode)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {runnerPermissionModeUnsupported && (
                <SelectItem value="__unsupported__" disabled>
                  Unsupported saved mode — select a qualified mode
                </SelectItem>
              )}
              {runnerPermissionCapability.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {runnerPermissionModeUnsupported && runnerProvider === "codex" && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              This saved Codex mode cannot start or recover a Paperclip Runner
              run. Select Automatic (isolated) to remediate it.
            </p>
          )}
        </Field>
      )}
      {runnerManaged && !isExternal && (
        <Field configSection="runPolicy"
          label={t("codexLocal.runnerLifecycle")}
          hint={t("codexLocal.runnerLifecycleHint")}
        >
          <SelectPopover
            aria-label={t("codexLocal.runnerLifecycle")}
            value={runnerLifecycleMode}
            onValueChange={(next) => {
              const value = next === "warm" ? "warm" : "per_turn";
              isCreate
                ? set!({ paperclipRunnerLifecycleMode: value })
                : mark("adapterConfig", "lifecycleMode", value);
            }}
            options={[
              { value: "per_turn", label: t("codexLocal.turnByTurn") },
              { value: "warm", label: t("codexLocal.warmSession") },
            ]}
          />
        </Field>
      )}
      {runnerManaged && !isExternal && runnerLifecycleMode === "warm" && (
        <Field configSection="runPolicy"
          label={t("codexLocal.warmIdleTimeout")}
          hint={t("codexLocal.warmIdleTimeoutHint")}
        >
          {isCreate ? (
            <input
              type="number"
              min={1}
              max={PAPERCLIP_RUNNER_IDLE_TIMEOUT_MAX_MS}
              className={inputClass}
              value={runnerIdleTimeoutMs}
              onChange={(event) =>
                set!({
                  paperclipRunnerIdleTimeoutMs:
                    resolvePaperclipRunnerIdleTimeoutMs(
                      Number(event.target.value),
                    ),
                })
              }
            />
          ) : (
            <DraftNumberInput
              value={runnerIdleTimeoutMs}
              min={1}
              max={PAPERCLIP_RUNNER_IDLE_TIMEOUT_MAX_MS}
              onCommit={(value) =>
                mark(
                  "adapterConfig",
                  "idleTimeoutMs",
                  resolvePaperclipRunnerIdleTimeoutMs(value),
                )
              }
              immediate
              className={inputClass}
            />
          )}
        </Field>
      )}
      {acpSelected && (
        <>
          {!managedSandboxOnly && (
            <Field configSection="advanced"
              label={t("adapterConfigFields.acpServerCommand")}
              hint={t("codexLocal.acpServerCommandHint")}
            >
              <DraftInput
                value={
                  isCreate
                    ? (values!.codexAcpAgentCommand ?? "")
                    : eff(
                        "adapterConfig",
                        "agentCommand",
                        String(config.agentCommand ?? ""),
                      )
                }
                onCommit={(v) =>
                  isCreate
                    ? set!({ codexAcpAgentCommand: v })
                    : mark("adapterConfig", "agentCommand", v || undefined)
                }
                immediate
                className={inputClass}
                placeholder="codex-acp"
              />
            </Field>
          )}
          <Field configSection="runPolicy"
            label={t("adapterConfigFields.acpSessionMode")}
            hint={t("adapterConfigFields.acpSessionModeHint")}
          >
            <SelectPopover
              aria-label={t("adapterConfigFields.acpSessionMode")}
              value={
                isCreate
                  ? (values!.codexAcpMode ?? "persistent")
                  : eff(
                      "adapterConfig",
                      "mode",
                      String(config.mode ?? "persistent"),
                    )
              }
              onValueChange={(next) => {
                const value =
                  next === "oneshot" ? "oneshot" : "persistent";
                isCreate
                  ? set!({ codexAcpMode: value })
                  : mark("adapterConfig", "mode", value);
              }}
              options={[
                { value: "persistent", label: t("codexLocal.acpSessionPersistent") },
                { value: "oneshot", label: t("codexLocal.acpSessionOneShot") },
              ]}
            />
          </Field>
          <Field
            label={t("adapterConfigFields.acpNonInteractivePermissions")}
            hint={t("adapterConfigFields.acpNonInteractivePermissionsHint")}
          >
            <SelectPopover
              aria-label={t("adapterConfigFields.acpNonInteractivePermissions")}
              value={
                isCreate
                  ? (values!.codexAcpNonInteractivePermissions ?? "deny")
                  : eff(
                      "adapterConfig",
                      "nonInteractivePermissions",
                      String(config.nonInteractivePermissions ?? "deny"),
                    )
              }
              onValueChange={(next) => {
                const value = next === "fail" ? "fail" : "deny";
                isCreate
                  ? set!({ codexAcpNonInteractivePermissions: value })
                  : mark("adapterConfig", "nonInteractivePermissions", value);
              }}
              options={[
                { value: "deny", label: t("codexLocal.permissionDeny") },
                { value: "fail", label: t("codexLocal.permissionFail") },
              ]}
            />
          </Field>
          {!managedSandboxOnly && (
            <Field
              label={t("adapterConfigFields.acpStateDirectory")}
              hint={t("adapterConfigFields.acpStateDirectoryHint")}
            >
              <div className="flex items-center gap-2">
                <DraftInput
                  value={
                    isCreate
                      ? (values!.codexAcpStateDir ?? "")
                      : eff(
                          "adapterConfig",
                          "stateDir",
                          String(config.stateDir ?? ""),
                        )
                  }
                  onCommit={(v) =>
                    isCreate
                      ? set!({ codexAcpStateDir: v })
                      : mark("adapterConfig", "stateDir", v || undefined)
                  }
                  immediate
                  className={inputClass}
                  placeholder="/path/to/acp-state"
                />
                <ChoosePathButton />
              </div>
            </Field>
          )}
          <Field configSection="runPolicy"
            label={t("adapterConfigFields.acpWarmProcessIdleMs")}
            hint={t("adapterConfigFields.acpWarmProcessIdleMsHint")}
          >
            {isCreate ? (
              <input
                type="number"
                className={inputClass}
                value={values!.codexAcpWarmHandleIdleMs ?? 0}
                onChange={(e) =>
                  set!({ codexAcpWarmHandleIdleMs: Number(e.target.value) })
                }
              />
            ) : (
              <DraftNumberInput
                value={eff(
                  "adapterConfig",
                  "warmHandleIdleMs",
                  Number(config.warmHandleIdleMs ?? 0),
                )}
                onCommit={(v) =>
                  mark("adapterConfig", "warmHandleIdleMs", v || 0)
                }
                immediate
                className={inputClass}
              />
            )}
          </Field>
        </>
      )}
      {!runnerManaged && !hideInstructionsFile && (
        <Field label={t("adapterConfigFields.agentInstructionsFile")} hint={instructionsFileHint}>
          <div className="flex items-center gap-2">
            <DraftInput
              value={
                isCreate
                  ? (values!.instructionsFilePath ?? "")
                  : eff(
                      "adapterConfig",
                      "instructionsFilePath",
                      String(config.instructionsFilePath ?? ""),
                    )
              }
              onCommit={(v) =>
                isCreate
                  ? set!({ instructionsFilePath: v })
                  : mark(
                      "adapterConfig",
                      "instructionsFilePath",
                      v || undefined,
                    )
              }
              immediate
              className={inputClass}
              placeholder="/absolute/path/to/AGENTS.md"
            />
            <ChoosePathButton />
          </div>
        </Field>
      )}
      {!runnerManaged && (
        <>
          <ToggleField
            label={t("codexLocal.bypassSandbox")}
            hint={help.dangerouslyBypassSandbox}
            checked={
              isCreate
                ? resolveCodexLocalCliPolicy(buildCodexRunnerConfig(values!)).bypass
                : bypassEnabled
            }
            onChange={(v) =>
              isCreate
                ? set!({ dangerouslyBypassSandbox: v, codexLegacySandboxBypass: v })
                : mark(
                    "adapterConfig",
                    "dangerouslyBypassApprovalsAndSandbox",
                    v,
                  )
            }
          />
          <ToggleField
            label={t("codexLocal.enableSearch")}
            hint={help.search}
            checked={
              isCreate
                ? values!.search
                : eff("adapterConfig", "search", !!config.search)
            }
            onChange={(v) =>
              isCreate
                ? set!({ search: v })
                : mark("adapterConfig", "search", v)
            }
          />
          <ToggleField
            label={t("codexLocal.fastMode")}
            hint={help.fastMode}
            checked={fastModeEnabled}
            onChange={(v) =>
              isCreate
                ? set!({ fastMode: v })
                : mark("adapterConfig", "fastMode", v)
            }
          />
          {fastModeEnabled && (
            <div className="rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              {fastModeMessage}
            </div>
          )}
        </>
      )}
      {!isExternal && <LocalWorkspaceRuntimeFields
        isCreate={isCreate}
        values={values}
        set={set}
        config={config}
        mark={mark}
        eff={eff}
        mode={mode}
        adapterType={adapterType}
        models={models}
      />}
    </>
  ));
}
