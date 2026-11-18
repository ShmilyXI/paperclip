import { t } from "@/i18n";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { ChangeEvent, type ReactNode, useEffect, useId, useState } from "react";
import { AgentObservabilitySettingsSection } from "../components/observability/AgentObservabilitySettings";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type InteractionResolverGovernance,
  type IssueThreadInteractionKind,
} from "@paperclipai/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useOptionalToastActions } from "../context/ToastContext";
import { useCloudInstance } from "../hooks/useCloudInstance";
import { resolveCompanyArchiveDeparture } from "../lib/company-selection";
import { cloudPortfolioManageUrl } from "../lib/cloudLinks";
import { navigateTopLevel } from "@/lib/browserNavigation";
import { companiesApi } from "../api/companies";
import { accessApi } from "../api/access";
import { assetsApi } from "../api/assets";
import { describeError } from "@/api/errors";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import {
  InteractionGovernancePanel,
  applyGovernanceChange,
  type GovernanceField,
  type GovernanceSelectValue,
} from "../components/InteractionGovernancePanel";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import {
  Field,
  HintIcon,
  ToggleField,
} from "../components/agent-config-primitives";
import { InstanceGeneralSettings } from "./InstanceGeneralSettings";

export function CompanySettings() {
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
    setSelectedCompanyId
  } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toastActions = useOptionalToastActions();
  const cloud = useCloudInstance();
  // Managed instances derive the task ID prefix from the company name, so a
  // rename here also renumbers the existing task IDs.
  const isCloudManaged = Boolean(cloud);
  // General settings local state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [governance, setGovernance] = useState<InteractionResolverGovernance>({});

  // Sync local state from the selected company. Keyed on the saved values, not
  // the company object: the sections that save on change (Hiring, Decisions,
  // governance, logo) refetch the company list, and that fresh object must not
  // wipe an unsaved name or description draft.
  const savedName = selectedCompany?.name ?? null;
  const savedDescription = selectedCompany?.description ?? "";
  const savedLogoUrl = selectedCompany?.logoUrl ?? "";
  const savedGovernance = selectedCompany?.interactionResolverGovernance;
  useEffect(() => {
    if (savedName === null) return;
    setCompanyName(savedName);
    setDescription(savedDescription);
  }, [selectedCompanyId, savedName, savedDescription]);
  useEffect(() => {
    if (savedName === null) return;
    setLogoUrl(savedLogoUrl);
    setGovernance(savedGovernance ?? {});
  }, [selectedCompanyId, savedName, savedLogoUrl, savedGovernance]);

  const generalDirty =
    !!selectedCompany &&
    (companyName !== selectedCompany.name ||
      description !== (selectedCompany.description ?? ""));

  const generalMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string | null;
    }) => companiesApi.update(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  // Members populate the default decision owner and budget owner pickers.
  // Ownerless "Needs You" cards route to the default decision owner's "For
  // you" list; clearing it sends them to the claimable Unassigned pool
  // (PAP-749 task 1d-lite). A budget hard stop also goes to the budget owner,
  // and Company keeps showing it (task 1d).
  const membersQuery = useQuery({
    queryKey: queryKeys.access.companyMembers(selectedCompanyId ?? ""),
    queryFn: () => accessApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Each owner saves on change with only its own field, so neither belongs to
  // the General draft or its "Save changes" button. Waiting for the refetch
  // keeps the picker on the new owner instead of flashing back to the old one.
  async function saveDefaultDecisionOwner(defaultDecisionOwnerUserId: string | null) {
    const company = await companiesApi.update(selectedCompanyId!, { defaultDecisionOwnerUserId });
    await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    return company;
  }

  async function saveBudgetOwner(budgetOwnerUserId: string | null) {
    const company = await companiesApi.update(selectedCompanyId!, { budgetOwnerUserId });
    await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    return company;
  }

  const membersView = useQueryView(membersQuery);
  const memberOptions = (membersQuery.data?.members ?? [])
    .filter((member) => member.user?.id)
    .map((member) => (
      <option key={member.user!.id} value={member.user!.id}>
        {member.user!.name || member.user!.email || member.user!.id}
      </option>
    ));

  const governanceMutation = useMutation({
    mutationFn: (next: InteractionResolverGovernance) =>
      companiesApi.update(selectedCompanyId!, { interactionResolverGovernance: next }),
    onSuccess: (company) => {
      setGovernance(company.interactionResolverGovernance ?? {});
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  function handleGovernanceChange(
    kind: IssueThreadInteractionKind,
    field: GovernanceField,
    value: GovernanceSelectValue,
  ) {
    const next = applyGovernanceChange(governance, kind, field, value);
    setGovernance(next);
    governanceMutation.mutate(next);
  }

  const syncLogoState = (nextLogoUrl: string | null) => {
    setLogoUrl(nextLogoUrl ?? "");
    void queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
  };

  const logoUploadMutation = useMutation({
    mutationFn: (file: File) =>
      assetsApi
        .uploadCompanyLogo(selectedCompanyId!, file)
        .then((asset) => companiesApi.update(selectedCompanyId!, { logoAssetId: asset.assetId })),
    onSuccess: (company) => {
      syncLogoState(company.logoUrl);
      setLogoUploadError(null);
    }
  });

  const clearLogoMutation = useMutation({
    mutationFn: () => companiesApi.update(selectedCompanyId!, { logoAssetId: null }),
    onSuccess: (company) => {
      setLogoUploadError(null);
      syncLogoState(company.logoUrl);
    }
  });

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;
    setLogoUploadError(null);
    logoUploadMutation.mutate(file);
  }

  function handleClearLogo() {
    clearLogoMutation.mutate();
  }

  const archiveMutation = useMutation({
    mutationFn: ({ companyId }: { companyId: string }) =>
      companiesApi.archive(companyId),
    onSuccess: async (_result, { companyId }) => {
      // Never stay on the archived company's settings: the only visible
      // change would be the archive button going inert. Leave for wherever
      // still makes sense (another active company, the Cloud portfolio, or
      // the companies list), with a toast naming what happened.
      const archived = companies.find((company) => company.id === companyId);
      const archivedName = archived?.name ?? t("common.organization");
      const departure = resolveCompanyArchiveDeparture({
        archivedCompanyId: companyId,
        companies,
        cloudPortfolioUrl: cloudPortfolioManageUrl(cloud?.cloudBaseUrl),
      });
      if (departure.kind === "cloud_portfolio") {
        // The whole organization is on its way to being archived by the
        // control plane; a full navigation to the Cloud portfolio replaces
        // this document, so cache invalidation below would never run.
        navigateTopLevel(departure.url);
        return;
      }
      if (departure.kind === "company") {
        toastActions?.pushToast({
          title: t("settings.archivednameIsArchived", { archivedName }),
          body: t("settings.switchedToName", { name: departure.company.name }),
          tone: "info",
          dedupeKey: `company-archive-departure:${companyId}`,
        });
        setSelectedCompanyId(departure.company.id);
        navigate(`/${departure.company.issuePrefix}/dashboard`, { replace: true });
      } else {
        toastActions?.pushToast({
          title: t("settings.archivednameIsArchived", { archivedName }),
          body: t("settings.youCanUnarchiveItFrom"),
          tone: "info",
          dedupeKey: `company-archive-departure:${companyId}`,
        });
        navigate(`/${archived?.issuePrefix ?? ""}/companies`, { replace: true });
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats
      });
    }
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("common.company"), href: "/dashboard" },
      { label: t("common.settings") }
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings.noOrganizationSelectedSelectAn")}
      </div>
    );
  }

  function handleSaveGeneral() {
    generalMutation.mutate({
      name: companyName.trim(),
      description: description.trim() || null
    });
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t("common.general")}</h1>
      </div>

      {/* General */}
      <div className="max-w-2xl space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("common.general")}
        </div>
        <div className="space-y-3">
          <Field label={t("settings.organizationName")} hint={t("settings.theDisplayNameForYour")}>
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            {isCloudManaged && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("settings.renamingCanChangeThisCompany")}
              </p>
            )}
          </Field>
          <Field
            label={t("common.description")}
            hint={t("settings.optionalDescriptionShownInThe")}
          >
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={description}
              placeholder={t("settings.optionalOrganizationDescription")}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Appearance */}
      <div className="max-w-2xl space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("settings.appearance")}
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <CompanyPatternIcon
                companyName={companyName || selectedCompany.name}
                logoUrl={logoUrl || null}
                className="rounded-(--rad-14)"
              />
            </div>
            <div className="flex-1 space-y-3">
              <Field
                label={t("common.logo")}
                hint={t("settings.uploadAPngJpegWebp")}
              >
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs"
                  />
                  {logoUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClearLogo}
                        disabled={clearLogoMutation.isPending}
                      >
                        {clearLogoMutation.isPending ? "Removing..." : t("settings.removeLogo")}
                      </Button>
                    </div>
                  )}
                  {(logoUploadMutation.error || logoUploadError) && (
                    <span className="text-xs text-destructive">
                      {logoUploadError ?? describeError(logoUploadMutation.error).body}
                    </span>
                  )}
                  {clearLogoMutation.error && (
                    <span className="text-xs text-destructive">
                      {describeError(clearLogoMutation.error).body}
                    </span>
                  )}
                  {logoUploadMutation.isPending && (
                    <span className="text-xs text-muted-foreground">{t("settings.uploadingLogo")}</span>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* Save button for General + Appearance */}
      {generalDirty && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveGeneral}
            disabled={generalMutation.isPending || !companyName.trim()}
          >
            {generalMutation.isPending ? t("common.saving") : t("common.saveChanges")}
          </Button>
          {generalMutation.isSuccess && (
            <span className="text-xs text-muted-foreground">{t("common.saved")}</span>
          )}
          {generalMutation.error && (
            <span className="text-xs text-destructive">
              {describeError(generalMutation.error).body}
            </span>
          )}
        </div>
      )}

      {/* Hiring */}
      <div className="max-w-2xl space-y-4" data-testid="company-settings-team-section">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("common.hiring")}
        </div>
        <div>
          <ToggleField
            label={t("settings.requireBoardApprovalForNew")}
            hint={t("settings.newAgentHiresStayPending")}
            checked={!!selectedCompany.requireBoardApprovalForNewAgents}
            onChange={(v) => settingsMutation.mutate(v)}
            toggleTestId="company-settings-team-approval-toggle"
          />
        </div>
      </div>

      {/* Decisions */}
      <div className="max-w-2xl space-y-4" data-testid="company-settings-decisions-section">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("companySettings.decisions")}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("companySettings.eachOwnerSavesAsSoonAs")}
          </p>
        </div>
        {membersView.kind === "error" ? <QueryErrorState error={membersView.error} onRetry={membersView.retry} /> : null}
        <DecisionOwnerField
          label={t("companySettings.defaultDecisionOwner")}
          hint={t("companySettings.defaultDecisionOwnerHint")}
          testId="company-settings-default-decision-owner"
          unsetLabel={t("companySettings.unassignedNoDefaultOwner")}
          savedUserId={selectedCompany.defaultDecisionOwnerUserId ?? null}
          memberOptions={memberOptions}
          membersLoading={membersQuery.isLoading}
          fallbackError={t("companySettings.couldntSaveDefaultDecisionOwner")}
          save={saveDefaultDecisionOwner}
        />
        <DecisionOwnerField
          label={t("companySettings.budgetOwner")}
          hint={t("companySettings.budgetOwnerHint")}
          testId="company-settings-budget-owner"
          unsetLabel={t("companySettings.noBudgetOwnerCompanyViewOnly")}
          savedUserId={selectedCompany.budgetOwnerUserId ?? null}
          memberOptions={memberOptions}
          membersLoading={membersQuery.isLoading}
          fallbackError={t("companySettings.couldntSaveBudgetOwner")}
          save={saveBudgetOwner}
        />
      </div>

      {/* Interaction governance. Held to the form column like the sections
          above; the wrapper scrolls rather than letting the policy grid push
          past the column when the content area is narrow. The padding keeps
          the selects' focus rings inside the scroll box, and the negative
          inline margin keeps the panel aligned with the other sections. */}
      <div
        className="-mx-1 min-w-0 max-w-2xl overflow-x-auto p-1"
        data-testid="company-settings-interaction-governance-frame"
      >
        <InteractionGovernancePanel
          governance={governance}
          onChange={handleGovernanceChange}
          isPending={governanceMutation.isPending}
          errorMessage={governanceMutation.error ? describeError(governanceMutation.error).body : null}
        />
      </div>
      <AgentObservabilitySettingsSection companyId={selectedCompanyId!} />

      <InstanceGeneralSettings embedded />

      {/* Danger Zone */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-destructive uppercase tracking-wide">
          {t("settings.dangerZone")}
        </div>
        <div className="space-y-3 bg-destructive/5 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            {t("settings.archiveThisOrganizationToHide")}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={
                archiveMutation.isPending ||
                selectedCompany.status === "archived"
              }
              onClick={() => {
                if (!selectedCompanyId) return;
                const confirmed = window.confirm(
                  t("settings.archiveOrganizationNameItWill", { name: selectedCompany.name })
                );
                if (!confirmed) return;
                archiveMutation.mutate({ companyId: selectedCompanyId });
              }}
            >
              {archiveMutation.isPending
                ? t("companySettings.archiving")
                : selectedCompany.status === "archived"
                ? t("settings.alreadyArchived")
                : t("settings.archiveOrganization")}
            </Button>
            {archiveMutation.error && (
              <span className="text-xs text-destructive">
                {describeError(archiveMutation.error).body}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One Decisions owner picker. It saves on change, on its own, so the page's
 * General "Save changes" never carries it. A real `<label htmlFor>` names the
 * select, and the line under it reports saving, saved, or the server's error
 * (for example the 422 for an owner who is not an active member).
 */
function DecisionOwnerField({
  label,
  hint,
  testId,
  unsetLabel,
  savedUserId,
  memberOptions,
  membersLoading,
  fallbackError,
  save,
}: {
  label: string;
  hint: string;
  testId: string;
  unsetLabel: string;
  savedUserId: string | null;
  memberOptions: ReactNode;
  membersLoading: boolean;
  fallbackError: string;
  save: (userId: string | null) => Promise<unknown>;
}) {
  const controlId = useId();
  const errorId = `${controlId}-error`;
  const mutation = useMutation({
    mutationFn: save,
    // Quick successive picks save in order, so the last choice is what sticks.
    scope: { id: `company-settings:${testId}` },
  });
  // Show the choice while it saves. Otherwise show what the server holds, so
  // a rejected owner snaps back beside its error.
  const value = mutation.isPending ? (mutation.variables ?? "") : (savedUserId ?? "");
  const errorMessage = mutation.error ? describeError(mutation.error).body ?? fallbackError : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label htmlFor={controlId} className="text-xs text-muted-foreground">
          {label}
        </label>
        <HintIcon text={hint} />
      </div>
      <NativeSelect
        id={controlId}
        data-testid={testId}
        value={value}
        // Not disabled while saving: disabling would drop keyboard focus.
        disabled={membersLoading}
        aria-busy={mutation.isPending || undefined}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorMessage ? errorId : undefined}
        onChange={(event) => mutation.mutate(event.target.value === "" ? null : event.target.value)}
      >
        <option value="">{unsetLabel}</option>
        {memberOptions}
      </NativeSelect>
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      ) : (
        <p role="status" className="min-h-4 text-xs text-muted-foreground">
          {mutation.isPending ? t("common.saving2") : mutation.isSuccess ? t("common.saved") : null}
        </p>
      )}
    </div>
  );
}
