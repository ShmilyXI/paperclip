import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/InlineBanner";
import { ConnectionChoiceList } from "../ConnectionChoiceList";

/** Shared presentation for account reuse, including the requested external app. */
export function RemoteMcpAccountChoice({
  providerName,
  upstreamServiceName,
  connections,
  pendingId,
  error,
  onSelect,
  onCancel,
  onConnectNew,
}: {
  providerName: string;
  upstreamServiceName?: string;
  connections: { id: string; name: string }[];
  pendingId?: string | null;
  error?: string | null;
  onSelect: (id: string) => void;
  onCancel?: () => void;
  onConnectNew: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">
          {upstreamServiceName
            ? t("remoteMcpAccountChoice.connectUpstreamservicenameThroughProvidername", { upstreamServiceName, providerName })
            : t("remoteMcpAccountChoice.connectProvidername", { providerName })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("remoteMcpAccountChoice.useAnExistingConnectionOr")}
        </p>
      </div>
      {upstreamServiceName && (
        <InlineBanner compact>
          {providerName} is an external service that handles the connection and
          requests to {upstreamServiceName}. Reusing this account does not yet
          verify app access; the agent will check it and guide any additional
          authorization.
        </InlineBanner>
      )}
      <ConnectionChoiceList
        choices={connections.map((connection) => ({
          ...connection,
          description: t("remoteMcpAccountChoice.providerAccountAvailable"),
        }))}
        pendingId={pendingId}
        onSelect={onSelect}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          disabled={Boolean(pendingId)}
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button disabled={Boolean(pendingId)} onClick={onConnectNew}>
          {t("remoteMcpAccountChoice.connectNew")}
        </Button>
      </div>
    </div>
  );
}
