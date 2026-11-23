import { useEffect, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bot,
  ChartColumn,
  ExternalLink,
  Folder,
  Globe,
  Link2,
  PanelTop,
  Pencil,
  Plus,
  Rocket,
  Send,
  Settings,
  Trash2,
  Video,
} from "lucide-react";

import { t } from "@/i18n";
import { useNavigate } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DASHBOARD_LINK_ICONS, dashboardLinksApi, type DashboardLink, type DashboardLinkIcon } from "@/api/dashboardLinks";

export const LINK_ICON_COMPONENTS: Record<DashboardLinkIcon, ComponentType> = {
  external: ExternalLink,
  rocket: Rocket,
  canvas: PanelTop,
  send: Send,
  chart: ChartColumn,
  globe: Globe,
  book: BookOpen,
  folder: Folder,
  video: Video,
  bot: Bot,
  settings: Settings,
  link: Link2,
};

/** 与服务端同一口径：站内路径（/ 开头，不能是 //）或 http(s) 地址。 */
export function isValidLinkUrl(url: string) {
  const v = url.trim();
  return (v.startsWith("/") && !v.startsWith("//")) || /^https?:\/\/\S+$/i.test(v);
}

export function linkErrors(links: DashboardLink[]): string | null {
  if (links.length > 30) return t("boardsHub.links.errorTooMany");
  for (const l of links) {
    if (!l.label.trim()) return t("boardsHub.links.errorLabel");
    if (l.label.trim().length > 40) return t("boardsHub.links.errorLabelLong");
    if (!isValidLinkUrl(l.url)) return t("boardsHub.links.errorUrl", { label: l.label.trim() });
  }
  return null;
}

function LinkButton({ link, index }: { link: DashboardLink; index: number }) {
  const navigate = useNavigate();
  const Icon = LINK_ICON_COMPONENTS[link.icon] ?? Link2;
  const external = /^https?:\/\//i.test(link.url);
  const testId = `entry-link-${index}`;
  if (external || link.newTab) {
    return (
      <Button asChild variant="outline" size="sm" data-testid={testId}>
        <a href={link.url} {...(link.newTab ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
          <Icon /> {link.label}
        </a>
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={() => navigate(link.url)} data-testid={testId}>
      <Icon /> {link.label}
    </Button>
  );
}

const blankLink = (): DashboardLink => ({ label: "", url: "https://", icon: "link", newTab: true });

function LinksEditor({
  open,
  onOpenChange,
  links,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: DashboardLink[];
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DashboardLink[]>(links);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setDraft(links.map((l) => ({ ...l })));
      setError(null);
    }
  }, [open, links]);

  const onSaved = (data: { links: DashboardLink[] }) => {
    queryClient.setQueryData(queryKeys.dashboardLinks, data);
    onOpenChange(false);
  };
  const save = useMutation({
    mutationFn: (next: DashboardLink[]) => dashboardLinksApi.save(next),
    onSuccess: onSaved,
    onError: (err: Error) => setError(err.message),
  });
  const reset = useMutation({
    mutationFn: () => dashboardLinksApi.reset(),
    onSuccess: onSaved,
    onError: (err: Error) => setError(err.message),
  });

  const update = (i: number, patch: Partial<DashboardLink>) =>
    setDraft((d) => d.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, by: number) =>
    setDraft((d) => {
      const j = i + by;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const submit = () => {
    const cleaned = draft.map((l) => ({ ...l, label: l.label.trim(), url: l.url.trim() }));
    const err = linkErrors(cleaned);
    if (err) {
      setError(err);
      return;
    }
    save.mutate(cleaned);
  };
  const busy = save.isPending || reset.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="links-editor">
        <DialogHeader>
          <DialogTitle>{t("boardsHub.links.editTitle")}</DialogTitle>
          <DialogDescription>{t("boardsHub.links.editDescription")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {draft.length === 0 ? <p className="text-sm text-muted-foreground">{t("boardsHub.links.empty")}</p> : null}
          {draft.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2" data-testid={`link-row-${i}`}>
              <select
                aria-label={t("boardsHub.links.icon")}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                value={l.icon}
                onChange={(e) => update(i, { icon: e.target.value as DashboardLinkIcon })}
              >
                {DASHBOARD_LINK_ICONS.map((ic) => (
                  <option key={ic} value={ic}>
                    {t(`boardsHub.links.icons.${ic}`)}
                  </option>
                ))}
              </select>
              <Input
                aria-label={t("boardsHub.links.label")}
                placeholder={t("boardsHub.links.label")}
                className="h-8 w-36"
                value={l.label}
                maxLength={40}
                onChange={(e) => update(i, { label: e.target.value })}
                data-testid={`link-label-${i}`}
              />
              <Input
                aria-label={t("boardsHub.links.url")}
                placeholder="https://… 或 /deploy-console"
                className="h-8 min-w-48 flex-1"
                value={l.url}
                onChange={(e) => update(i, { url: e.target.value })}
                data-testid={`link-url-${i}`}
              />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={l.newTab} onChange={(e) => update(i, { newTab: e.target.checked })} />
                {t("boardsHub.links.newTab")}
              </label>
              <div className="flex items-center">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("boardsHub.links.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("boardsHub.links.moveDown")} disabled={i === draft.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("boardsHub.links.remove")}
                  onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                  data-testid={`link-remove-${i}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setDraft((d) => [...d, blankLink()])} disabled={draft.length >= 30} data-testid="link-add">
            <Plus /> {t("boardsHub.links.add")}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="links-error">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => reset.mutate()} data-testid="links-reset">
            {t("boardsHub.links.reset")}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
              {t("boardsHub.links.cancel")}
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={submit} data-testid="links-save">
              {t("boardsHub.links.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 仪表盘「总览」顶部的快捷入口条：按钮来自服务端配置，右侧「编辑」可随时增删改、排序。 */
export function DashboardLinksBar() {
  const [editing, setEditing] = useState(false);
  const query = useQuery({ queryKey: queryKeys.dashboardLinks, queryFn: () => dashboardLinksApi.get() });
  const links = query.data?.links ?? [];
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2 md:px-6" data-testid="entry-bar">
      {links.map((link, i) => (
        <LinkButton key={`${i}-${link.url}`} link={link} index={i} />
      ))}
      {query.isError ? <span className="text-xs text-muted-foreground">{t("boardsHub.links.loadFailed")}</span> : null}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setEditing(true)}
        disabled={!query.data}
        data-testid="entry-links-edit"
      >
        <Pencil /> {t("boardsHub.links.edit")}
      </Button>
      <LinksEditor open={editing} onOpenChange={setEditing} links={links} />
    </div>
  );
}
