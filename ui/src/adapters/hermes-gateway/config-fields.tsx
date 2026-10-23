import { t } from "@/i18n";
import { configFieldsForSection } from "../config-sections";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AdapterConfigFieldsProps, CreateConfigValues } from "../types";
import {
  DraftInput,
  DraftNumberInput,
  DraftTextarea,
  Field,
  ToggleField,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const DEFAULT_SESSION_KEY_STRATEGY = "issue";
const DEFAULT_TIMEOUT_SEC = 600;
const DEFAULT_EVENT_RECONNECT_MS = 2000;

type SecretRef = {
  type: "secret_ref";
  secretId: string;
  version?: number | "latest";
};

function isSecretRef(value: unknown): value is SecretRef {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "secret_ref" &&
    typeof (value as { secretId?: unknown }).secretId === "string"
  );
}

function readCreateValue(values: CreateConfigValues | null, key: string, fallback: unknown): unknown {
  return values?.adapterSchemaValues?.[key] ?? fallback;
}

function writeCreateValue(
  values: CreateConfigValues | null,
  set: ((patch: Partial<CreateConfigValues>) => void) | null,
  key: string,
  value: unknown,
) {
  set?.({
    adapterSchemaValues: {
      ...values?.adapterSchemaValues,
      [key]: value,
    },
  });
}

function stringifyHeaders(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }
  return "";
}

function SecretField({
  label,
  value,
  onCommit,
  placeholder,
  stored,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  stored?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <DraftInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          className={inputClass + " pl-8"}
          placeholder={stored ? "Stored secret; enter a new value to replace it" : placeholder}
        />
      </div>
    </Field>
  );
}

export function HermesGatewayConfigFields({
  section,
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const storedApiKey = config.apiKey;
  const hasStoredApiKey = isSecretRef(storedApiKey) || typeof storedApiKey === "string";
  const editApiKeyValue = typeof storedApiKey === "string" ? String(eff("adapterConfig", "apiKey", storedApiKey)) : "";

  const configuredHeaders = stringifyHeaders(config.headers);
  const editHeaders = eff("adapterConfig", "headers", configuredHeaders);
  const [headersDraft, setHeadersDraft] = useState(String(editHeaders ?? ""));

  useEffect(() => {
    if (!isCreate) setHeadersDraft(String(editHeaders ?? ""));
  }, [editHeaders, isCreate]);

  const readValue = (key: string, fallback: unknown) =>
    isCreate ? readCreateValue(values, key, fallback) : eff("adapterConfig", key, (config[key] ?? fallback) as never);

  const writeValue = (key: string, value: unknown) => {
    if (isCreate) {
      writeCreateValue(values, set, key, value);
    } else {
      mark("adapterConfig", key, value);
    }
  };

  const apiBaseUrl = String(readValue("apiBaseUrl", "") ?? "");
  const paperclipApiUrl = String(readValue("paperclipApiUrl", "") ?? "");
  const sessionKeyStrategy = String(readValue("sessionKeyStrategy", DEFAULT_SESSION_KEY_STRATEGY) ?? DEFAULT_SESSION_KEY_STRATEGY);
  const timeoutSec = Number(readValue("timeoutSec", DEFAULT_TIMEOUT_SEC) ?? DEFAULT_TIMEOUT_SEC);
  const eventReconnectMs = Number(readValue("eventReconnectMs", DEFAULT_EVENT_RECONNECT_MS) ?? DEFAULT_EVENT_RECONNECT_MS);
  const allowInsecureRemoteHttp = Boolean(readValue("dangerouslyAllowInsecureRemoteHttp", false));
  const instructions = String(readValue("instructions", "") ?? "");
  const headers = isCreate
    ? String(readCreateValue(values, "headers", "") ?? "")
    : headersDraft;

  return configFieldsForSection(section, (
    <>
      <Field
        label={t("hermesGateway.apiBaseUrl")}
        hint={t("hermesGateway.apiBaseUrlHint")}
      >
        <DraftInput
          value={apiBaseUrl}
          onCommit={(v) => writeValue("apiBaseUrl", v || undefined)}
          immediate
          className={inputClass}
          placeholder="http://127.0.0.1:8642"
        />
      </Field>

      <SecretField
        label={t("hermesGateway.apiKey")}
        value={isCreate ? String(readCreateValue(values, "apiKey", "") ?? "") : editApiKeyValue}
        onCommit={(v) => writeValue("apiKey", v || undefined)}
        placeholder={t("hermesGateway.apiKeyPlaceholder")}
        stored={!isCreate && hasStoredApiKey && !editApiKeyValue}
      />

      <Field
        label={t("hermesGateway.paperclipApiUrl")}
        hint={t("hermesGateway.paperclipApiUrlHint")}
      >
        <DraftInput
          value={paperclipApiUrl}
          onCommit={(v) => writeValue("paperclipApiUrl", v || undefined)}
          immediate
          className={inputClass}
          placeholder="http://127.0.0.1:3100"
        />
      </Field>

      <Field configSection="runPolicy"
        label={t("hermesGateway.sessionKeyStrategy")}
        hint={t("hermesGateway.sessionKeyStrategyHint")}
      >
        <select
          value={sessionKeyStrategy}
          onChange={(event) => writeValue("sessionKeyStrategy", event.target.value)}
          className={inputClass}
        >
          <option value="issue">{t("hermesGateway.sessionStrategyIssueScoped")}</option>
          <option value="agent">{t("hermesGateway.sessionStrategyAgentScoped")}</option>
          <option value="run">{t("hermesGateway.sessionStrategyRunScoped")}</option>
          <option value="none">{t("hermesGateway.sessionStrategyNone")}</option>
        </select>
      </Field>

      <Field configSection="runPolicy" label={t("hermesGateway.timeoutSeconds")}>
        <DraftNumberInput
          value={Number.isFinite(timeoutSec) ? timeoutSec : DEFAULT_TIMEOUT_SEC}
          onCommit={(v) => writeValue("timeoutSec", v)}
          immediate
          className={inputClass}
        />
      </Field>

      <Field
        label={t("hermesGateway.eventReconnectMs")}
        hint={t("hermesGateway.eventReconnectHint")}
      >
        <DraftNumberInput
          value={Number.isFinite(eventReconnectMs) ? eventReconnectMs : DEFAULT_EVENT_RECONNECT_MS}
          onCommit={(v) => writeValue("eventReconnectMs", v)}
          immediate
          className={inputClass}
        />
      </Field>

      <ToggleField
        label={t("hermesGateway.dangerouslyAllowRemoteHttp")}
        hint={t("hermesGateway.dangerouslyAllowRemoteHttpHint")}
        checked={allowInsecureRemoteHttp}
        onChange={(v) => writeValue("dangerouslyAllowInsecureRemoteHttp", v)}
      />

      <Field
        label={t("hermesGateway.extraHeaders")}
        hint={t("hermesGateway.extraHeadersHint")}
      >
        <textarea
          value={headers}
          onChange={(event) => {
            const next = event.target.value;
            if (isCreate) {
              writeValue("headers", next || undefined);
            } else {
              setHeadersDraft(next);
              mark("adapterConfig", "headers", next || undefined);
            }
          }}
          rows={3}
          className={inputClass}
          placeholder='{"x-custom-header": "value"}'
        />
      </Field>

      <Field label={t("hermesGateway.instructions")} hint={t("hermesGateway.instructionsHint")}>
        <DraftTextarea
          value={instructions}
          onCommit={(v) => writeValue("instructions", v || undefined)}
          immediate
          minRows={3}
        />
      </Field>
    </>
  ));
}
