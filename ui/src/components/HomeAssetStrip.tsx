import { t } from "@/i18n";
import { useMemo, useState } from "react";
import { ImageGalleryModal, type GalleryMediaItem } from "@/components/ImageGalleryModal";
import { cn } from "@/lib/utils";
import {
  extractHomeAssetPaths,
  homeAssetContentType,
  homeAssetFilename,
  homeAssetMediaKind,
  homeAssetUrl,
} from "@/lib/home-asset-paths";

interface HomeAssetStripProps {
  /** Free text (message body, approval summary…) scanned for asset paths. */
  text?: string;
  /** Explicit asset paths (e.g. an approval payload's `media` array). */
  paths?: string[];
  /** Small uppercase section label; off inside chat bubbles where the strip
   * reads as attached media. */
  showLabel?: boolean;
  className?: string;
}

interface HomeAssetItem {
  path: string;
  url: string;
  kind: "image" | "video";
}

function collectItems(text?: string, paths?: string[]): HomeAssetItem[] {
  const candidates = [
    ...(paths ?? []),
    ...(text ? extractHomeAssetPaths(text) : []),
  ];
  const seen = new Set<string>();
  const items: HomeAssetItem[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    const kind = homeAssetMediaKind(candidate);
    if (!kind) continue;
    seen.add(candidate);
    items.push({ path: candidate, url: homeAssetUrl(candidate), kind });
  }
  return items;
}

/**
 * Previews for `/paperclip/assets/...` paths mentioned in a message or an
 * approval payload: images become a thumbnail grid with a lightbox, videos
 * render as inline players. Self-contained so it works both inside task
 * bubbles (which have their own gallery) and on approval pages (which do not).
 */
export function HomeAssetStrip({
  text,
  paths,
  showLabel = false,
  className,
}: HomeAssetStripProps) {
  const items = useMemo(() => collectItems(text, paths), [text, paths]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const images = items.filter((item) => item.kind === "image");
  const videos = items.filter((item) => item.kind === "video");
  const galleryItems: GalleryMediaItem[] = images.map((item) => ({
    id: item.path,
    contentPath: item.url,
    contentType: homeAssetContentType(item.path),
    originalFilename: homeAssetFilename(item.path),
  }));

  return (
    <div className={cn("w-full space-y-2", className)}>
      {showLabel ? (
        <p className="text-(length:--text-micro) font-medium uppercase tracking-(--tracking-label) text-muted-foreground">
          {t("common.mediaPreview")}
        </p>
      ) : null}
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((item, index) => (
            <button
              key={item.path}
              type="button"
              className="group aspect-video min-w-0 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("taskChatBubble.openName", {
                name: homeAssetFilename(item.path),
              })}
              onClick={() => setGalleryIndex(index)}
            >
              <img
                src={item.url}
                alt={homeAssetFilename(item.path)}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-(--s-1_02)"
              />
            </button>
          ))}
        </div>
      ) : null}
      {videos.map((item) => (
        <video
          key={item.path}
          src={item.url}
          controls
          preload="metadata"
          className="w-full max-h-72 rounded-md border border-border/60 bg-black"
        />
      ))}
      <ImageGalleryModal
        items={galleryItems}
        initialIndex={galleryIndex ?? 0}
        open={galleryIndex !== null}
        onOpenChange={(open) => {
          if (!open) setGalleryIndex(null);
        }}
      />
    </div>
  );
}
