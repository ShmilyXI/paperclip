import { useCallback, useEffect, useMemo, useState } from "react";

import { t } from "@/i18n";
import { useLocation, useNavigate } from "@/lib/router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmbeddedPageHeader } from "@/components/EmbeddedPageHeader";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { Dashboard } from "./Dashboard";
import { Board, DEFAULT_BOARD_URL } from "./Board";
import { Office } from "./Office";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { ExternalLink, Rocket, PanelTop, Send } from "lucide-react";

/** Mowa's Qianfan publish agent; its chat is the real operating surface (the MCP has no owner-side web UI). */
export const PUBLISHER_CHAT_REF = "5f416d2d-f4fa-422e-bc11-3f6705ad5b41";
/** 千帆云递管理台：账号/素材/发布/历史/日历的完整网页（Vue SPA，登录态存 localStorage）。 */
export const QIANFAN_URL = "https://ai-opc-qianfan.culud.com/";
/** The workflow-run board is a static page served inside the coordination board site, so it inherits that login. */
export const WORKFLOW_BOARD_URL = `${DEFAULT_BOARD_URL}/workflow-status.html`;

export const BOARDS_TABS = ["overview", "board", "workflow", "office", "canvas"] as const;
export type BoardsTab = (typeof BOARDS_TABS)[number];

export const DEFAULT_TAB: BoardsTab = "overview";

export function normalizeTab(raw: string | null | undefined): BoardsTab {
  return BOARDS_TABS.includes(raw as BoardsTab) ? (raw as BoardsTab) : DEFAULT_TAB;
}

/** The workflow page fetches workflow-status.json relative to its own origin; it only loads when logged in there. */
export function WorkflowTab({ url = WORKFLOW_BOARD_URL, timeoutMs = 6_000 }: { url?: string; timeoutMs?: number }) {
  const [frameStatus, setFrameStatus] = useState<"pending" | "ready" | "blocked">("pending");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    setFrameStatus("pending");
    const timer = setTimeout(() => setFrameStatus((current) => (current === "ready" ? current : "blocked")), timeoutMs);
    return () => clearTimeout(timer);
  }, [url, timeoutMs]);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="workflow-tab">
      <EmbeddedPageHeader
        title={t("boardsHub.tabWorkflow")}
        url={url}
        openLabel={t("embeddedSite.openInNewWindow")}
        reloadLabel={t("embeddedSite.reload")}
        onReload={reload}
      />
      {frameStatus === "blocked" ? (
        <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2" data-testid="workflow-frame-blocked">
          <span className="text-sm font-medium text-foreground">{t("boardsHub.workflowBlockedTitle")}</span>
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">{t("boardsHub.workflowBlockedDescription")}</span>
          <Button asChild variant="outline" size="sm">
            <a href={url} target="_blank" rel="noreferrer noopener" data-testid="workflow-open-external">
              {t("boardsHub.openInNewWindow")}
            </a>
          </Button>
        </div>
      ) : null}
      <iframe
        key={revision}
        src={url}
        title={t("boardsHub.tabWorkflow")}
        className="min-h-0 w-full flex-1 border-0 bg-background"
        onLoad={() => setFrameStatus("ready")}
        onError={() => setFrameStatus("blocked")}
        data-testid="workflow-frame"
      />
    </div>
  );
}

export function BoardsHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const tab = useMemo(() => normalizeTab(new URLSearchParams(location.search).get("tab")), [location.search]);

  const tabLabel = useMemo(
    () =>
      ({
        overview: t("nav.dashboard"),
        board: t("nav.board"),
        workflow: t("boardsHub.tabWorkflow"),
        office: t("nav.office"),
        canvas: t("nav.infiniteCanvas"),
      })[tab],
    [tab],
  );

  useEffect(() => setBreadcrumbs([{ label: tabLabel }]), [setBreadcrumbs, tabLabel]);

  const selectTab = useCallback(
    (next: BoardsTab) => {
      navigate(next === DEFAULT_TAB ? "/dashboard" : `/dashboard?tab=${next}`, { replace: true });
    },
    [navigate],
  );

  return (
    <div className="-m-4 flex h-(--infinite-canvas-mobile-height) min-h-0 flex-col md:-m-6 md:h-full" data-page="boards-hub">
      <Tabs value={tab} onValueChange={(value) => selectTab(normalizeTab(value))} className="flex min-h-0 w-full flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-4 pt-2 md:px-6">
          <TabsList variant="line" className="max-w-full overflow-x-auto">
            <TabsTrigger value="overview" data-testid="tab-overview">{t("boardsHub.tabOverview")}</TabsTrigger>
            <TabsTrigger value="board" data-testid="tab-board">{t("nav.board")}</TabsTrigger>
            <TabsTrigger value="workflow" data-testid="tab-workflow">{t("boardsHub.tabWorkflow")}</TabsTrigger>
            <TabsTrigger value="office" data-testid="tab-office">{t("nav.office")}</TabsTrigger>
            <TabsTrigger value="canvas" data-testid="tab-canvas">{t("nav.infiniteCanvas")}</TabsTrigger>
          </TabsList>
        </div>

        {tab === "overview" ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2 md:px-6" data-testid="entry-bar">
            <Button asChild variant="outline" size="sm" data-testid="entry-qianfan">
              <a href={QIANFAN_URL} target="_blank" rel="noreferrer noopener">
                <ExternalLink /> {t("boardsHub.entryQianfan")}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" data-testid="entry-qianfan-chat">
              <a href={`/chats/${PUBLISHER_CHAT_REF}`}>
                <Send /> {t("boardsHub.entryQianfanChat")}
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/deploy-console")} data-testid="entry-deploy">
              <Rocket /> {t("nav.deployConsole")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/infinite-canvas")} data-testid="entry-canvas">
              <PanelTop /> {t("nav.infiniteCanvas")}
            </Button>
          </div>
        ) : null}

        <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto" data-testid="panel-overview">
          <div className="space-y-6 p-4 md:p-6">
            <Dashboard />
          </div>
        </TabsContent>
        {/* Board / Office / InfiniteCanvas 自带 -m-4/-m-6 全出血容器，这里的 padding 正好被它们抵消 */}
        <TabsContent value="board" className="min-h-0 flex-1 p-4 md:p-6" data-testid="panel-board">
          <Board />
        </TabsContent>
        <TabsContent value="workflow" className="flex min-h-0 flex-1 flex-col" data-testid="panel-workflow">
          <WorkflowTab />
        </TabsContent>
        <TabsContent value="office" className="min-h-0 flex-1 p-4 md:p-6" data-testid="panel-office">
          <Office />
        </TabsContent>
        <TabsContent value="canvas" className="min-h-0 flex-1 p-4 md:p-6" data-testid="panel-canvas">
          <InfiniteCanvas />
        </TabsContent>
      </Tabs>
    </div>
  );
}
