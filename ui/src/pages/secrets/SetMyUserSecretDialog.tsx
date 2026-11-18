import { t } from "@/i18n";
import { useEffect, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CompanySecret, UserSecretDefinition } from "@paperclipai/shared";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { secretsApi } from "../../api/secrets";
import { queryKeys } from "../../lib/queryKeys";
import { useToastActions } from "../../context/ToastContext";
import { describeError } from "@/api/errors";

// Hides the pasted value like a password field while keeping a multi-line box.

/**
 * Shared dialog where a person adds or replaces their own value for a secret.
 * Used both from the Secrets → My secrets tab and from the missing-secret
 * warning surfaces (task run / task failure), so both behave identically.
 */
export function SetMyUserSecretDialog({
  companyId,
  definition,
  existingSecret,
  open,
  onOpenChange,
  onSaved,
}: {
  companyId: string;
  definition: UserSecretDefinition | null;
  existingSecret?: CompanySecret | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (secret: CompanySecret) => void;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [value, setValue] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showValue, setShowValue] = useState(false);
  const fieldId = useId();

  const isExternal = definition?.managedMode === "external_reference";

  useEffect(() => {
    if (open) {
      setValue("");
      setExternalRef("");
      setError(null);
      setShowValue(false);
    }
  }, [open, definition?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!definition) throw new Error(t("setMyUserSecretDialog.noDefinitionSelected"));
      const payload = isExternal
        ? { externalRef: externalRef.trim() }
        : { value: value.trim() };
      if (existingSecret) {
        // A stored value already exists → rotate it in place.
        return secretsApi.rotateMyUserSecret(companyId, existingSecret.id, payload);
      }
      return secretsApi.createMyUserSecret(companyId, {
        definitionId: definition.id,
        definitionKey: definition.key,
        ...payload,
      });
    },
    onSuccess: (secret) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.myUserSecrets(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.userDefinitions(companyId) });
      pushToast({
        title: existingSecret ? t("setMyUserSecretDialog.valueWasReplaced") : t("setMyUserSecretDialog.valueWasSaved"),
        body: definition?.name,
        tone: "success",
      });
      onSaved?.(secret);
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        describeError(err).body,
      );
    },
  });

  const canSave = isExternal ? externalRef.trim().length > 0 : value.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existingSecret ? t("setMyUserSecretDialog.replaceYourValue") : t("setMyUserSecretDialog.setYourValue")}
            {definition ? t("setMyUserSecretDialog.forDefinition", { name: definition.name }) : ""}
          </DialogTitle>
          <DialogDescription>
            {t("setMyUserSecretDialog.onlyYouProvideThisValue")}
          </DialogDescription>
        </DialogHeader>

        {definition ? (
          <div className="flex flex-col gap-3">
            {definition.description || definition.usageGuidance ? (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                {definition.description ? <p>{definition.description}</p> : null}
                {definition.usageGuidance ? <p>{definition.usageGuidance}</p> : null}
              </div>
            ) : null}

            {isExternal ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground" htmlFor={fieldId}>
                  {t("setMyUserSecretDialog.whereYourValueIsStored")}
                </label>
                <Input
                  id={fieldId}
                  value={externalRef}
                  onChange={(event) => setExternalRef(event.target.value)}
                  placeholder={t("setMyUserSecretDialog.referenceOrArn")}
                  className="font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  {t("setMyUserSecretDialog.pointsToYourOwnSecret")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground" htmlFor={fieldId}>
                  {t("setMyUserSecretDialog.yourValue")}
                </label>
                <div className="relative">
                  <Textarea
                    id={fieldId}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={t("setMyUserSecretDialog.pasteYourTokenOrKey")}
                    className={`min-h-(--sz-80px) pr-11 font-mono text-sm${showValue ? "" : " secret-value-masked"}`}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="absolute right-2 top-2"
                    aria-label={showValue ? t("secrets.hideValue") : t("secrets.showValue")}
                    aria-pressed={showValue}
                    onClick={() => setShowValue((current) => !current)}
                  >
                    {showValue ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("setMyUserSecretDialog.encryptedWhenSaved")}
                </p>
              </div>
            )}

            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending ? t("common.saving2") : existingSecret ? t("setMyUserSecretDialog.replaceValue") : t("setMyUserSecretDialog.saveValue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
