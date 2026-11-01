// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { i18n } from "@/i18n";
import appSource from "../App.tsx?raw";
import sidebarSource from "../components/Sidebar.tsx?raw";
import productionSidebarSource from "../components/Sidebar.production.tsx?raw";

const breadcrumbState = vi.hoisted(() => ({ setBreadcrumbs: vi.fn() }));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => breadcrumbState,
}));

describe("Infinite Canvas entry", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    breadcrumbState.setBreadcrumbs.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    flushSync(() => root.unmount());
    container.remove();
    await i18n.changeLanguage("en");
  });

  async function renderPage() {
    const { InfiniteCanvas } = await import("./InfiniteCanvas");
    flushSync(() => root.render(
      <TooltipProvider>
        <InfiniteCanvas />
      </TooltipProvider>,
    ));
  }

  it("places the entry immediately after Board in both sidebar variants", () => {
    for (const source of [sidebarSource, productionSidebarSource]) {
      expect(source).toMatch(
        /<SidebarNavItem to="\/board"[^>]+\/>\s*<SidebarNavItem to="\/infinite-canvas" label=\{t\("nav.infiniteCanvas"\)\} icon=\{PanelTop\} \/>/,
      );
    }
    expect(appSource).toContain('<Route path="infinite-canvas" element={<InfiniteCanvas />} />');
    expect(appSource).toContain('<Route path="infinite-canvas" element={<UnprefixedBoardRedirect />} />');
  });

  it("embeds the deployed HTTPS application and offers a safe external link", async () => {
    await renderPage();

    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("https://canvas.culud.com/");
    expect(frame?.title).toBe("Infinite Canvas");
    expect(breadcrumbState.setBreadcrumbs).toHaveBeenCalledWith([{ label: "Infinite Canvas" }]);
    const external = container.querySelector<HTMLAnchorElement>('a[target="_blank"]');
    expect(external?.getAttribute("href")).toBe("https://canvas.culud.com/");
    expect(external?.rel).toContain("noopener");
    expect(external?.rel).toContain("noreferrer");
  });

  it("reloads only the embedded canvas when requested", async () => {
    await renderPage();
    const original = container.querySelector("iframe");
    const reload = container.querySelector<HTMLButtonElement>('button[aria-label="Reload canvas"]');
    expect(reload).not.toBeNull();

    flushSync(() => reload!.click());

    expect(container.querySelector("iframe")).not.toBe(original);
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("https://canvas.culud.com/");
  });

  it("reserves a viewport-based canvas height in the mobile document-flow shell", async () => {
    await renderPage();

    const page = container.querySelector('[data-page="infinite-canvas"]');
    expect(page?.classList.contains("h-(--infinite-canvas-mobile-height)")).toBe(true);
    expect(page?.classList.contains("md:h-full")).toBe(true);
  });

  it("uses Chinese labels when the UI language is Chinese", async () => {
    await i18n.changeLanguage("zh-CN");
    await renderPage();

    expect(container.querySelector("iframe")?.title).toBe("无限画布");
    expect(container.querySelector('button[aria-label="刷新画布"]')).not.toBeNull();
    expect(container.querySelector('a[aria-label="在新窗口打开"]')).not.toBeNull();
  });
});
