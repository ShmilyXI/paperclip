import { t } from "@/i18n";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Agent, CompanyArtifact, ResponsibilityProjectSummary, ResponsibilityRoutineSummary } from "@paperclipai/shared";
import { FileText, MoreHorizontal, Plus } from "lucide-react";
import { describeError } from "@/api/errors";
import { QueryErrorState, useQueryView } from "@/components/QueryView";
import { responsibilitiesApi } from "@/api/responsibilities";
import { routinesApi } from "@/api/routines";
import { glyphOf, subjectFromCompanyArtifact } from "@/components/artifacts/v1/kinds";
import { NewProjectForm } from "@/components/NewProjectDialog";
import { StatusIcon } from "@/components/StatusIcon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { agentDetailHref } from "@/pages/agent-detail-navigation";
import { queryKeys } from "@/lib/queryKeys";
import { skillRoute } from "@/lib/company-skill-routes";
import { agentsWorkingUnder, routinePath } from "@/lib/responsibilities";
import {
  ago,
  projectDueStat,
  projectProgressLabel,
  routineStat,
  runStat,
  splitTasksForTable,
} from "@/lib/responsibility-one-screen-v2";
import { isFinishedProject } from "@/lib/responsibility-views";
import { Link } from "@/lib/router";
import { taskStatusIconProps } from "@/lib/task-status-presentation";
import { agentRouteRef, issueUrl, projectUrl } from "@/lib/utils";
import { AddExistingWorkPicker, type ResponsibilityWorkKind } from "./AddExistingWorkPicker";
import { BarModule } from "./BarModule";
import { MakeRoutineDialog } from "./MakeRoutineDialog";
import { AreaRadioItems, useMoveToArea } from "./MoveToArea";
import { useResponsibilityRuns } from "./RecentRuns";
import { ProposalsNotice } from "./ResponsibilityViewParts";
import {
  SectionTable,
  SectionTableFooterButton,
  SectionTableNote,
  SectionTableRow,
  TaskRefStat,
  WhoAvatar,
} from "./SectionTable";
import type { ResponsibilityViewProps } from "./view-props";

/** The sections under the bar, in order. Each is one table whose header bar is just the word. */
export const ONE_SCREEN_V2_SECTIONS = ["routines", "skills", "projects", "tasks", "runs", "artifacts"] as const;
type SectionKey = (typeof ONE_SCREEN_V2_SECTIONS)[number];
const SECTION_TITLE: Record<SectionKey, string> = {
  routines: t("nav.routines"),
  skills: t("nav.skills"),
  projects: t("nav.projects"),
  tasks: t("nav.tasks"),
  runs: t("routines.recentRuns"),
  artifacts: t("nav.artifacts"),
};
const TASK_CAP = 8;
/** A skill row shows up to this many holders; past it, the rest as "+N". */
const SKILL_HOLDER_CAP = 4;

/** The agents who hold a skill, as avatars; past the cap, the first few and "+N". */
function SkillHolders({ agentIds, agentsById }: { agentIds: readonly string[]; agentsById: ReadonlyMap<string, Agent> }) {
  const overflow = agentIds.length > SKILL_HOLDER_CAP;
  const shown = overflow ? agentIds.slice(0, SKILL_HOLDER_CAP - 1) : agentIds;
  return (
    <>
      {shown.map((id) => <WhoAvatar key={id} agentId={id} agentsById={agentsById} />)}
      {overflow ? <span className="text-sm text-muted-foreground tabular-nums">+{agentIds.length - shown.length}</span> : null}
    </>
  );
}

/** A thin meter of a project's done tasks; its words are on hover and for screen readers. */
function ProjectProgress({ progress }: { progress: NonNullable<ResponsibilityProjectSummary["progress"]> }) {
  const label = projectProgressLabel(progress);
  const percent = Math.round((Math.min(progress.done, progress.total) / progress.total) * 100);
  return (
    <span role="img" aria-label={label} title={label} className="relative block h-1 w-16 overflow-hidden rounded-full bg-muted" data-project-progress={percent}>
      <span className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground" style={{ width: `${percent}%` }} />
    </span>
  );
}

