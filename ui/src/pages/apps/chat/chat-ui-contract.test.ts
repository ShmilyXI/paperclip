import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("chat connector UI contract", () => {
  it("describes the close command as a conversation control rather than a task status change", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expect(setup).toContain('t("chatSetup.closeTheActiveChatConversation")');
    expect(setup).not.toContain("Close the active Paperclip task");
  });

  it("retries the selected failed run from every Board entry point", () => {
    for (const file of [
      "AgentDetail.tsx",
      "AgentDetail.production.tsx",
      "Inbox.tsx",
      "LegacyInbox.tsx",
    ]) {
      const page = source(`../../${file}`);
      expect(page).toMatch(
        /agentsApi\.retryFailedRun\(\s*run\.agentId,\s*run\.id,\s*run\.companyId,?\s*\)/,
      );
      expect(page).not.toContain('reason: "retry_failed_run"');
      expect(page).toContain("newRun.runId");
      expect(page).toContain("newRun.issueId");
    }
    const issue = source("../../IssueDetail.tsx");
    expect(issue).toMatch(
      /agentsApi\.retryFailedRun\(\s*failedRun\.agentId,\s*failedRun\.runId,\s*companyId/,
    );
    expect(issue).toContain("issueDetail.retryQueued");
    for (const file of ["Inbox.tsx", "LegacyInbox.tsx"]) {
      const page = source(`../../${file}`);
      expect(page).toMatch(
        /const retryRunMutation = useMutation\(\{[\s\S]*?onError: \(error\) => \{\s*pushToast\(\{\s*title: (?:"Run retry failed"|t\("[\w.]*[rR]unRetryFailed"\))/,
      );
    }
  });
  it("keeps the exact dual-purpose choice and immutable searchable agent selection", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expect(setup).toContain('t("chatSetup.chatWithAnAgent")');
    expect(setup).toContain('t("chatSetup.useThisConnectionAsAn")');
    expect(setup).toContain("<AgentSelect");
    expect(setup).not.toContain("Change agent");
  });

  it("provides every settled detail tab and no detach control", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    for (const tab of ["settings", "access", "conversations", "activity"]) {
      expect(detail).toContain(`"${tab}"`);
    }
    expect(detail).not.toContain('"overview"');
    expect(detail.toLowerCase()).not.toContain("detach");
  });

  it("shows independent Slack callback surfaces and public URL drift", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    expect(detail).toContain('t("chatDetail.slackCallbackHealth")');
    expect(detail).toContain('t("chatDetail.eventsApi")');
    expect(detail).toContain('t("chatDetail.interactivity")');
    expect(detail).toContain('t("chatDetail.slashCommand")');
    expect(detail).toContain("callbacksNeedUpdate");
    expect(detail).toContain('t("chatDetail.slackCallbackUrlsNeedAn")');
    expect(detail).toContain('t("chatDetail.notObserved")');
  });

  it("keeps provider capabilities automatic and settings focused on plausible reach", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const setup = source("./ChatEndpointSetup.tsx");
    expect(detail).toContain('t("chatDetail.allowDirectMessages")');
    expect(detail).toContain('t("chatDetail.allowGroupChats")');
    // Both the isolated-task scope and the refusal of requests when isolation
    // is unavailable live in this single guest-access description.
    expect(detail).toContain('t("chatDetail.peopleWithoutLinkedAccountsCan")');
    expect(setup).toContain('t("chatSetup.linkTheAccountYouRe")');
    expect(setup).toContain('t("chatSetup.anObservedExternalAccountIs"');
    expect(setup).toContain('t("chatSetup.reviewIdentityAccess")');
    expect(setup).toContain("instanceSettingsApi.getExperimental()");
    expect(setup).toContain("chatEndpointsApi.listPrincipals(endpointId)");
    expect(setup).toContain("queryKeys.chatEndpoints.detail(next.id)");
    expect(setup).toContain('target="_blank" rel="noopener noreferrer"');
    expect(detail).not.toContain("Enable streaming");
    expect(detail).not.toContain("Delivery transport");
  });

  it("explains Discord's independent per-server direct-message restriction", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    expect(detail).toContain('endpoint.provider === "discord"');
    expect(detail).toContain(
      't("chatDetail.peopleMustAlsoEnableDirect")',
    );
  });

  it("offers only real connection lifecycle actions", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const settings = detail.slice(
      detail.indexOf("function Settings"),
      detail.indexOf("function SettingToggle"),
    );
    const activity = detail.slice(detail.indexOf("function Activity"));
    expect(detail).toContain('"pause" | "resume" | "remove"');
    expect(detail).toContain('t("chatDetail.removeThisConnection")');
    expect(detail).toContain("purpose=chat&resume=${endpoint.id}");
    expect(detail).toContain('? "" : "&reconnect=1"');
    expect(detail).toContain('t("chatDetail.finishSetup")');
    expect(detail).toContain('t("chatDetail.continueSetup")');
    expect(detail).toContain('endpoint.setup?.step !== "complete"');
    expect(detail).toContain('t("chatDetail.reconnect")');
    expect(detail).not.toContain("Change agent");
    for (const key of [
      "chatDetail.pause",
      "chatDetail.resume",
      "chatDetail.reconnect",
      "chatDetail.removeConnection",
    ]) {
      expect(activity).toContain(`t("${key}")`);
      // Guidance may name an action that lives on Activity; only controls
      // must stay out of the Settings surface.
      const settingsButtons = settings.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
      expect(settingsButtons.join("\n")).not.toContain(key);
    }
  });

  it("states the provider boundary for reconnect and removal", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const setup = source("./ChatEndpointSetup.tsx");
    // [Slack, GitHub, Discord, Microsoft Teams, Telegram] reconnect guidance.
    for (const suffix of [
      "OrReplacesCredentials",
      "ThisSameApp",
      "ThisSameDiscord",
      "ThisSameMicrosoft",
      "ThisSameBotfather",
    ]) {
      expect(detail).toContain(`t("chatDetail.reconnectVerifies${suffix}")`);
      expect(setup).toContain(`t("chatSetup.reconnectVerifies${suffix}")`);
    }
    // Removal guidance: Slack, GitHub, Discord, Microsoft Teams, Telegram.
    for (const key of [
      "chatDetail.paperclipArchivesTheEndpointStops",
      "chatDetail.paperclipArchivesTheEndpointStops2",
      "chatDetail.paperclipArchivesTheEndpointStops3",
      "chatDetail.paperclipArchivesTheEndpointStops4",
      "chatDetail.paperclipArchivesTheEndpointAnd",
    ]) {
      expect(detail).toContain(`t("${key}")`);
    }
  });

  it("uses only executable provider credential flows", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    for (const credential of [
      "botToken",
      "appId",
      "applicationId",
      "guildId",
      "clientId",
      "tenantId",
      "clientSecret",
    ]) {
      expect(setup).toContain(`\"${credential}\"`);
    }
    expect(setup).toContain("credentials.privateKey");
    expect(setup).toContain("credentials.signingSecret");
    expect(setup).toContain('t("chatSetup.createSlackApp")');
    expect(setup).toContain('t("chatSetup.createOrConnectAGithub")');
    expect(setup).toContain('t("chatSetup.entraCreateAppRegistration")');
    expect(setup).toContain('t("chatSetup.createABotWithBotfather")');
    expect(setup).toContain('t("chatSetup.createOneDedicatedDiscordApplication")');
    expect(setup).toContain('t("chatSetup.discordCreateBot")');
    expect(setup).toContain('t("chatSetup.discordInstallScopes")');
    expect(setup).toContain("permissions=309237763136&scope=bot");
    expect(setup).not.toContain("applications.commands");
    expect(setup).toContain('t("chatSetup.generateWebhookSecret")');
    expect(setup).toContain('t("chatSetup.copyThisValueNowPaperclip")');
    expect(setup).toContain('params.get("reconnect") === "1"');
    expect(setup).toContain(
      't("chatSetup.reconnectVerifiesThisSameBotfather")',
    );
    expect(setup).toContain(
      't("chatSetup.reconnectVerifiesOrReplacesCredentials")',
    );
    expect(setup).toContain(
      't("chatSetup.regeneratingImmediatelyInvalidatesGithubWebhook")',
    );
    expect(setup).toContain("generatingSetupSecret ||\n            pending");
    expect(setup).not.toContain("/setprivacy");
    expect(setup).toContain("/task@bot_username");
    expect(setup).toContain('t("chatSetup.telegramPrivacyPrefix")');
    expect(setup).toContain('t("chatSetup.createAzureBot")');
    // Microsoft 365 requirement: work/school org, teams.live.com exclusion,
    // commercial-cloud-only support, GCC High / DoD / 21Vianet caveats.
    expect(setup).toContain('t("chatSetup.microsoft365Requirement")');
    expect(setup).toContain('t("chatSetup.clientSecretValue")');
    expect(setup).toContain('t("chatSetup.microsoftPortalFieldMap")');
    expect(setup).toContain('t("chatSetup.entraAdminCenterSteps")');
    expect(setup).toContain('t("chatSetup.azureBotSteps")');
    expect(setup).toContain('t("chatSetup.teamsDeveloperPortalSteps")');
    expect(setup).toContain('t("chatSetup.teamsManageAppsSteps")');
    expect(setup).toContain('t("chatSetup.copyManifestSettings")');
    expect(setup).toContain("disabled={!credentials.clientId?.trim()}");
    expect(setup).toContain('t("chatSetup.enterClientIdBeforeCopying")');
    expect(setup).toContain('scopes: ["personal", "team", "groupChat"]');
    expect(setup).toContain('scopes: ["personal", "groupChat"]');
    expect(setup).toContain('title: "/status"');
    expect(setup).toContain('title: "/new"');
    expect(setup).toContain('title: "/close"');
    expect(setup).not.toContain("supportsTargetedMessages");
    expect(setup).toContain("resourceSpecific");
    expect(setup).toContain("ChannelMessage.Read.Group");
    expect(setup).toContain("ChatMessage.Read.Chat");
    expect(setup).toContain('t("chatSetup.teamsPortalCreateApp")');
    expect(setup).toContain('t("chatSetup.noTeamsSingleSignOnPrefix")');
    expect(setup).toContain("webApplicationInfo");
    expect(setup).toContain('resource: "https://paperclip.ing"');
    expect(setup).toContain('t("chatSetup.noTeamsSingleSignOnSuffix")');
    expect(setup).toContain('t("chatSetup.rscPermissionsExplanation")');
    expect(setup).toContain('t("chatSetup.teamsChannelSupportPrefix")');
    expect(setup).toContain('t("chatSetup.teamsChannelSupportSuffix")');
    expect(setup).toContain("issue_comment");
    expect(setup).toContain("pull_request");
    expect(setup).toContain("pull_request_review_comment");
    expect(setup).toContain('t("chatSetup.enableSslVerification")');
    expect(setup).toContain('t("chatSetup.onlyOnThisAccount")');
    expect(setup).toContain('type="password"');
    expect(setup).not.toContain("WebkitTextSecurity");
    expect(setup).toContain('t("chatSetup.verifySlackConnection")');
    expect(setup).toContain("buildSlackAppManifest");
    expect(setup).toContain("defaultSlackAppConfiguration");
    expect(setup).not.toContain("No credentials");
    expect(setup).not.toContain("managed Microsoft app");
    expect(setup).toContain("slackSetupState({ endpoint, repairing");
    expect(source("./slack/setup-state.ts")).toContain("endpoint.providerAccountId && !repairing");
    expect(setup).not.toContain('field("webhookSecret"');
    expect(setup).not.toContain("@paperclipai/teams-connect");
    expect(setup).not.toContain("Copy setup command");
    expect(setup).not.toContain("Add {agentName} to Slack");
    expect(setup).not.toContain("Create in GitHub");
  });

  it("keeps provider setup failures visible without rendering submitted credentials", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expect(setup).toContain("sanitizedSetupErrorMessage");
    expect(setup).toContain('role="alert"');
    expect(setup).toContain("onMutate: () => setSetupError(null)");
    expect(setup).not.toContain('title: "Connection failed"');
  });

  it("keeps GitHub setup on the shipped customer-owned App path", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expect(setup).toContain('t("chatSetup.generateWebhookSecret")');
    expect(setup).toContain('t("chatSetup.githubAppId")');
    expect(setup).toContain('t("chatSetup.privateKeyPem")');
    expect(setup).toContain('t("chatSetup.choosePemFile")');
    expect(setup).toContain('t("chatSetup.chooseGithubAppPrivateKey")');
    expect(setup).toContain("readGitHubPrivateKeyFile");
    expect(setup).toContain("privateKeyReadGuard.invalidate()");
    expect(setup).toContain("privateKeyFileLoading ||");
    expect(setup).toContain('t("chatSetup.showPrivateKey")');
    expect(setup).toContain('type="password"');
    expect(setup).toContain('event.clipboardData.getData("text")');
    expect(setup).not.toContain("WebkitTextSecurity");
  });
});
