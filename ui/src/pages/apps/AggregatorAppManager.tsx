import { t } from "@/i18n";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { ToolConnection } from "@paperclipai/shared";
import { AGGREGATOR_NAMES, aggregatorManagementUrl, isAppAggregator } from "@paperclipai/shared/aggregator-apps";
import type { AggregatorAppCatalogEntry } from "@paperclipai/shared/aggregator-app-catalog";
import { toolsApi } from "@/api/tools";
import { useAccountIdentity } from "@/api/companies-query";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AggregatorAppManager({ app, connections, initialConnectionId, onClose }: {
  app: AggregatorAppCatalogEntry; connections: ToolConnection[]; initialConnectionId?: string; onClose: () => void;
}) {
  const [connectionId, setConnectionId] = useState(initialConnectionId ?? connections[0]?.id ?? "");
  const connection = connections.find(candidate => candidate.id === connectionId);
  const provider = connection?.config?.sourceTemplateKey;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{t("aggregatorAppManager.manageName", { name: app.name })}</DialogTitle>
      <DialogDescription>{t("aggregatorAppManager.accountsManagedIn", { provider: isAppAggregator(provider) ? AGGREGATOR_NAMES[provider] : t("aggregatorAppManager.theProvider") })}</DialogDescription>
    </DialogHeader>
    {connections.length > 1 ? <div className="space-y-2"><Label htmlFor="manage-aggregator-gateway">{t("common.connection")}</Label>
      <select id="manage-aggregator-gateway" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={connectionId} onChange={event => setConnectionId(event.target.value)}>
        {connections.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
      </select></div> : null}
    {connection ? <AccountObservations key={connection.id} app={app} connection={connection} onClose={onClose} /> : <p role="alert">{t("aggregatorAppManager.thisConnectionIsNoLonger")}</p>}
  </DialogContent></Dialog>;
}

function AccountObservations({ app, connection, onClose }: { app: AggregatorAppCatalogEntry; connection: ToolConnection; onClose: () => void }) {
  const queries = useQueryClient();
  const { userId, settled } = useAccountIdentity();
  const key = queryKeys.tools.aggregatorApps(connection.id, userId);
  const query = useQuery({ queryKey: key, enabled: settled, queryFn: () => toolsApi.listAggregatorApps(connection.id), refetchInterval: query => query.state.data?.sync.status === "syncing" ? 1500 : false });
  const snapshots = (settled ? query.data?.apps : undefined)?.filter(snapshot => snapshot.appSlug === app.slug) ?? [];
  const accounts = snapshots.flatMap(snapshot => snapshot.accounts.map(account => ({ account, snapshot })));
  const refresh = useMutation({ mutationFn: async () => { const result = await toolsApi.refreshAggregatorApps(connection.id, snapshots.map(snapshot => snapshot.toolkit)); queries.setQueryData(key, result); } });
  const provider = query.data?.provider;
  const name = provider ? AGGREGATOR_NAMES[provider] : t("aggregatorAppManager.provider");
  const managementUrl = provider ? aggregatorManagementUrl(provider, accounts[0]?.account.managementUrl ?? (typeof connection.config?.managementUrl === "string" ? connection.config?.managementUrl : null)) : null;
  return <>
    {query.isError || refresh.isError || query.data?.sync.status === "error" ? <p role="alert" className="text-sm text-destructive">{t("aggregatorAppManager.couldnTCheckName", { name })}</p> : null}
    {query.isLoading ? <p role="status" className="text-sm text-muted-foreground">{t("aggregatorAppManager.loadingAccounts")}</p> : accounts.length ? <div className="divide-y divide-border">
      {accounts.map(({ account, snapshot }) => <div key={`${snapshot.toolkit}:${account.id}`} className="py-3">
        <p className="text-sm font-medium">{account.alias || t("aggregatorAppManager.nameAccount", { name: app.name })}</p>
        <p className="text-xs text-muted-foreground">{snapshot.freshness === "stale" || snapshot.errorAt || Date.now() - new Date(snapshot.checkedAt).getTime() > 5 * 60_000 || account.status === "UNVERIFIED" ? t("aggregatorAppManager.notVerified") : account.status === "ACTIVE" ? t("common.connected") : account.status === "INITIATED" ? t("aggregatorAppManager.waitingForSignIn") : t("aggregatorAppManager.needsSignIn")}</p>
      </div>)}
    </div> : <p className="text-sm text-muted-foreground">{query.data?.discovery.message ?? t("aggregatorAppManager.noConnectedNameAccounts", { name: app.name })}</p>}
    <p className="text-xs text-muted-foreground">{t("aggregatorAppManager.via")} <Link to={`/apps/${connection.id}/permissions`} onClick={onClose} className="underline underline-offset-2">“{connection.name}”</Link></p>
    <DialogFooter className="sm:justify-between"><Button variant="ghost" onClick={onClose}>{t("common.close")}</Button><div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" disabled={!settled || refresh.isPending || query.data?.discovery.availability !== "available"} onClick={() => refresh.mutate()}>{t("common.refresh")}</Button>
      {managementUrl ? <Button asChild><a href={managementUrl} target="_blank" rel="noopener noreferrer">{t("aggregatorAppManager.openIn", { name })}<ExternalLink className="size-4" /></a></Button> : null}
    </div></DialogFooter>
  </>;
}
