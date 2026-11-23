// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { BoardsHub, WorkflowTab, normalizeTab, DEFAULT_TAB, WORKFLOW_BOARD_URL } from "./BoardsHub";

const breadcrumbState = vi.hoisted(() => ({ setBreadcrumbs: vi.fn(), setBreadcrumbToolbar: vi.fn() }));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => breadcrumbState,
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompany: null }),
}));

// 快捷入口条自己有测试（DashboardLinksBar.test.tsx），这里只确认它在「总览」才出现
vi.mock("@/components/DashboardLinksBar", () => ({
  DashboardLinksBar: () => <div data-testid="entry-bar">links</div>,
}));

vi.mock("./Dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-overview">dashboard overview</div>,
}));

vi.mock("./Board", () => ({
  Board: () => <div data-testid="board-frame-stub">coordination board</div>,
  DEFAULT_BOARD_URL: "https://ai-opc-dashboard.culud.com",
}));

vi.mock("./Office", () => ({
  Office: () => <div data-testid="office-stub">office</div>,
}));

vi.mock("./InfiniteCanvas", () => ({
  InfiniteCanvas: () => <div data-testid="canvas-stub">canvas</div>,
}));

function renderHub(initialEntry = "/MOW/dashboard") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/:companyPrefix/dashboard" element={<BoardsHub />} />
          <Route path="/dashboard" element={<BoardsHub />} />
          <Route path="/:companyPrefix/deploy-console" element={<div data-testid="deploy-page">deploy</div>} />
          <Route path="/deploy-console" element={<div data-testid="deploy-page">deploy</div>} />
          <Route path="/:companyPrefix/infinite-canvas" element={<div data-testid="canvas-page">canvas</div>} />
          <Route path="/infinite-canvas" element={<div data-testid="canvas-page">canvas</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return { container, root };
}

/** Radix TabsTrigger activates on mousedown (left button, no ctrl). */
async function clickTab(node: Element | null) {
  if (!node) throw new Error("node not found");
  flushSync(() => {
    node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync(() => {});
}

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForAssertion(assertion: () => void, attempts = 50) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flush();
    }
  }
  throw lastError;
}

describe("normalizeTab", () => {
  it("maps known values and falls back to the default", () => {
    expect(normalizeTab("overview")).toBe("overview");
    expect(normalizeTab("workflow")).toBe("workflow");
    expect(normalizeTab("")).toBe(DEFAULT_TAB);
    expect(normalizeTab("bogus")).toBe(DEFAULT_TAB);
    expect(normalizeTab(null)).toBe(DEFAULT_TAB);
  });
});

describe("BoardsHub", () => {
  let cleanup: Array<{ container: HTMLDivElement; root: Root }> = [];

  beforeEach(() => {
    breadcrumbState.setBreadcrumbs.mockClear();
    cleanup = [];
  });

  afterEach(() => {
    for (const { root, container } of cleanup) {
      flushSync(() => root.unmount());
      container.remove();
    }
  });

  function render(entry?: string) {
    const { container, root } = renderHub(entry);
    cleanup.push({ container, root });
    return container;
  }

  it("renders the overview tab by default with the entry bar", () => {
    const container = render();

    expect(container.querySelector('[data-testid="dashboard-overview"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="entry-bar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="board-frame-stub"]')).toBeNull();
    expect(container.querySelector('[data-testid="canvas-stub"]')).toBeNull();
  });

  it("switches tabs on trigger click and unloads the previous tab", async () => {
    const container = render();

    await clickTab(container.querySelector('[data-testid="tab-board"]'));
    expect(container.querySelector('[data-testid="board-frame-stub"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dashboard-overview"]')).toBeNull();
    expect(container.querySelector('[data-testid="entry-bar"]')).toBeNull();

    await clickTab(container.querySelector('[data-testid="tab-overview"]'));
    expect(container.querySelector('[data-testid="dashboard-overview"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="entry-bar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="board-frame-stub"]')).toBeNull();
  });

  it("opens the requested tab from the ?tab= query parameter", () => {
    const container = render("/MOW/dashboard?tab=canvas");

    expect(container.querySelector('[data-testid="canvas-stub"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dashboard-overview"]')).toBeNull();
    expect(container.querySelector('[data-testid="entry-bar"]')).toBeNull();
  });

  it("keeps the overview tab as the destination for unknown tab values", () => {
    const container = render("/MOW/dashboard?tab=nonsense");

    expect(container.querySelector('[data-testid="dashboard-overview"]')).not.toBeNull();
  });
});

describe("WorkflowTab", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    flushSync(() => root.unmount());
    container.remove();
  });

  it("points the frame at the coordination-board workflow page", () => {
    flushSync(() => root.render(<WorkflowTab />));

    const frame = container.querySelector<HTMLIFrameElement>('[data-testid="workflow-frame"]');
    expect(frame?.getAttribute("src")).toBe(WORKFLOW_BOARD_URL);
  });

  it("shows the blocked notice with an external link when the frame refuses to load", async () => {
    flushSync(() => root.render(<WorkflowTab timeoutMs={0} />));

    await waitForAssertion(() => {
      if (!container.querySelector('[data-testid="workflow-frame-blocked"]')) throw new Error("notice not shown yet");
    });

    const link = container.querySelector<HTMLAnchorElement>('[data-testid="workflow-open-external"]');
    expect(link?.getAttribute("href")).toBe(WORKFLOW_BOARD_URL);
    expect(link?.target).toBe("_blank");
  });

  it("clears the blocked notice once the frame reports a load", async () => {
    flushSync(() => root.render(<WorkflowTab timeoutMs={0} />));

    await waitForAssertion(() => {
      if (!container.querySelector('[data-testid="workflow-frame-blocked"]')) throw new Error("notice not shown yet");
    });

    flushSync(() => {
      container
        .querySelector<HTMLIFrameElement>('[data-testid="workflow-frame"]')
        ?.dispatchEvent(new Event("load"));
    });

    expect(container.querySelector('[data-testid="workflow-frame-blocked"]')).toBeNull();
  });

  it("does not announce a refusal while the frame is still pending", async () => {
    flushSync(() => root.render(<WorkflowTab timeoutMs={60_000} />));

    await flush();
    await flush();

    expect(container.querySelector('[data-testid="workflow-frame-blocked"]')).toBeNull();
  });
});
