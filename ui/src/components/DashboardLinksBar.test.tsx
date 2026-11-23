// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardLinksBar, isValidLinkUrl, linkErrors } from "./DashboardLinksBar";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompany: null }),
}));

vi.mock("@/api/dashboardLinks", async (orig) => ({
  ...(await orig<typeof import("@/api/dashboardLinks")>()),
  dashboardLinksApi: api,
}));

const LINKS = [
  { label: "千帆云递", url: "https://ai-opc-qianfan.culud.com/", icon: "external", newTab: true },
  { label: "部署控制台", url: "/deploy-console", icon: "rocket", newTab: false },
];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
  flushSync(() => {});
}

function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  flushSync(() => {
    r.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route path="/dashboard" element={<DashboardLinksBar />} />
            <Route path="/deploy-console" element={<div data-testid="deploy-page">deploy</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

function setInput(el: Element | null, value: string) {
  if (!el) throw new Error("input not found");
  const input = el as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  flushSync(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(el: Element | null) {
  if (!el) throw new Error("node not found");
  flushSync(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await flush();
}

const q = (sel: string) => document.body.querySelector(sel);

beforeEach(() => {
  api.get.mockResolvedValue({ links: LINKS, updatedAt: null, isDefault: true });
  api.save.mockImplementation(async (links: unknown) => ({ links, updatedAt: "2026-11-23T10:00:00Z", isDefault: false }));
  api.reset.mockResolvedValue({ links: LINKS, updatedAt: null, isDefault: true });
});

afterEach(() => {
  if (root) flushSync(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe("isValidLinkUrl", () => {
  it("accepts in-app paths and http(s) addresses only", () => {
    expect(isValidLinkUrl("/deploy-console")).toBe(true);
    expect(isValidLinkUrl("https://example.com/x")).toBe(true);
    expect(isValidLinkUrl("//evil.example")).toBe(false);
    expect(isValidLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isValidLinkUrl("example.com")).toBe(false);
  });

  it("reports a missing name before saving", () => {
    expect(linkErrors([{ label: " ", url: "/x", icon: "link", newTab: false }])).toBeTruthy();
    expect(linkErrors(LINKS as never)).toBeNull();
  });
});

describe("DashboardLinksBar", () => {
  it("renders the saved buttons: external ones open a new window, in-app ones navigate", async () => {
    render();
    await flush();
    const ext = q('[data-testid="entry-link-0"]') as HTMLAnchorElement;
    expect(ext.getAttribute("href")).toBe("https://ai-opc-qianfan.culud.com/");
    expect(ext.target).toBe("_blank");
    expect(container?.textContent).not.toContain("发布员对话");
    await click(q('[data-testid="entry-link-1"]'));
    expect(q('[data-testid="deploy-page"]')).not.toBeNull();
  });

  it("adds a link in the editor and saves the whole list", async () => {
    render();
    await flush();
    await click(q('[data-testid="entry-links-edit"]'));
    expect(q('[data-testid="links-editor"]')).not.toBeNull();
    await click(q('[data-testid="link-add"]'));
    setInput(q('[data-testid="link-label-2"]'), "小红书后台");
    setInput(q('[data-testid="link-url-2"]'), "https://creator.xiaohongshu.com/");
    await click(q('[data-testid="link-remove-0"]'));
    await click(q('[data-testid="links-save"]'));
    expect(api.save).toHaveBeenCalledWith([
      { label: "部署控制台", url: "/deploy-console", icon: "rocket", newTab: false },
      { label: "小红书后台", url: "https://creator.xiaohongshu.com/", icon: "link", newTab: true },
    ]);
    expect(q('[data-testid="links-editor"]')).toBeNull();
    expect((q('[data-testid="entry-link-1"]') as HTMLAnchorElement).getAttribute("href")).toBe("https://creator.xiaohongshu.com/");
  });

  it("blocks saving an invalid address and shows why", async () => {
    render();
    await flush();
    await click(q('[data-testid="entry-links-edit"]'));
    setInput(q('[data-testid="link-url-0"]'), "javascript:alert(1)");
    await click(q('[data-testid="links-save"]'));
    expect(api.save).not.toHaveBeenCalled();
    expect(q('[data-testid="links-error"]')?.textContent).toBeTruthy();
  });
});
