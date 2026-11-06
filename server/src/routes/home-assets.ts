/**
 * Preview routes for media files under `<PAPERCLIP_HOME>/assets/`.
 *
 * Agents drop deliverables (publication cards, rendered videos, covers) into
 * the home `assets/` tree and reference them by absolute container path
 * (`/paperclip/assets/...`) in task messages and approval payloads. Those
 * files never enter the DB-backed asset table, so the regular
 * `/api/assets/:id/content` route cannot serve them and the UI used to render
 * bare, unclickable paths. This route streams the file straight off disk so
 * previews work for any message or approval that mentions the path.
 *
 * Scope: any authenticated actor, `assets/` subtree only, preview-safe
 * extension allowlist, single-range streaming for video scrubbing.
 */
import { Router } from "express";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { isInlineAttachmentContentType } from "../attachment-types.js";
import { assertAuthenticated } from "./authz.js";

/**
 * Extension allowlist mirroring what the UI renders inline. Everything else
 * 404s: this route exists for previews, not as a general file server.
 */
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".pdf": "application/pdf",
};

function homeAssetsRootDir(): string {
  return process.env.PAPERCLIP_HOME || process.env.HOME || "/paperclip";
}

/**
 * Resolve the URL's wildcard tail to a path that is guaranteed to stay inside
 * `<home>/assets`. Returns null for anything that would escape the subtree,
 * hit a hidden file, or carry an extension outside the preview allowlist.
 */
export function resolveHomeAssetPath(rawFilePath: string): {
  absolutePath: string;
  contentType: string;
} | null {
  if (rawFilePath.includes("\0")) return null;
  const segments = rawFilePath.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === ".." ||
        segment.startsWith("."),
    )
  ) {
    return null;
  }
  const contentType = EXTENSION_CONTENT_TYPES[path.extname(rawFilePath).toLowerCase()];
  if (!contentType) return null;

  const rootDir = path.resolve(homeAssetsRootDir(), "assets");
  const absolutePath = path.resolve(rootDir, rawFilePath);
  if (!absolutePath.startsWith(rootDir + path.sep)) return null;
  return { absolutePath, contentType };
}

export function homeAssetRoutes() {
  const router = Router();

  router.get("/home-assets/assets/*filePath", async (req, res, next) => {
    assertAuthenticated(req);

    // Express 5 named wildcards arrive as a string or an array of segments.
    const rawParam = req.params.filePath;
    const rawFilePath = Array.isArray(rawParam) ? rawParam.join("/") : rawParam;
    if (typeof rawFilePath !== "string" || rawFilePath.length === 0) {
      res.status(400).json({ error: "File path is required" });
      return;
    }
    let decodedFilePath: string;
    try {
      decodedFilePath = decodeURIComponent(rawFilePath);
    } catch {
      res.status(400).json({ error: "Invalid file path encoding" });
      return;
    }

    const resolved = resolveHomeAssetPath(decodedFilePath);
    if (!resolved) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    let fileStat;
    try {
      fileStat = await stat(resolved.absolutePath);
    } catch {
      res.status(404).json({ error: "Asset not found" });
      return;
    }
    if (!fileStat.isFile()) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    // Single-range streaming keeps video scrubbing cheap; the parsing rules
    // mirror the asset content route.
    const rawRange = req.headers.range;
    const rangeSyntax = rawRange && /^bytes=(\d*)-(\d*)$/i.exec(rawRange);
    const ranges = rawRange ? req.range(fileStat.size) : undefined;
    res.setHeader("Accept-Ranges", "bytes");
    if (
      rawRange &&
      (!rangeSyntax ||
        (!rangeSyntax[1] && !rangeSyntax[2]) ||
        !Array.isArray(ranges) ||
        ranges.length !== 1)
    ) {
      res.setHeader("Content-Range", `bytes */${fileStat.size}`);
      res.status(416).end();
      return;
    }
    const range = Array.isArray(ranges) ? ranges[0] : undefined;
    res.setHeader("Content-Type", resolved.contentType);
    res.setHeader(
      "Content-Length",
      String(range ? range.end - range.start + 1 : fileStat.size),
    );
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const disposition = isInlineAttachmentContentType(resolved.contentType)
      ? "inline"
      : "attachment";
    // Asset basenames carry Chinese; header values are latin-1 only, so the
    // raw name goes into the RFC 5987 parameter and the fallback stays ASCII.
    const rawName = path.basename(resolved.absolutePath);
    const asciiName = rawName.replaceAll('"', "").replace(/[^\x20-\x7e]/g, "_");
    const encodedName = encodeURIComponent(rawName);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
    );

    const stream = createReadStream(
      resolved.absolutePath,
      range ? { start: range.start, end: range.end } : undefined,
    );
    stream.on("error", (err) => {
      next(err);
    });
    stream.pipe(res);
  });

  return router;
}
