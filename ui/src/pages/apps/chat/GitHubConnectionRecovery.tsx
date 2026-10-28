import { t } from "@/i18n";
import { useState } from "react";
import { AlertTriangle, CircleHelp, ExternalLink, Loader2 } from "lucide-react";
import type { ChatEndpoint } from "@/api/chatEndpoints";
import { chatEndpointsApi } from "@/api/chatEndpoints";
import { CopyText } from "@/components/CopyText";
import { SetupWizardFooter } from "@/components/SetupWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/lib/router";
import { gitHubAppSettingsUrl } from "./GitHubAppIdentity";

export function GitHubConnectionRecoveryNotice({ endpoint }: { endpoint: ChatEndpoint }) {
  if (!["attention", "revoked"].includes(endpoint.status)) return null;
  return (
    <section aria-label={t("gitHubConnectionRecovery.githubConnectionNeedsRepair")} className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{endpoint.status === "revoked" ? t("gitHubConnectionRecovery.githubBotIsDisconnected") : t("gitHubConnectionRecovery.githubConnectionNeedsRepair")}</h2>
          <p className="text-sm">{t("gitHubConnectionRecovery.reconnectThisBotToRestore")}</p>
        </div>
        <Button asChild><Link to={`/apps/chat/connect?provider=github&resume=${endpoint.id}&reconnect=1`}>{t("gitHubConnectionRecovery.reconnectGithub")}</Link></Button>
        {(endpoint.lastError || endpoint.healthMessage) && <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("gitHubConnectionRecovery.connectionDetails")}</summary>
          <p className="mt-2 break-words">{endpoint.lastError ?? endpoint.healthMessage}</p>
        </details>}
      </div>
    </section>
  );
}

export const GITHUB_APP_CREDENTIAL_FIELDS = ["privateKey", "webhookSecret", "clientSecret"] as const;
export type GitHubAppCredentialField = typeof GITHUB_APP_CREDENTIAL_FIELDS[number];
export type GitHubAppCredentials = { appId: string; privateKey: string; webhookSecret: string; clientSecret?: string };

function CredentialLabel({ id, label, help }: { id: string; label: string; help: string }) {
  return <div className="flex items-center gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Tooltip><TooltipTrigger asChild><button type="button" aria-label={t("gitHubConnectionRecovery.helpWith", { label })} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
      <CircleHelp className="size-3.5" aria-hidden="true" />
    </button></TooltipTrigger><TooltipContent className="max-w-xs">{help}</TooltipContent></Tooltip>
  </div>;
}