/** The small kind mark the artifacts surfaces use (PDF's three bars read as a document here). */
function ArtifactKindMark({ artifact }: { artifact: CompanyArtifact }) {
  const glyph = glyphOf(subjectFromCompanyArtifact(artifact));
  const Icon = glyph === "bars" ? FileText : glyph;
  return <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
}

/** The "+" at a heading's right: one menu with "new" (when the page can make one) and "add existing". */
function AddMenu({
  label,
  newLabel,
  onNew,
  existing,
  onExisting,
}: {
  /** "Add a routine". */
  label: string;
  newLabel: string;
  onNew?: () => void;
  existing?: boolean;
  onExisting?: () => void;
}) {
  // The picker opens once the menu has closed, so the menu's focus return does not dismiss it.
  const pickExisting = useRef(false);
  if (!onNew && !existing) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon-xs" variant="ghost" className="text-muted-foreground" aria-label={label} data-section-add="">
          <Plus aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (!pickExisting.current) return;
          pickExisting.current = false;
          event.preventDefault();
          onExisting?.();
        }}
      >
        {onNew ? <DropdownMenuItem onSelect={onNew}>{newLabel}</DropdownMenuItem> : null}
        {existing && onExisting ? (
          <DropdownMenuItem onSelect={() => { pickExisting.current = true; }}>{t("responsibilities.addExisting")}</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A "+" that cannot do anything yet, with why, on hover and for screen readers. */
function DisabledAdd({ label, reason }: { label: string; reason: string }) {
  return (
    <span title={reason} className="inline-flex" data-section-add-disabled="">
      <Button type="button" size="icon-xs" variant="ghost" className="text-muted-foreground" aria-label={`${label}: ${reason}`} disabled>
        <Plus aria-hidden="true" />
      </Button>
    </span>
  );
}

function RenameDialog({ open, onOpenChange, title, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; onSave: (title: string) => Promise<unknown> | void }) {
  const [value, setValue] = useState(title);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = value.trim();
    if (!next || saving) return;
    if (next === title) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      onOpenChange(false);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (next) setValue(title); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-md">
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("common.rename")}</DialogTitle>
            <DialogDescription className="sr-only">{t("responsibilities.renameShortNameDescription")}</DialogDescription>
          </DialogHeader>
          <Input aria-label={t("common.name")} value={value} maxLength={200} autoFocus onChange={(event) => setValue(event.target.value)} />
          {error ? <p role="alert" className="text-sm text-destructive">{t("responsibilities.couldntRenameIt")} {describeError(error).body}</p> : null}
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!value.trim() || saving}>{saving ? t("common.saving2") : t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "One screen v2": a deliberately spare layout. The responsibility's sentence
 * as the heading (its area above it, the rare actions in one menu), the bar,
 * then Routines, Skills, Projects, Tasks, Recent runs and Artifacts, each one
 * table (`SectionTable`) whose header bar is just the word and a "+" for
 * adding one here (new, or existing). Each row is what it is, one stat in
 * plain words, and who has it. No status words, counts or explanations.
 */
export function ResponsibilityOneScreenV2({
  responsibility,
  companyId,
  agents,
  agentsById,
  areas,
  now,
  notices,
  actions,
  onReviewProposal,
}: ResponsibilityViewProps) {
  const queryClient = useQueryClient();
  const isActive = responsibility.status === "active";
  const editable = responsibility.status !== "dismissed";
  const barEditable = responsibility.status === "active" || responsibility.status === "proposed";
  const heading = responsibility.standard?.trim() || responsibility.title;
  const move = useMoveToArea(responsibility.id);
  const [renaming, setRenaming] = useState(false);
  const [picking, setPicking] = useState<ResponsibilityWorkKind | null>(null);
  const [newRoutine, setNewRoutine] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [filingError, setFilingError] = useState<unknown>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const runs = useResponsibilityRuns(responsibility.id);
  const runsView = useQueryView(runs);

  const linkedIds = useMemo(() => ({
    project: new Set(responsibility.projects.map((project) => project.id)),
    task: new Set(responsibility.tasks.filter((task) => task.membership === "direct").map((task) => task.id)),
    routine: new Set(responsibility.routines.filter((routine) => routine.membership === "direct").map((routine) => routine.id)),
  }), [responsibility.projects, responsibility.tasks, responsibility.routines]);
  const routines = responsibility.routines.filter((routine) => routine.status !== "archived");
  const projects = responsibility.projects.filter((project) => !isFinishedProject(project));
  const { open: openTasks, done: doneTasks } = useMemo(() => splitTasksForTable(responsibility.tasks), [responsibility.tasks]);
  const shownTasks = [
    ...(showAllTasks ? openTasks : openTasks.slice(0, TASK_CAP)),
    ...(showDoneTasks ? doneTasks : []),
  ];
  const working = useMemo(() => {
    const ids = agentsWorkingUnder(responsibility).map((entry) => entry.agentId);
    if (responsibility.runByAgentId && !ids.includes(responsibility.runByAgentId)) ids.unshift(responsibility.runByAgentId);
    return ids.flatMap((id) => {
      const agent = agentsById.get(id);
      return agent ? [agent] : [];
    });
  }, [responsibility, agentsById]);
  const firstAgentId = working[0]?.id ?? null;

  const runNow = useMutation({
    mutationFn: (routine: ResponsibilityRoutineSummary) => routinesApi.run(routine.id, {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.responsibilities.runs(responsibility.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.responsibilities.detail(responsibility.id) }),
      ]);
    },
  });

  const picker = (kind: ResponsibilityWorkKind, anchor: ReactNode) => (
    <AddExistingWorkPicker
      companyId={companyId}
      responsibilityId={responsibility.id}
      kind={kind}
      linkedIds={linkedIds[kind]}
      open={picking === kind}
      onOpenChange={(open) => setPicking(open ? kind : null)}
      anchor={anchor}
    />
  );

  const whoFor = (agentId: string | null) => (agentId ? <WhoAvatar agentId={agentId} agentsById={agentsById} /> : null);
  const runnable = routines.filter((routine) => routine.status === "active");
  const runsAdd = !isActive ? null : runnable.length === 0 ? (
    <DisabledAdd label={t("responsibilities.runARoutineNow")} reason={routines.length === 0 ? t("responsibilities.noRoutinesToRunYet") : t("responsibilities.noActiveRoutineToRun")} />
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon-xs" variant="ghost" className="text-muted-foreground" aria-label={t("responsibilities.runARoutineNow")} disabled={runNow.isPending} data-section-add="">
          <Plus aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("common.runNow")}</DropdownMenuLabel>
        {runnable.map((routine) => (
          <DropdownMenuItem key={routine.id} onSelect={() => runNow.mutate(routine)}>{routine.title}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const skillsAdd = !editable ? null : working.length === 0 ? (
    <DisabledAdd label={t("responsibilities.giveAnAgentASkill")} reason={t("responsibilities.skillsComeFromTheAgentsOnThis")} />
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon-xs" variant="ghost" className="text-muted-foreground" aria-label={t("responsibilities.giveAnAgentASkill")} data-section-add="">
          <Plus aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("responsibilities.giveASkillTo")}</DropdownMenuLabel>
        {working.map((agent) => (
          <DropdownMenuItem key={agent.id} asChild>
            <Link to={agentDetailHref(agentRouteRef(agent), "skills")}>{agent.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const fileNewProject = async (project: { id: string }) => {
    setFilingError(null);
    try {
      await responsibilitiesApi.link(responsibility.id, { projectId: project.id });
    } catch (error) {
      setFilingError(error);
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.responsibilities.all });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8" data-responsibility-view="one_screen_v2">
      <header className="flex flex-col gap-1">
        {responsibility.area ? <p className="text-xs text-muted-foreground" data-area="">{responsibility.area.title}</p> : null}
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-xl font-semibold text-foreground">{heading}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground" aria-label={t("responsibilities.moreActionsForThisResponsibility")}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenaming(true)}>{t("common.rename")}…</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t("responsibilities.moveToArea")}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-(--sz-50vh) overflow-y-auto">
                  <AreaRadioItems
                    areas={responsibility.area && !areas.some((candidate) => candidate.id === responsibility.area!.id) ? [responsibility.area, ...areas] : areas}
                    value={responsibility.area?.id ?? null}
                    onChange={(areaId) => {
                      if (areaId !== (responsibility.area?.id ?? null)) move.mutate(areaId);
                    }}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {isActive ? (
                <DropdownMenuItem onSelect={() => actions.setStatus("let_go")}>{t("responsibilities.letGo")}</DropdownMenuItem>
              ) : responsibility.status === "let_go" || responsibility.status === "dismissed" ? (
                <DropdownMenuItem onSelect={() => actions.setStatus("active")}>{t("responsibilities.takeItBackOn")}</DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={actions.requestDelete}>{t("common.delete")}…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {responsibility.status === "let_go" ? (
          <p className="text-sm text-muted-foreground">{t("responsibilities.youLetGoOfThis")}</p>
        ) : responsibility.status === "dismissed" ? (
          <p className="text-sm text-muted-foreground">{t("responsibilities.youDismissedThis")}</p>
        ) : null}
        {move.error ? <p role="alert" className="text-sm text-destructive">{t("responsibilities.couldntMoveIt")} {describeError(move.error).body}</p> : null}
        {notices}
      </header>

      {responsibility.status === "proposed" ? <ProposalsNotice count={1} subject="this" onReview={onReviewProposal} /> : null}

      <BarModule responsibility={responsibility} agentsById={agentsById} now={now} editable={barEditable} />

      <div className="flex flex-col gap-6" data-section-order="">
        <SectionTable
          section="routines"
          title={SECTION_TITLE.routines}
          add={editable ? picker("routine", (
            <AddMenu
              label={t("responsibilities.addARoutine")}
              newLabel={t("common.newRoutine")}
              onNew={isActive ? () => setNewRoutine(true) : undefined}
              existing
              onExisting={() => setPicking("routine")}
            />
          )) : null}
          empty={routines.length === 0 ? t("responsibilities.noneYet") : null}
        >
          {routines.map((routine) => (
            <SectionTableRow
              key={routine.id}
              rowData={{ "data-work-id": routine.id }}
              to={routinePath(routine.id)}
              title={routine.title}
              stat={routineStat(routine, now)}
              who={whoFor(routine.assigneeAgentId)}
            />
          ))}
        </SectionTable>

        <SectionTable
          section="skills"
          title={SECTION_TITLE.skills}
          add={skillsAdd}
          empty={responsibility.skills.length === 0 ? t("responsibilities.noneYet") : null}
        >
          {responsibility.skills.map((skill) => (
            <SectionTableRow
              key={skill.id}
              rowData={{ "data-work-id": skill.id }}
              to={skillRoute(skill)}
              title={skill.name}
              who={skill.agentIds.length > 0 ? <SkillHolders agentIds={skill.agentIds} agentsById={agentsById} /> : null}
            />
          ))}
        </SectionTable>

        <SectionTable
          section="projects"
          title={SECTION_TITLE.projects}
          add={editable ? picker("project", (
            <AddMenu
              label={t("responsibilities.addAProject")}
              newLabel={t("common.newProject")}
              onNew={isActive ? () => setNewProject(true) : undefined}
              existing
              onExisting={() => setPicking("project")}
            />
          )) : null}
          empty={projects.length === 0 ? (responsibility.projects.length > 0 ? t("responsibilities.noneOpen") : t("responsibilities.noneYet")) : null}
          footer={filingError ? (
            <SectionTableNote alert>{t("responsibilities.projectMadeButCouldntBeFiled")} {describeError(filingError).body}</SectionTableNote>
          ) : null}
        >
          {projects.map((project) => (
            <SectionTableRow
              key={project.id}
              rowData={{ "data-work-id": project.id }}
              to={projectUrl(project)}
              title={project.name}
              aside={project.progress ? <ProjectProgress progress={project.progress} /> : null}
              stat={projectDueStat(project, now)}
              who={whoFor(project.leadAgentId)}
            />
          ))}
        </SectionTable>

        <SectionTable
          section="tasks"
          title={SECTION_TITLE.tasks}
          add={editable ? picker("task", (
            <AddMenu
              label={t("responsibilities.addATask")}
              newLabel={t("common.newTask")}
              onNew={isActive ? () => actions.newTask({ defaultTitle: "" }) : undefined}
              existing
              onExisting={() => setPicking("task")}
            />
          )) : null}
          empty={shownTasks.length === 0 ? (responsibility.tasks.length > 0 ? t("responsibilities.noneOpen") : t("responsibilities.noneYet")) : null}
          footer={(
            <>
              {!showAllTasks && openTasks.length > TASK_CAP ? (
                <SectionTableFooterButton onClick={() => setShowAllTasks(true)}>{t("responsibilities.showCountMore", { count: openTasks.length - TASK_CAP })}</SectionTableFooterButton>
              ) : null}
              {doneTasks.length > 0 ? (
                <SectionTableFooterButton onClick={() => setShowDoneTasks((shown) => !shown)}>
                  {showDoneTasks ? t("responsibilities.hideDone") : t("responsibilities.showCountDone", { count: doneTasks.length })}
                </SectionTableFooterButton>
              ) : null}
            </>
          )}
        >
          {shownTasks.map((task) => (
            <SectionTableRow
              key={task.id}
              rowData={{ "data-work-id": task.id }}
              to={issueUrl(task)}
              leading={<StatusIcon {...taskStatusIconProps(task)} size="sm" />}
              title={task.title}
              stat={<TaskRefStat identifier={task.identifier} when={ago(task.updatedAt, now)} />}
              who={whoFor(task.assigneeAgentId)}
            />
          ))}
        </SectionTable>

        <SectionTable
          section="runs"
          title={SECTION_TITLE.runs}
          add={runsAdd}
          empty={runsView.kind === "error" ? (
            <QueryErrorState error={runsView.error} size="inline" action="load the runs" onRetry={runsView.retry} retrying={runsView.isFetching} />
          ) : !runs.data ? (
            <span role="status">{t("common.loading2")}</span>
          ) : runs.data.runs.length === 0 ? t("responsibilities.noneYet") : null}
          footer={runNow.error ? (
            <SectionTableNote alert>{t("responsibilities.couldntStartTheRun")} {describeError(runNow.error).body}</SectionTableNote>
          ) : null}
        >
          {(runsView.kind === "error" ? [] : runs.data?.runs ?? []).map((run) => {
            const stat = runStat(run, now);
            return (
              <SectionTableRow
                key={run.id}
                rowData={{ "data-run-id": run.id, "data-run-status": run.status }}
                to={`/agents/${run.agentId}/runs/${run.id}`}
                label={t("responsibilities.runRowLabel", { agent: agentsById.get(run.agentId)?.name ?? t("auditTab.anAgent"), title: run.issue.title, stat })}
                title={run.issue.title}
                stat={stat}
                who={whoFor(run.agentId)}
              />
            );
          })}
        </SectionTable>

        <SectionTable
          section="artifacts"
          title={SECTION_TITLE.artifacts}
          withWho={false}
          empty={responsibility.artifacts.length === 0 ? t("responsibilities.noneYet") : null}
        >
          {responsibility.artifacts.map((artifact) => (
            <SectionTableRow
              key={`${artifact.source}:${artifact.id}`}
              rowData={{ "data-artifact-id": artifact.id }}
              to={artifact.href}
              leading={<ArtifactKindMark artifact={artifact} />}
              title={artifact.title}
              stat={<TaskRefStat identifier={artifact.issue.identifier} when={ago(artifact.updatedAt, now)} />}
            />
          ))}
        </SectionTable>
      </div>

      <RenameDialog open={renaming} onOpenChange={setRenaming} title={responsibility.title} onSave={actions.saveTitle} />
      <MakeRoutineDialog
        open={newRoutine}
        onOpenChange={setNewRoutine}
        companyId={companyId}
        task={null}
        newFor={{ responsibilityId: responsibility.id, responsibilityTitle: responsibility.title, assigneeAgentId: firstAgentId }}
        agents={agents}
        filedUnder={[responsibility.title]}
      />
      {newProject ? (
        <NewProjectForm companyId={companyId} onClose={() => setNewProject(false)} onCreated={fileNewProject} />
      ) : null}
    </div>
  );
}
