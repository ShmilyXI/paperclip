import { t } from "@/i18n";
import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ToolMcpGatewayContextScopeType, ToolProfileWithDetails } from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { allowedToolsLabel } from "./gateway-helpers";

export const gatewaysQueryKey = (companyId: string) => ["tools", "gateways", companyId] as const;

/**
 * t("newGatewayDialog.newGateway") dialog. A gateway is one safe MCP endpoint that exposes only
 * the tools in its access profile. Matches the prosumer create flow from the
 * PAP-11178 design of record.
 */
export function NewGatewayDialog({
  companyId,
  open,
  onOpenChange,
  onCreated,
}: {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (gatewayId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [profileId, setProfileId] = useState("");

  const profilesQuery = useQuery({
    queryKey: queryKeys.tools.profiles(companyId),
    queryFn: () => toolsApi.listProfiles(companyId),
    enabled: open,
  });
  const activeProfiles = (profilesQuery.data?.profiles ?? []).filter(
    (profile: ToolProfileWithDetails) => profile.status !== "archived",
  );

  useEffect(() => {
    if (open && !profileId && activeProfiles[0]) setProfileId(activeProfiles[0].id);
  }, [open, profileId, activeProfiles]);

  const createMutation = useMutation({
    mutationFn: () =>
      toolsApi.createGateway(companyId, {
        name: name.trim(),
        description: description.trim() || null,
        profileId,
        defaultProfileMode: "gateway_only",
        contextScopeType: "company" satisfies ToolMcpGatewayContextScopeType,
      }),
    onSuccess: async (gateway) => {
      pushToast({ title: t("newGatewayDialog.gatewayCreated"), body: gateway.name, tone: "success" });
      await queryClient.invalidateQueries({ queryKey: gatewaysQueryKey(companyId) });
      setName("");
      setDescription("");
      onOpenChange(false);
      onCreated?.(gateway.id);
    },
    onError: (error) => {
      pushToast({
        title: t("newGatewayDialog.gatewayWasNotCreated"),
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !profileId) return;
    createMutation.mutate();
  }

  const profilesLoading = profilesQuery.isLoading;
  const noProfiles = !profilesLoading && activeProfiles.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newGatewayDialog.newGateway")}</DialogTitle>
          <DialogDescription>
            {t("newGatewayDialog.oneSafeMcpEndpointThat")}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("common.name")}</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("newGatewayDialog.ctoAgents")}
              required
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("newGatewayDialog.accessProfile")}</span>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              required
              disabled={noProfiles}
            >
              <option value="" disabled>
                {profilesLoading ? t("newGatewayDialog.loadingProfiles") : t("newGatewayDialog.chooseAProfile")}
              </option>
              {activeProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} — {allowedToolsLabel(profile)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {t("newGatewayDialog.theProfileDecidesWhichTools")}
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("newGatewayDialog.descriptionOptional")}</span>
            <textarea
              className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("newGatewayDialog.whoThisEndpointIsFor")}
            />
          </label>
          {noProfiles ? (
            <p className="text-xs text-destructive">
              {t("newGatewayDialog.createAnAccessProfileUnder")}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || noProfiles || !name.trim() || !profileId}
            >
              {createMutation.isPending ? t("common.creating") : t("newGatewayDialog.createGateway")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
