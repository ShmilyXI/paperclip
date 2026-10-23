import { t } from "@/i18n";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VoicePhoneConfiguration } from "@paperclipai/shared";
import { voicePhoneApi } from "@/api/voicePhone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
export interface SpekoPhoneLineFormProps { configuration?: VoicePhoneConfiguration; loading?: boolean; saving?: boolean; saved?: boolean; error?: string; onRefresh(): void; onSave(input: {numberId: string; enabled: boolean; guestIntake?: boolean; lowTrustEnvironmentId?: string | null}): void }
export function SpekoPhoneLineForm({configuration, loading, saving, saved, error, onRefresh, onSave}: SpekoPhoneLineFormProps) {
  const [numberId, setNumberId] = useState(configuration?.number?.id ?? ""), [enabled, setEnabled] = useState(configuration?.number?.enabled ?? false), [guestIntake, setGuestIntake] = useState(configuration?.number?.guestIntake ?? false), [invalid, setInvalid] = useState(false), [environmentId, setEnvironmentId] = useState(configuration?.number?.lowTrustEnvironmentId ?? "");
  useEffect(() => {setNumberId(configuration?.number?.id ?? ""); setEnabled(configuration?.number?.enabled ?? false); setGuestIntake(configuration?.number?.guestIntake ?? false); setEnvironmentId(configuration?.number?.lowTrustEnvironmentId ?? "");}, [configuration]);
  const selected = configuration?.inventory.find(n => n.id === numberId);
  return <section className="max-w-xl space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("spekoPhoneLine.incomingCalls")}</h2><Button size="sm" variant="ghost" disabled={loading || saving} onClick={onRefresh}>{t("spekoPhoneLine.refreshNumbers")}</Button></div>
    <p className="text-sm text-muted-foreground">{t("spekoPhoneLine.letCallersStartAConversation")}</p>
    {loading && <p role="status" className="text-sm text-muted-foreground">{t("spekoPhoneLine.loadingSpekoNumbers")}</p>}
    {!loading && !configuration?.inventory.length && <p className="text-sm text-muted-foreground">{t("spekoPhoneLine.noNumbersAreAvailable")} <a className="text-primary underline" href="https://platform.speko.ai" target="_blank" rel="noreferrer">{t("spekoPhoneLine.buyOrImportANumber")}</a>{t("spekoPhoneLine.completeVerificationAndAddCredits")}</p>}
    <form className="space-y-3" onSubmit={event => {event.preventDefault(); if (!numberId || !selected?.available) {setInvalid(true); return;} setInvalid(false); onSave({numberId, enabled, guestIntake, lowTrustEnvironmentId: environmentId || null});}}>
      <label className="grid min-w-0 gap-2 text-sm font-medium">{t("spekoPhoneLine.companyPhoneNumber")}<select aria-label={t("spekoPhoneLine.companyPhoneNumber")} disabled={loading || saving} className="min-w-0 w-full rounded-md border border-input bg-background p-2 text-sm" value={numberId} onChange={event => {setNumberId(event.target.value); setInvalid(false);}}><option value="">{t("spekoPhoneLine.selectANumber")}</option>{configuration?.inventory.map(n => <option key={n.id} value={n.id} disabled={!n.available}>{n.phoneNumber}{n.label ? ` · ${n.label}` : ""}{!n.available ? t("spekoPhoneLine.unavailableSuffix") : ""}</option>)}</select></label>
      {selected && !selected.inboundReady && <p className="text-sm text-muted-foreground">{t("spekoPhoneLine.completeNumberSetupInSpeko")}{selected.issues.length ? ` ${selected.issues.join(". ")}` : ""}</p>}
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={enabled} disabled={loading || saving} onCheckedChange={value => setEnabled(value === true)} />{t("spekoPhoneLine.enableIncomingCallsOnThis")}</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={guestIntake} disabled={loading || saving} onCheckedChange={value => setGuestIntake(value === true)} />{t("spekoPhoneLine.letCallersStartNewLow")}</label>
      {guestIntake && <p className="text-sm text-muted-foreground">{t("spekoPhoneLine.eachCallGetsItsOwn")}</p>}
      {guestIntake && <label className="grid min-w-0 gap-2 text-sm font-medium">{t("spekoPhoneLine.executionSandbox")}<select aria-label={t("spekoPhoneLine.executionSandbox")} disabled={loading || saving} className="min-w-0 w-full rounded-md border border-input bg-background p-2 text-sm" value={environmentId} onChange={event => setEnvironmentId(event.target.value)}><option value="">{t("spekoPhoneLine.useThisAgentSSandbox")}</option>{configuration?.sandboxEnvironments?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><span className="text-sm font-normal text-muted-foreground">{t("spekoPhoneLine.onlyNewIncomingTasksUse")}</span></label>}
      {invalid && <p role="alert" className="text-sm text-destructive">{t("spekoPhoneLine.chooseAnAvailableCompanyPhone")}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{saved ? t("spekoPhoneLine.incomingCallSettingSaved") : ""}</p><Button type="submit" disabled={loading || saving}>{saving ? t("common.saving2") : t("spekoPhoneLine.saveIncomingCallSetting")}</Button></div>
    </form>
  </section>;
}
export function SpekoPhoneLine({companyId, endpointId}: {companyId: string; endpointId: string}) {
  const queryClient = useQueryClient(), key = ["speko-phone-line", companyId, endpointId];
  const query = useQuery({queryKey: key, queryFn: () => voicePhoneApi.configuration(companyId, endpointId), retry: false});
  const mutation = useMutation({mutationFn: (input: {numberId: string; enabled: boolean; guestIntake?: boolean; lowTrustEnvironmentId?: string | null}) => voicePhoneApi.save(companyId, endpointId, input), onSuccess: data => queryClient.setQueryData(key, data)});
  return <SpekoPhoneLineForm configuration={query.data} loading={query.isLoading} saving={mutation.isPending} saved={mutation.isSuccess} error={(mutation.error ?? query.error)?.message} onRefresh={() => void query.refetch()} onSave={input => mutation.mutate(input)} />;
}
