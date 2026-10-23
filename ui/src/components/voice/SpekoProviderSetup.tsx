import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { SetupWizardFooter } from "@/components/SetupWizard";
import { Input } from "@/components/ui/input";

export interface SpekoProviderSetupProps {
  agentName: string;
  onSaveExit?(): void;
  credentials: Record<string, string>;
  onChange(values: Record<string, string>): void;
  onConnect(values: Record<string, string>): void;
  callbackUrl?: string | null;
  pending?: boolean;
  repairing?: boolean;
  /** Presence only; existing callback secrets never reach the browser. */
  signingSecretConfigured?: boolean;
}
export function SpekoProviderSetup({ agentName, onSaveExit, credentials, onChange, onConnect, callbackUrl, pending = false, repairing = false, signingSecretConfigured }: SpekoProviderSetupProps) {
  const hasSavedSecret = signingSecretConfigured ?? repairing;
  const ready = repairing && hasSavedSecret || Boolean(credentials.apiKey?.trim() && credentials.agentId?.trim());
  const reachable = callbackUrl?.startsWith("https://") === true;
  function connect() {
    if (!ready || !reachable || pending) return;
    const values = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim()));
    if (!hasSavedSecret && !values.signingSecret) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      values.signingSecret = `whsec_${btoa(String.fromCharCode(...bytes))}`;
      onChange(values);
    }
    onConnect(values);
  }
  return <div className="space-y-5">
    <div>
      <h1 className="text-xl font-bold">Connect {agentName} to Speko</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose a dedicated Speko voice persona. Paperclip uses its voice while {agentName} keeps its existing runtime, tools, and task context.</p>
    </div>
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li>{t("spekoProviderSetup.createADedicatedAgentIn")}</li>
      <li>{t("spekoProviderSetup.copyItsAgentIdAnd")}</li>
      <li>{t("spekoProviderSetup.reviewRecordingAndRetentionSettings")}</li>
    </ol>
    <Button asChild variant="outline"><a href="https://platform.speko.ai/agents" target="_blank" rel="noreferrer">{t("spekoProviderSetup.openSpekoAgents")}</a></Button>
    <label className="grid gap-2 text-sm font-medium">{t("spekoProviderSetup.spekoAgentId")}<Input autoComplete="off" value={credentials.agentId ?? ""} placeholder={repairing ? t("spekoProviderSetup.leaveBlankToKeepThe") : "agent_…"} onChange={(event) => onChange({ ...credentials, agentId: event.target.value })} /></label>
    <label className="grid gap-2 text-sm font-medium">{t("spekoProviderSetup.spekoApiKey")}<Input type="password" autoComplete="new-password" value={credentials.apiKey ?? ""} placeholder={repairing ? t("spekoProviderSetup.leaveBlankToKeepThe2") : t("spekoProviderSetup.pasteYourSpekoApiKey")} onChange={(event) => onChange({ ...credentials, apiKey: event.target.value })} /></label>
    {!reachable && <p role="alert" className="text-sm text-destructive">{t("spekoProviderSetup.configureAPublicHttpsCallback")}</p>}
    {reachable && <p className="break-all text-xs text-muted-foreground">Callback: {callbackUrl}</p>}
    <p className="text-sm text-muted-foreground">{t("spekoProviderSetup.credentialsAndAGeneratedCallback")}</p>
    {onSaveExit ? <SetupWizardFooter onSaveExit={onSaveExit} disabled={pending}><Button disabled={!ready || !reachable || pending} onClick={connect}>{pending ? t("spekoProviderSetup.verifyingSpeko") : repairing ? t("spekoProviderSetup.reconnectSpeko") : t("spekoProviderSetup.connectSpeko")}</Button></SetupWizardFooter> : <div className="flex justify-end"><Button disabled={!ready || !reachable || pending} onClick={connect}>{pending ? t("spekoProviderSetup.verifyingSpeko") : repairing ? t("spekoProviderSetup.reconnectSpeko") : t("spekoProviderSetup.connectSpeko")}</Button></div>}
  </div>;
}
