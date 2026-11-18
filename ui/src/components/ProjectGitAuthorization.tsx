import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@paperclipai/shared";
import { t } from "@/i18n";
import { projectsApi } from "@/api/projects";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ANALYTICS_MASK_CLASS } from "@/lib/analytics/privacy";
import { cn } from "@/lib/utils";

export function ProjectGitAuthorization({ project }: { project: Project }) {
  const client = useQueryClient();
  const key = ["project-git-authorization", project.companyId, project.id];
  const authorization = useQuery({
    queryKey: key,
    queryFn: () => projectsApi.gitAuthorization(project.id),
  });
  const [selected, setSelected] = useState<string>("");
  const save = useMutation({
    mutationFn: (grantId: string | null) => projectsApi.setGitAuthorization(project.id, grantId),
    onSuccess: (data) => {
      client.setQueryData(key, data);
      setSelected("");
    },
  });
  const data = authorization.data;
  return (
    <section aria-label={t("projectGitAuthorization.title")} className="flex flex-col gap-3 py-4">
      <h3 className="text-sm font-medium">{t("projectGitAuthorization.title")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("projectGitAuthorization.description")}
      </p>
      {data?.grantId && (
        <p role="status" className={cn("text-sm", ANALYTICS_MASK_CLASS)}>
          {t("projectGitAuthorization.authorized")}{" "}
          {data.options.find((option) => option.grantId === data.grantId)?.login ??
            t("projectGitAuthorization.selectedGrantUnavailable")}
        </p>
      )}
      {data && (
        <div className="flex flex-wrap gap-2">
          <Select value={selected} onValueChange={setSelected} disabled={save.isPending}>
            <SelectTrigger aria-label={t("projectGitAuthorization.yourGitHubAuthorization")} className={ANALYTICS_MASK_CLASS}>
              <SelectValue placeholder={t("projectGitAuthorization.selectYourGitHubAccount")} />
            </SelectTrigger>
            <SelectContent>
              {data.options.map((option) => (
                <SelectItem key={option.grantId} value={option.grantId} className={ANALYTICS_MASK_CLASS}>
                  {option.login} · {option.connectionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!selected || save.isPending} onClick={() => save.mutate(selected)}>
            {t("projectGitAuthorization.authorizeProject")}
          </Button>
          {data.grantId && (
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(null)}>
              {t("projectGitAuthorization.revokeAuthorization")}
            </Button>
          )}
        </div>
      )}
      {data && !data.options.length && (
        <p className="text-sm text-muted-foreground">
          {t("projectGitAuthorization.connectGitHubAccount")}
        </p>
      )}
      {(authorization.error || save.error) && (
        <p role="alert" className="text-sm text-destructive">
          {(authorization.error || save.error)?.message}
        </p>
      )}
    </section>
  );
}
