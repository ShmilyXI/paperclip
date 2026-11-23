import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";
import { DEFAULT_DASHBOARD_LINKS, dashboardLinkRoutes } from "./dashboard-links.js";

let dir: string;
let file: string;

function app(actor: Record<string, unknown>) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as unknown as { actor: unknown }).actor = actor;
    next();
  });
  a.use("/api", dashboardLinkRoutes({ file }));
  a.use(errorHandler);
  return a;
}

const board = { type: "board", source: "session", userId: "u1", companyIds: ["c1"], isInstanceAdmin: false };
const agent = { type: "agent", agentId: "a1", companyId: "c1" };

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "dash-links-"));
  file = path.join(dir, "mowa", "dashboard-links.json");
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("dashboard links routes", () => {
  it("returns the defaults when nothing is saved", async () => {
    const res = await request(app(board)).get("/api/instance/dashboard-links");
    expect(res.status).toBe(200);
    expect(res.body.isDefault).toBe(true);
    expect(res.body.links).toEqual(DEFAULT_DASHBOARD_LINKS);
    expect(res.body.links.map((l: { label: string }) => l.label)).not.toContain("千帆 · 发布员对话");
  });

  it("saves, reads back and resets the links", async () => {
    const links = [
      { label: "小红书后台", url: "https://creator.xiaohongshu.com/", icon: "globe", newTab: true },
      { label: "部署控制台", url: "/deploy-console" },
    ];
    const put = await request(app(board)).put("/api/instance/dashboard-links").send({ links });
    expect(put.status).toBe(200);
    expect(put.body.links[1]).toEqual({ label: "部署控制台", url: "/deploy-console", icon: "link", newTab: false });
    const get = await request(app(board)).get("/api/instance/dashboard-links");
    expect(get.body.isDefault).toBe(false);
    expect(get.body.links).toHaveLength(2);
    expect(get.body.updatedAt).toBeTruthy();
    const del = await request(app(board)).delete("/api/instance/dashboard-links");
    expect(del.body.isDefault).toBe(true);
  });

  it("rejects unsafe or malformed links", async () => {
    for (const url of ["javascript:alert(1)", "//evil.example", "ftp://x", "relative/path", ""]) {
      const res = await request(app(board)).put("/api/instance/dashboard-links").send({ links: [{ label: "x", url }] });
      expect(res.status, url).toBe(400);
    }
    const blank = await request(app(board)).put("/api/instance/dashboard-links").send({ links: [{ label: " ", url: "/x" }] });
    expect(blank.status).toBe(400);
    const extra = await request(app(board)).put("/api/instance/dashboard-links").send({ links: [], extra: 1 });
    expect(extra.status).toBe(400);
  });

  it("does not let agents read or change the links", async () => {
    expect((await request(app(agent)).get("/api/instance/dashboard-links")).status).toBe(403);
    expect((await request(app(agent)).put("/api/instance/dashboard-links").send({ links: [] })).status).toBe(403);
  });
});
