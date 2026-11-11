// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import appSource from "../App.tsx?raw";
import sidebarSource from "../components/Sidebar.tsx?raw";
import productionSidebarSource from "../components/Sidebar.production.tsx?raw";
import { EmbeddedSite } from "./EmbeddedSite";
import { OFFICE_URL, parseOfficeMessage } from "./Office";
import { DEPLOY_CONSOLE_URL } from "./DeployConsole";

const breadcrumbState = vi.hoisted(() => ({ setBreadcrumbs: vi.fn(), setBreadcrumbToolbar: vi.fn() }));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => breadcrumbState,
}));

const UUID = "0f5f5f17-3dd2-4f4a-ab83-c1da3991494f";
const open = (path: unknown) => ({ type: "mowa-office:open", path });

describe("parseOfficeMessage", () => {
  it("accepts task, approval and chat pages", () => {
    expect(parseOfficeMessage(open("/issues/MOW-562"))).toEqual({ kind: "navigate", to: "/issues/MOW-562" });
    expect(parseOfficeMessage(open(`/approvals/${UUID}`))).toEqual({ kind: "navigate", to: `/approvals/${UUID}` });
    expect(parseOfficeMessage(open("/chats/ops-engineer"))).toEqual({ kind: "navigate", to: "/chats/ops-engineer" });
  });

  it("turns the new-task link into the dialog, with an optional assignee", () => {
    expect(parseOfficeMessage(open("/dashboard?newTask=1"))).toEqual({ kind: "newTask" });
    expect(parseOfficeMessage(open(`/dashboard?newTask=1&assignee=${UUID}`))).toEqual({ kind: "newTask", assigneeAgentId: UUID });
  });

  it("rejects everything else", () => {
    for (const bad of [
      "//evil.example/x",
      "https://evil.example/issues/MOW-1",
      "/issues/../../etc",
      "/issues/MOW-1?x=1",
      "/settings/instance",
      "/dashboard?newTask=1&assignee=not-a-uuid",
      `/${"a".repeat(300)}`,
      42,
      null,
    ]) {
      expect(parseOfficeMessage(open(bad))).toBeNull();
    }
    expect(parseOfficeMessage({ type: "other", path: "/issues/MOW-1" })).toBeNull();
    expect(parseOfficeMessage("/issues/MOW-1")).toBeNull();
  });
});

describe("Office and Deploy Console entries", () => {
  it("are in-app routes and sidebar items, not external links", () => {
    expect(OFFICE_URL).toBe("https://ai-opc-office.culud.com");
    expect(DEPLOY_CONSOLE_URL).toBe("https://ai-opc-deploy.culud.com");
    for (const source of [sidebarSource, productionSidebarSource]) {
      expect(source).toContain('<SidebarNavItem to="/deploy-console" label={t("nav.deployConsole")}');
      expect(source).toContain('<SidebarNavItem to="/office" label={t("nav.office")}');
      expect(source).not.toContain('href="https://ai-opc-office.culud.com"');
      expect(source).not.toContain('href="https://ai-opc-deploy.culud.com"');
    }
    expect(appSource).toContain('<Route path="office" element={<OfficePage />} />');
    expect(appSource).toContain('<Route path="deploy-console" element={<DeployConsolePage />} />');
  });
});

describe("EmbeddedSite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    breadcrumbState.setBreadcrumbs.mockClear();
    breadcrumbState.setBreadcrumbToolbar.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    flushSync(() => root.unmount());
    container.remove();
  });

  it("frames the site and puts its address and buttons in the breadcrumb bar", () => {
    flushSync(() => root.render(<EmbeddedSite pageKey="office" title="Office" url={OFFICE_URL} />));
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(OFFICE_URL);
    expect(breadcrumbState.setBreadcrumbs).toHaveBeenCalledWith([{ label: "Office" }]);
    expect(breadcrumbState.setBreadcrumbToolbar).toHaveBeenCalled();
    expect(breadcrumbState.setBreadcrumbToolbar.mock.calls.at(-1)?.[0]).not.toBeNull();
    flushSync(() => root.unmount());
    expect(breadcrumbState.setBreadcrumbToolbar.mock.calls.at(-1)?.[0]).toBeNull();
    root = createRoot(container);
  });

  it("passes messages only from the framed window and origin", () => {
    const received: unknown[] = [];
    flushSync(() => root.render(<EmbeddedSite pageKey="office" title="Office" url={OFFICE_URL} onFrameMessage={(d) => received.push(d)} />));
    const frameWindow = container.querySelector("iframe")!.contentWindow!;
    const fire = (origin: string, source: MessageEventSource | null) =>
      window.dispatchEvent(new MessageEvent("message", { data: open("/issues/MOW-1"), origin, source }));

    fire("https://evil.example", frameWindow);
    fire(OFFICE_URL, window);
    expect(received).toHaveLength(0);
    fire(OFFICE_URL, frameWindow);
    expect(received).toHaveLength(1);
  });
});
