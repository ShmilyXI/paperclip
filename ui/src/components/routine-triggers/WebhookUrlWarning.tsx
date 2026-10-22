import { t } from "@/i18n";
import { InlineBanner } from "@/components/InlineBanner";
import { webhookUrlWarningReason } from "@/lib/webhook-url-warning";

const warnings = {
  loopback: {
    title: t("triggers.otherAppsCanTReach"),
    message: t("triggers.thisAddressPointsBackTo"),
  },
  private: {
    title: t("triggers.thisWebhookUrlAppearsTo"),
    message: "Only senders with access to this network can reach this address. Apps on the public internet, such as GitHub, usually can’t deliver webhooks here.",
  },
  tailscale: {
    title: t("triggers.thisTailscaleUrlMayNot"),
    message: "Tailscale Serve is private to your tailnet, even with HTTPS. Apps outside your tailnet need Tailscale Funnel or another public HTTPS address. If Funnel is already enabled for this URL, you can continue.",
  },
  https: {
    title: t("triggers.useHttpsForWebhooksFrom"),
    message: t("triggers.thisUrlUsesHttpMany"),
  },
  invalid: {
    title: t("triggers.checkTheWebhookUrl"),
    message: t("triggers.thisIsNotAValid"),
  },
};

export function WebhookUrlWarning({ url }: { url: string }) {
  const reason = webhookUrlWarningReason(url);
  if (!reason) return null;
  const warning = warnings[reason];
  return <InlineBanner tone="warning" title={warning.title}>
    <div className="space-y-2">
      <p>{warning.message}</p>
      <p>{t("triggers.youCanContinueForLocal")}</p>
      <a className="underline underline-offset-4" href="https://docs.paperclip.ing/reference/deploy/https/" target="_blank" rel="noopener noreferrer">{t("triggers.learnHowToSetUp")}</a>
    </div>
  </InlineBanner>;
}