export function GitHubAppRecovery({ endpoint, reconnect, credentialFields, requireAllCredentialFields = false, rotateWebhookSecret = false, rotationAlreadyCommitted = false, onConnect, onExit }: {
  endpoint: ChatEndpoint;
  reconnect: boolean;
  credentialFields?: readonly GitHubAppCredentialField[];
  requireAllCredentialFields?: boolean;
  rotateWebhookSecret?: boolean;
  rotationAlreadyCommitted?: boolean;
  onConnect: (credentials?: GitHubAppCredentials) => Promise<void>;
  onExit: () => void;
}) {
  const [replace, setReplace] = useState(!!credentialFields || !reconnect);
  const [credentials, setCredentials] = useState<GitHubAppCredentials>({ appId: endpoint.botExternalId ?? "", privateKey: "", webhookSecret: "" });
  const [privateKeyDraft, setPrivateKeyDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [rotationSecret, setRotationSecret] = useState("");
  const [rotationGeneration, setRotationGeneration] = useState<string | null>(null);
  const [rotationUncertain, setRotationUncertain] = useState(false);
  const needsPrivateKey = !credentialFields || credentialFields.includes("privateKey");
  const needsWebhookSecret = credentialFields ? credentialFields.includes("webhookSecret") : !reconnect && !["active", "paused", "revoked"].includes(endpoint.status);
  const appName = endpoint.botLabel ?? endpoint.setup?.github?.appName ?? t("gitHubConnectionRecovery.yourExistingApp");
  const appIdInvalid = !!credentials.appId.trim() && !/^\d+$/.test(credentials.appId.trim());
  const keyInvalid = !!credentials.privateKey.trim() && !/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(credentials.privateKey);
  const keyLoaded = !!credentials.privateKey.trim() && !keyInvalid && !privateKeyDraft;
  const incomplete = credentialFields
    ? !credentialFields.length || appIdInvalid || keyInvalid || (requireAllCredentialFields
      ? credentialFields.some(field => !credentials[field]?.trim())
      : credentialFields.every(field => !credentials[field]?.trim()))
    : replace && (!credentials.appId.trim() || !credentials.privateKey.trim() || appIdInvalid || keyInvalid || (needsWebhookSecret && !credentials.webhookSecret.trim()));
  const actionLabel = pending ? t("gitHubConnectionRecovery.checkingGithub") : replace ? (reconnect ? t("gitHubConnectionRecovery.verifyAndReconnect") : t("gitHubConnectionRecovery.connectExistingApp")) : t("gitHubConnectionRecovery.reconnectSavedApp");
  async function connect() {
    setPending(true);
    setError("");
    try { await onConnect(replace ? credentials : undefined); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("gitHubConnectionRecovery.couldNotReconnectGithubTry")); }
    finally { setPending(false); }
  }
  async function checkSavedRotation(expected: string | null | undefined) {
    try {
      const saved = await chatEndpointsApi.get(endpoint.id);
      if (expected !== undefined && (saved.setup?.credentialRotationId ?? null) === expected) {
        setRotationUncertain(false);
        return true;
      }
      setRotationSecret("");
      setRotationGeneration(null);
      setError("The webhook secret changed, but this page did not receive it. Generate another secret and update GitHub.");
    } catch {
      // A failed status read cannot establish that the earlier secret is current.
    }
    setRotationUncertain(true);
    return false;
  }
  async function generateSecret() {
    const previousGeneration = rotationGeneration ?? (rotationSecret ? undefined : endpoint.setup?.credentialRotationId ?? null);
    setPending(true);
    setError("");
    try {
      const result = await chatEndpointsApi.generateSetupSecret(endpoint.id);
      setRotationSecret(result.webhookSecret);
      setRotationGeneration(result.credentialRotationId ?? null);
      setRotationUncertain(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the webhook secret. Try again.");
      setRotationUncertain(true);
      await checkSavedRotation(previousGeneration);
    }
    finally { setPending(false); }
  }
  return <div className="space-y-6">
    {reconnect && <div className="space-y-3">
      <p className="text-sm">{t("gitHubConnectionRecovery.restore")} <strong>{appName}</strong> {t("gitHubConnectionRecovery.usingItsSavedCredentialsPaperclip")}</p>
      <p className="text-sm text-muted-foreground">{t("gitHubConnectionRecovery.yourAgentRepositoryChoicesReview")}</p>
    </div>}
    {rotateWebhookSecret && <section aria-label="Rotate webhook secret" className="space-y-3">
      <h2 className="text-base font-semibold">Rotate the webhook secret</h2>
      <p className="text-sm">{rotationAlreadyCommitted ? "The rotated secret is saved. Reconnect using that value; Paperclip will check GitHub’s signed delivery." : <>Generate a new secret, then replace the webhook secret in <a href={gitHubAppSettingsUrl(endpoint)} target="_blank" rel="noreferrer" className="underline">GitHub App settings</a>. GitHub must verify the new secret before you reconnect.</>}</p>
      <p className="text-sm text-muted-foreground">Generating immediately invalidates the previous secret. This value is shown only here; keep this page open until you have copied it.</p>
      <Button type="button" variant="outline" disabled={pending} onClick={() => void generateSecret()}>{rotationSecret || rotationAlreadyCommitted ? "Generate another secret" : "Generate webhook secret"}</Button>
      {rotationUncertain && <p role="status" className="text-sm">The active secret is not confirmed. Check its saved status before using an earlier value.</p>}
      {rotationUncertain && rotationSecret && <Button type="button" variant="outline" disabled={pending} onClick={async () => {
        setPending(true);
        try { if (await checkSavedRotation(rotationGeneration ?? undefined)) setError(""); }
        finally { setPending(false); }
      }}>Check saved secret status</Button>}
      {rotationSecret && !rotationUncertain && <div className="space-y-2">
        <Label htmlFor="github-rotation-secret">New webhook secret</Label>
        <Input id="github-rotation-secret" type="password" autoComplete="off" disabled={pending} readOnly value={rotationSecret} />
        {!pending && <CopyText text={rotationSecret} ariaLabel="Copy webhook secret" className="text-sm underline">Copy webhook secret</CopyText>}
      </div>}
    </section>}
    {error && <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">{rotateWebhookSecret ? t("sync20261028.connections.rotationFailed") : replace ? t("gitHubConnectionRecovery.couldNotReconnectThisApp") : t("gitHubConnectionRecovery.couldNotReconnectTheSaved")}</p>
      <p className="break-words">{error}</p>
      <p>{rotateWebhookSecret ? t("sync20261028.connections.rotationRetry") : t("gitHubConnectionRecovery.tryAgainIfTheService")}</p>
    </div>}
    {reconnect && !rotateWebhookSecret && !credentialFields && <Button variant="link" className="h-auto p-0" disabled={pending} onClick={() => { setReplace(!replace); setError(""); }}>
      {replace ? t("gitHubConnectionRecovery.useSavedCredentialsInstead") : t("gitHubConnectionRecovery.replaceAppCredentials")}
    </Button>}
    {replace && <div className="space-y-6">
      <div className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">{reconnect ? t("gitHubConnectionRecovery.replaceCredentialsForTheSame") : t("gitHubConnectionRecovery.connectYourExistingGithubApp")}</h2>
        <p><a href={gitHubAppSettingsUrl(endpoint)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{t("gitHubConnectionRecovery.openGithubAppSettings")}<ExternalLink className="size-3.5" /></a> {t("gitHubConnectionRecovery.andChoose")} <strong>{appName}</strong>.</p>
        <p className="text-muted-foreground">{t("gitHubConnectionRecovery.ifItSOwnedBy")}</p>
        {credentialFields && <p className="text-muted-foreground">{t("sync20261028.connections.requestedCredentials")}</p>}
      </div>
      {needsPrivateKey && <div className="space-y-2">
        <CredentialLabel id="github-app-id" label="App ID" help={t("gitHubConnectionRecovery.theNumericAppIdOnTheGithubAppSSettingsPageThisIsDifferentFromItsClientIdOrInstallationId")} />
        <p id="github-app-id-help" className="text-sm text-muted-foreground">{t("common.copy")} <strong>App ID</strong> {t("gitHubConnectionRecovery.fromTheAppSSettingsPage")} {reconnect && t("gitHubConnectionRecovery.theSavedIdIsFilledInWhenAvailable")}</p>
        <Input id="github-app-id" aria-describedby="github-app-id-help" inputMode="numeric" value={credentials.appId} disabled={pending} aria-invalid={appIdInvalid} onChange={event => setCredentials({ ...credentials, appId: event.target.value })} />
        {appIdInvalid && <p role="alert" className="text-sm text-destructive">{t("gitHubConnectionRecovery.useTheNumericAppId")}</p>}
      </div>}
      {needsPrivateKey && <div className="space-y-2">
        <CredentialLabel id="github-private-key" label={t("gitHubConnectionRecovery.privateKey")} help={t("gitHubConnectionRecovery.uploadThePemFileDownloadedFromThisGithubApp")} />
        <ol id="github-private-key-help" className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t("gitHubConnectionRecovery.inTheSameAppS")} <strong>{t("gitHubConnectionRecovery.credentialsKeyPairsNewKey")}</strong>{t("gitHubConnectionRecovery.onTheOlderSettingsPage")} <strong>{t("gitHubConnectionRecovery.privateKeysGenerateAPrivate")}</strong>.</li>
          <li>{t("gitHubConnectionRecovery.uploadTheDownloaded")} <strong>.pem</strong> {t("gitHubConnectionRecovery.fileBelowOrPasteIts")}</li>
        </ol>
        <p className="text-sm text-muted-foreground">{t("gitHubConnectionRecovery.youCanReuseAPem")}</p>
        <Input type="file" accept=".pem" aria-label={t("gitHubConnectionRecovery.uploadPrivateKeyPemFile")} disabled={pending} onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          setFileError("");
          try {
            const privateKey = await file.text();
            setCredentials(current => ({ ...current, privateKey }));
            setPrivateKeyDraft("");
          } catch { setFileError(t("gitHubConnectionRecovery.couldNotReadThisFileTryAgainOrPasteTheKeyBelow")); }
        }} />
        <Input id="github-private-key" type="password" autoComplete="off" placeholder={keyLoaded ? t("gitHubConnectionRecovery.pasteAReplacementPemKey") : t("gitHubConnectionRecovery.orPasteTheCompletePem")} aria-describedby="github-private-key-help" disabled={pending} value={privateKeyDraft} aria-invalid={keyInvalid}
          onPaste={event => { event.preventDefault(); setCredentials({ ...credentials, privateKey: event.clipboardData.getData("text") }); setPrivateKeyDraft(""); setFileError(""); }}
          onChange={event => { setPrivateKeyDraft(event.target.value); setCredentials({ ...credentials, privateKey: event.target.value }); }} />
        {keyLoaded && <p role="status" className="text-sm">{t("gitHubConnectionRecovery.privateKeyLoadedPasteOr")}</p>}
        {keyInvalid && <p role="alert" className="text-sm text-destructive">{t("gitHubConnectionRecovery.useAPemPrivateKey")}</p>}
        {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
        <a className="inline-flex items-center gap-1 text-sm underline" href="https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps" target="_blank" rel="noreferrer">{t("gitHubConnectionRecovery.githubSPrivateKeyInstructions")}<ExternalLink className="size-3.5" /></a>
      </div>}
      {needsWebhookSecret && <div className="space-y-2">
        <CredentialLabel id="github-webhook-secret" label={t("gitHubConnectionRecovery.webhookSecret")} help={t("gitHubConnectionRecovery.theSecretConfiguredForThisAppSWebhookItMustMatchGithubExactly")} />
        <p className="text-sm text-muted-foreground">{t("gitHubConnectionRecovery.useTheSecretSavedWhen")}</p>
        <Input id="github-webhook-secret" type="password" autoComplete="off" disabled={pending} value={credentials.webhookSecret} onChange={event => setCredentials({ ...credentials, webhookSecret: event.target.value })} />
      </div>}
      {credentialFields?.includes("clientSecret") && <div className="space-y-2">
        <CredentialLabel id="github-client-secret" label="Client secret" help="The client secret for this GitHub App’s user authentication. Leave the saved private key in place." />
        <Input id="github-client-secret" type="password" autoComplete="off" disabled={pending} value={credentials.clientSecret ?? ""} onChange={event => setCredentials({ ...credentials, clientSecret: event.target.value })} />
      </div>}
    </div>}
    <SetupWizardFooter onSaveExit={onExit} disabled={pending}>
      <Button aria-label={actionLabel} disabled={pending || incomplete || rotationUncertain || (rotateWebhookSecret && !rotationSecret && !rotationAlreadyCommitted)} onClick={() => void connect()}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span className="sm:hidden" aria-hidden="true">{pending ? t("gitHubConnectionRecovery.checking") : reconnect ? t("gitHubConnectionRecovery.reconnect") : t("common.connect")}</span>
        <span className="hidden sm:inline" aria-hidden="true">{actionLabel}</span>
      </Button>
    </SetupWizardFooter>
  </div>;
}
