/**
 * Helpers for `/paperclip/assets/...` container paths that agents drop into
 * task messages and approval payloads.
 *
 * Those paths point at files in the home `assets/` tree (never uploaded to the
 * DB asset table), so the only way to preview them is the
 * `/api/home-assets/assets/...` route that serves that tree directly. These
 * helpers find the paths in arbitrary text and build previewable URLs.
 */

/** Media extensions the home-assets route and the preview strip both handle. */
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);

/**
 * Matches `/paperclip/assets/...` paths in free text. Segments may contain
 * non-ASCII characters (Chinese folder names); the class stops at whitespace,
 * quotes, brackets, and common ASCII/CJK punctuation so prose keeps working.
 */
const HOME_ASSET_PATH_PATTERN =
  /\/paperclip\/assets\/[^\s`()[\]{}<>"'，。；、！？）】»]+/g;

function hasPreviewableExtension(filePath: string): boolean {
  const dot = filePath.lastIndexOf(".");
  if (dot < 0) return false;
  const extension = filePath.slice(dot).toLowerCase();
  return IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension);
}

/** Extract deduplicated `/paperclip/assets/...` media paths, preserving order. */
export function extractHomeAssetPaths(text: string): string[] {
  const matches = text.match(HOME_ASSET_PATH_PATTERN) ?? [];
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const rawMatch of matches) {
    // Prose punctuation (list commas, sentence periods) can trail the path.
    const match = rawMatch.replace(/[.,:;!]+$/, "");
    if (seen.has(match)) continue;
    if (!hasPreviewableExtension(match)) continue;
    seen.add(match);
    paths.push(match);
  }
  return paths;
}

export type HomeAssetMediaKind = "image" | "video";

/** Classify a previewable path, or null when the extension is not media. */
export function homeAssetMediaKind(filePath: string): HomeAssetMediaKind | null {
  const dot = filePath.lastIndexOf(".");
  if (dot < 0) return null;
  const extension = filePath.slice(dot).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  return null;
}

/** Map `/paperclip/assets/a/b.png` to `/api/home-assets/assets/a/b.png`. */
export function homeAssetUrl(containerPath: string): string {
  const relative = containerPath.replace(/^\/paperclip\//, "");
  return "/api/home-assets/" + relative
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** Best-effort filename for labels and download names. */
export function homeAssetFilename(containerPath: string): string {
  const segments = containerPath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? containerPath;
}

/** Content type matching the server's extension allowlist (for gallery items). */
export function homeAssetContentType(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  const extension = dot < 0 ? "" : filePath.slice(dot).toLowerCase();
  switch (extension) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".mp4": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".webm": return "video/webm";
    case ".m4v": return "video/x-m4v";
    default: return "application/octet-stream";
  }
}
