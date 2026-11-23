import { api } from "./client";

/** Mowa：仪表盘「总览」顶部的快捷入口（服务端存在实例目录的 mowa/dashboard-links.json）。 */
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
export type DashboardLinkIcon = (typeof DASHBOARD_LINK_ICONS)[number];

export interface DashboardLink {
  label: string;
  /** 站内路径（以 / 开头）或 http(s) 完整地址 */
  url: string;
  icon: DashboardLinkIcon;
  newTab: boolean;
}

export interface DashboardLinksResponse {
  links: DashboardLink[];
  updatedAt: string | null;
  isDefault: boolean;
}

export const dashboardLinksApi = {
  get: () => api.get<DashboardLinksResponse>("/instance/dashboard-links"),
  save: (links: DashboardLink[]) => api.put<DashboardLinksResponse>("/instance/dashboard-links", { links }),
  reset: () => api.delete<DashboardLinksResponse>("/instance/dashboard-links"),
};
