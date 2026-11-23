import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../errors.js";
import { resolvePaperclipInstanceRoot } from "../home-paths.js";
import { assertBoardOrgAccess } from "./authz.js";

/**
 * Mowa：仪表盘「总览」顶部的快捷入口按钮，由老板在页面上自己增删改。
 * 存成实例目录下的一个 JSON 文件（不建表，避免和上游的数据库迁移冲突）；文件不存在时返回默认按钮。
 */
export const DASHBOARD_LINK_ICONS = [
  "external",
  "rocket",
  "canvas",
  "send",
  "chart",
  "globe",
  "book",
  "folder",
  "video",
  "bot",
  "settings",
  "link",
] as const;

export const dashboardLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    // 站内路径（以 / 开头，如 /deploy-console）或 http(s) 完整地址
    url: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https?:\/\/[^\s]+$/i.test(v), {
        message: "url must be an in-app path starting with / or an http(s) address",
      }),
    icon: z.enum(DASHBOARD_LINK_ICONS).default("link"),
    newTab: z.boolean().default(false),
  })
  .strict();

export const dashboardLinksSchema = z.object({ links: z.array(dashboardLinkSchema).max(30) }).strict();

export type DashboardLink = z.infer<typeof dashboardLinkSchema>;

export const DEFAULT_DASHBOARD_LINKS: DashboardLink[] = [
  { label: "千帆云递", url: "https://ai-opc-qianfan.culud.com/", icon: "external", newTab: true },
  { label: "部署控制台", url: "/deploy-console", icon: "rocket", newTab: false },
  { label: "无限画布", url: "/infinite-canvas", icon: "canvas", newTab: false },
];

export function dashboardLinksFile(root = resolvePaperclipInstanceRoot()) {
  return path.join(root, "mowa", "dashboard-links.json");
}

export async function readDashboardLinks(file = dashboardLinksFile()) {
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    const parsed = dashboardLinksSchema.safeParse({ links: raw.links });
    if (parsed.success) return { links: parsed.data.links, updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null, isDefault: false };
  } catch {
    // 没有文件或文件坏了：用默认按钮
  }
  return { links: DEFAULT_DASHBOARD_LINKS, updatedAt: null, isDefault: true };
}

export async function writeDashboardLinks(links: DashboardLink[], file = dashboardLinksFile()) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body = { links, updatedAt: new Date().toISOString() };
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(body, null, 2) + "\n");
  await fs.rename(tmp, file);
  return { ...body, isDefault: false };
}

export function dashboardLinkRoutes(opts: { file?: string } = {}) {
  const router = Router();
  const file = () => opts.file ?? dashboardLinksFile();

  router.get("/instance/dashboard-links", async (req, res) => {
    assertBoardOrgAccess(req);
    res.json(await readDashboardLinks(file()));
  });

  router.put("/instance/dashboard-links", async (req, res) => {
    assertBoardOrgAccess(req);
    const parsed = dashboardLinksSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid dashboard links", parsed.error.issues);
    res.json(await writeDashboardLinks(parsed.data.links, file()));
  });

  // 恢复默认：删掉文件
  router.delete("/instance/dashboard-links", async (req, res) => {
    assertBoardOrgAccess(req);
    await fs.rm(file(), { force: true });
    res.json(await readDashboardLinks(file()));
  });

  return router;
}
