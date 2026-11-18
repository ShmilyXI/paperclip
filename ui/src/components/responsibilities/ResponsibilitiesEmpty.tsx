import { t } from "@/i18n";
import { Bot, Compass } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { usePrimaryAgentPresentation } from "@/components/primary-agent/PrimaryAgentPresentation";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";
import { agentRouteRef } from "@/lib/utils";

/** Nothing owned and nothing proposed yet: add a responsibility, or ask the primary agent to draft them. */
export function ResponsibilitiesEmpty({ companyId, onAdd }: { companyId: string; onAdd: () => void }) {
  const primary = usePrimaryAgentPresentation(companyId);
  const agent = primary?.primaryAgent ?? null;
  return (
    <div className="flex flex-col items-center gap-2">
      <EmptyState
        icon={Compass}
        title={t("addResponsibilityDialog.whatDoYouOwn")}
        message={t("responsibilities.emptyMessage")}
        action={t("addResponsibilityDialog.title")}
        onAction={onAdd}
      />
      {agent ? (
        <Button asChild variant="ghost">
          <Link to={`/chats/${encodeURIComponent(agentRouteRef(agent))}`}>
            <Bot aria-hidden="true" />
            {t("responsibilities.askNameToDraftThem", { name: agent.name })}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
