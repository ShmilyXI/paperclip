import { t } from "@/i18n";
import type { Agent, CompanyArtifact, ResponsibilitySkillSummary } from "@paperclipai/shared";
import { RESPONSIBILITY_ARTIFACT_COUNT_LIMIT } from "@paperclipai/shared";
import { AgentAvatar } from "@/components/AgentAvatar";
import { ArtifactCard } from "@/components/artifacts/ArtifactCard";
import { ArtifactSingleTile, ArtifactTileGrid, subjectFromCompanyArtifact } from "@/components/artifacts/v1";
import { SkillCardIcon } from "@/components/SkillCardIcon";
import { Card } from "@/components/ui/card";
import { useArtifactsV1Enabled } from "@/hooks/useArtifactsV1Enabled";
import { skillRoute } from "@/lib/company-skill-routes";
import { Link } from "@/lib/router";
import { issueUrl } from "@/lib/utils";

function SectionHeading({ id, title, count, question }: { id: string; title: string; count: number; question: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className="text-base font-semibold text-foreground">
        {title} <span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span>
      </h2>
      <p className="text-sm text-muted-foreground">{question}</p>
    </div>
  );
}

/** The agents that hold a skill, by avatar and name. */
function Holders({ agentIds, agentsById }: { agentIds: readonly string[]; agentsById: ReadonlyMap<string, Agent> }) {
  if (agentIds.length === 0) return null;
  const names = agentIds.map((id) => agentsById.get(id)?.name ?? t("whatNeedsMe.anAgent"));
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" aria-label={t("responsibilities.heldBy", { names: names.join(", ") })}>
      <span className="flex shrink-0 -space-x-1" aria-hidden="true">
        {agentIds.slice(0, 3).map((id) => (
          <AgentAvatar key={id} agent={agentsById.get(id) ?? { id }} name={agentsById.get(id)?.name} size={16} />
        ))}
      </span>
      <span className="truncate" aria-hidden="true">{names.join(", ")}</span>
    </span>
  );
}

/**
 * The skills held by the agents working under a responsibility: the agents
 * assigned its tasks and routines and the leads of its projects, as a grid
 * of cards. Derived by the server; nothing is attached by hand.
 */
export function ResponsibilitySkills({
  skills,
  agentsById,
}: {
  skills: readonly ResponsibilitySkillSummary[];
  agentsById: ReadonlyMap<string, Agent>;
}) {
  return (
    <section aria-labelledby="responsibility-skills-heading" className="flex flex-col gap-2">
      <SectionHeading
        id="responsibility-skills-heading"
        title={t("common.skills")}
        count={skills.length}
        question={t("responsibilities.whatCanTheAgentsWorkingOnThisDo")}
      />
      {skills.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="responsibility-skills">
          {skills.map((skill) => (
            <li key={skill.id} className="min-w-0">
              <Card elevation="low" className="h-full gap-3 px-4 py-4">
                <Link
                  to={skillRoute(skill)}
                  className="flex min-w-0 items-start gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SkillCardIcon card={skill} size={32} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline">{skill.name}</span>
                    {skill.tagline || skill.description ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{skill.tagline || skill.description}</span>
                    ) : null}
                  </span>
                </Link>
                <Holders agentIds={skill.agentIds} agentsById={agentsById} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("responsibilities.noSkillsYetTheyAppearHere")}
        </p>
      )}
    </section>
  );
}

/** "Showing the newest 50 of 312", or "of 1,000 or more" once the count stops. */
export function artifactsTruncationNote(shown: number, total: number): string {
  const of = total >= RESPONSIBILITY_ARTIFACT_COUNT_LIMIT
    ? t("responsibilities.countOrMore", { limit: RESPONSIBILITY_ARTIFACT_COUNT_LIMIT.toLocaleString("en-US") })
    : total.toLocaleString("en-US");
  return t("responsibilities.showingTheNewestOf", { shown, of });
}

/**
 * Everything the tasks under a responsibility produced, newest first, as a
 * grid of the Artifacts page's own cards. Each opens in the task that made it.
 */
export function ResponsibilityArtifacts({
  artifacts,
  total,
  truncated,
}: {
  artifacts: readonly CompanyArtifact[];
  total: number;
  truncated: boolean;
}) {
  const { enabled: v1 } = useArtifactsV1Enabled();
  return (
    <section aria-labelledby="responsibility-artifacts-heading" className="flex flex-col gap-3">
      <SectionHeading
        id="responsibility-artifacts-heading"
        title={t("nav.artifacts")}
        count={total}
        question={t("responsibilities.whatHasTheWorkProduced")}
      />
      {artifacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("responsibilities.nothingProducedYetDocumentsFiles")}
        </p>
      ) : v1 ? (
        <ArtifactTileGrid testId="responsibility-artifacts">
          {artifacts.map((artifact) => (
            <ArtifactSingleTile key={`${artifact.source}:${artifact.id}`} subject={subjectFromCompanyArtifact(artifact)} to={artifact.href} />
          ))}
        </ArtifactTileGrid>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" data-testid="responsibility-artifacts">
          {artifacts.map((artifact) => (
            <li key={`${artifact.source}:${artifact.id}`} className="flex min-w-0 flex-col gap-1">
              <ArtifactCard artifact={artifact} />
              <Link to={issueUrl(artifact.issue)} className="truncate px-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
                <span className="font-mono">{artifact.issue.identifier}</span> {artifact.issue.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {truncated ? <p className="text-xs text-muted-foreground">{artifactsTruncationNote(artifacts.length, total)}</p> : null}
    </section>
  );
}
