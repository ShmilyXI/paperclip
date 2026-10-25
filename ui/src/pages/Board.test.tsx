// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import appSource from "../App.tsx?raw";
import sidebarSource from "../components/Sidebar.tsx?raw";
import productionSidebarSource from "../components/Sidebar.production.tsx?raw";
import {
  BOARD_URL_STORAGE_KEY,
  Board,
  DEFAULT_BOARD_URL,
  normalizeBoardUrl,
  readBoardUrl,
} from "./Board";

const breadcrumbState = vi.hoisted(() => ({ setBreadcrumbs: vi.fn() }));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => breadcrumbState,
}));

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

function renderBoard(container: HTMLDivElement, frameLoadTimeoutMs = 60_000) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <MemoryRouter initialEntries={["/ACME/board"]}>
        <Board frameLoadTimeoutMs={frameLoadTimeoutMs} />
      </MemoryRouter>,
    );
  });
  return { root };
}

function frame(container: HTMLElement) {
  const node = container.querySelector<HTMLIFrameElement>('[data-testid="board-frame"]');
  if (!node) throw new Error("board frame not rendered");
  return node;
}

function click(node: Element) {
  flushSync(() => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  flushSync(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Board page", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    breadcrumbState.setBreadcrumbs.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    window.localStorage.clear();
  });

  it("defaults to the local board service when nothing is stored", () => {
    expect(DEFAULT_BOARD_URL).toBe("https://ai-opc-dashboard.mowalab.com");
    expect(readBoardUrl()).toBe(DEFAULT_BOARD_URL);

    renderBoard(container);

    expect(frame(container).getAttribute("src")).toBe("https://ai-opc-dashboard.mowalab.com");
  });

  it("uses the localStorage override, and falls back on blank or schemeless values", () => {
    expect(normalizeBoardUrl("")).toBe(DEFAULT_BOARD_URL);
    expect(normalizeBoardUrl("  ")).toBe(DEFAULT_BOARD_URL);
    expect(normalizeBoardUrl("board.internal:3110")).toBe("http://board.internal:3110");
    expect(normalizeBoardUrl("https://board.example.com/x")).toBe("https://board.example.com/x");

    window.localStorage.setItem(BOARD_URL_STORAGE_KEY, "  http://10.0.0.7:3110/dash  ");

    renderBoard(container);

    expect(frame(container).getAttribute("src")).toBe("http://10.0.0.7:3110/dash");
  });

  it("applies a saved address immediately and persists it under the documented key", () => {
    renderBoard(container);
    const settingsToggle = container.querySelector('[data-testid="board-settings-toggle"]');
    if (!settingsToggle) throw new Error("settings toggle missing");

    click(settingsToggle);

    const input = container.querySelector<HTMLInputElement>('[data-testid="board-address-input"]');
    if (!input) throw new Error("address input missing");
    expect(input.value).toBe(DEFAULT_BOARD_URL);

    typeInto(input, "http://board.lan:3110/");
    const save = container.querySelector('[data-testid="board-address-save"]');
    if (!save) throw new Error("save button missing");
    click(save);

    expect(frame(container).getAttribute("src")).toBe("http://board.lan:3110/");
    expect(window.localStorage.getItem(BOARD_URL_STORAGE_KEY)).toBe("http://board.lan:3110/");
    expect(container.querySelector('[data-testid="board-settings"]')).toBeNull();
  });

  it("never stays silent when the frame is refused: explains it, links out, shows the address", async () => {
    renderBoard(container, 0);

    await waitForAssertion(() => {
      const notice = container.querySelector('[data-testid="board-frame-blocked"]');
      if (!notice) throw new Error("no refusal notice");
      expect(notice.textContent).toContain(DEFAULT_BOARD_URL);
      const link = container.querySelector<HTMLAnchorElement>('[data-testid="board-blocked-open-external"]');
      expect(link?.getAttribute("href")).toBe(DEFAULT_BOARD_URL);
      expect(link?.target).toBe("_blank");
    });
  });

  it("is reachable from both app shells: one shared route, one entry per sidebar", () => {
    // boardRoutes() is the company-prefix child route set for BOTH shells.
    expect(appSource).toContain('<Route path="board" element={<CoordinationBoard />} />');
    expect(appSource).toContain('element={streamlinedUiEnabled ? <Layout /> : <ProductionLayout />}');
    const entry = '<SidebarNavItem to="/board" label={t("nav.board")} icon={KanbanSquare} />';
    expect(sidebarSource).toContain(entry);
    expect(productionSidebarSource).toContain(entry);
  });

  it("clears the refusal notice once the frame reports a load", async () => {
    renderBoard(container, 0);

    await waitForAssertion(() => {
      if (!container.querySelector('[data-testid="board-frame-blocked"]')) throw new Error("notice not shown yet");
    });

    flushSync(() => {
      frame(container).dispatchEvent(new Event("load"));
    });

    expect(container.querySelector('[data-testid="board-frame-blocked"]')).toBeNull();
  });
});
