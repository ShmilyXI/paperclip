// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { ArtifactFileRow } from "./ArtifactFileRow";
import { ArtifactStackTile } from "./ArtifactTile";
import { labelOf } from "./kinds";
import { testSubject } from "./test-subject";
import { countLabel, panelDateLabel, updatedLabel } from "./when";
import { workProductStateBadge } from "./WorkProductState";

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompany: null, selectedCompanyId: null, companies: [] }),
}));

const NOW = new Date("2026-09-28T18:00:00");
const originalLanguage = i18n.language;

afterEach(async () => {
  await i18n.changeLanguage(originalLanguage);
});

function fileRowMarkup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <ArtifactFileRow
          subject={testSubject({ kind: "sheet", filename: "report.csv" })}
          source={{
            id: "file-1",
            filename: "report.csv",
            contentType: "text/csv",
            contentPath: "/api/attachments/file-1/content",
            openPath: "/api/attachments/file-1/content",
            downloadPath: "/api/attachments/file-1/download",
            byteSize: 128,
          }}
          now={NOW}
        />
      </QueryClientProvider>,
    );
  } finally {
    client.clear();
  }
}

describe("production V1 localization", () => {
  it("preserves English labels, counts, actions and date formats exactly", async () => {
    await i18n.changeLanguage("en");
    expect([countLabel(0), countLabel(1), countLabel(2)]).toEqual(["0 Artifacts", "1 Artifact", "2 Artifacts"]);
    expect((["code", "file", "image", "video"] as const).map((kind) => labelOf(testSubject({ kind })))).toEqual(["CODE", "FILE", "IMG", "VIDEO"]);
    expect(panelDateLabel("2026-09-25T08:00:00", NOW)).toBe("3D ago");
    expect(updatedLabel("2026-09-28T16:05:00", NOW)).toBe("4:05 PM");
    const markup = fileRowMarkup();
    expect(markup).toContain('aria-label="Open report.csv"');
    expect(markup).toContain('aria-label="Open raw report.csv"');
    expect(markup).toContain('aria-label="Download report.csv"');
    expect(markup).toContain("Preview data");
    const stack = renderToStaticMarkup(
      <ArtifactStackTile identifier="ACM-3" title="Report" count={2} updatedAt="2026-09-27T08:00:00" front={testSubject({ kind: "pdf" })} now={NOW} />,
    );
    expect(stack).toContain('aria-label="Open ACM-3 Report, 2 Artifacts"');
    expect(stack).toContain("Updated Yesterday");
  });

  it("renders Chinese actions and counts without changing filenames or format labels", async () => {
    await i18n.changeLanguage("zh-CN");
    expect([countLabel(0), countLabel(1), countLabel(2)]).toEqual(["0 个产物", "1 个产物", "2 个产物"]);
    const markup = fileRowMarkup();
    expect(markup).toContain('aria-label="打开 report.csv"');
    expect(markup).toContain('aria-label="打开原始文件 report.csv"');
    expect(markup).toContain('aria-label="下载 report.csv"');
    expect(markup).toContain("数据预览");
    expect(markup).toContain('href="/api/attachments/file-1/download"');
    expect(markup).toContain('download="report.csv"');
    expect(labelOf(testSubject({ kind: "sheet", filename: "report.csv" }))).toBe("CSV");
    expect(labelOf(testSubject({ kind: "link" }))).toBe("URL");
    expect(labelOf(testSubject({ kind: "file", filename: null, ext: null }))).toBe("文件");
    expect(renderToStaticMarkup(<>{workProductStateBadge({ type: "artifact", status: "active", reviewState: "none", healthStatus: "unhealthy" })}</>)).toContain("状态异常");
    const stack = renderToStaticMarkup(
      <ArtifactStackTile identifier="ACM-3" title="Report" count={2} updatedAt="2026-09-27T08:00:00" front={testSubject({ kind: "pdf" })} now={NOW} />,
    );
    expect(stack).toContain('aria-label="打开 ACM-3 Report，2 个产物"');
    expect(stack).toContain("更新于 昨天");
  });

  it("uses the Chinese locale for relative dates, weekdays, calendar dates and times", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(panelDateLabel("2026-09-28T08:00:00", NOW)).toBe("今天");
    expect(panelDateLabel("2026-09-27T08:00:00", NOW)).toBe("昨天");
    expect(panelDateLabel("2026-09-25T08:00:00", NOW)).toBe("3天前");
    expect(updatedLabel("2026-09-23T09:00:00", NOW)).toBe("星期三");
    expect(updatedLabel("2026-09-12T09:00:00", NOW)).toBe("9月12日");
    expect(panelDateLabel("2026-07-23T08:00:00", NOW)).toBe("7月23日");
    expect(updatedLabel("2026-09-28T16:05:00", NOW)).toBe(
      new Date("2026-09-28T16:05:00").toLocaleTimeString("zh-CN", { hour: "numeric", minute: "2-digit" }),
    );
  });
});
