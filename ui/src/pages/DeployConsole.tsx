import { t } from "@/i18n";
import { EmbeddedSite } from "./EmbeddedSite";

/** Mowa's deploy console: a local service reverse-proxied to this domain; it asks for its operator key itself. */
export const DEPLOY_CONSOLE_URL = "https://ai-opc-deploy.culud.com";

export function DeployConsole() {
  return <EmbeddedSite pageKey="deploy-console" title={t("nav.deployConsole")} url={DEPLOY_CONSOLE_URL} />;
}
