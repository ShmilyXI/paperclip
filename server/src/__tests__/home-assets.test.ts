import { afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let homeDir: string;

async function createApp(authenticated: boolean) {
  const { homeAssetRoutes } = await import("../routes/home-assets.js");
  const app = express();
  app.use((req, _res, next) => {
    req.actor = authenticated
      ? { type: "board", source: "local_implicit", userId: "user-1" }
      : { type: "none" };
    next();
  });
  app.use("/api", homeAssetRoutes());
  app.use(
    (
      err: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(err.status ?? 500).json({ error: err.message });
    },
  );
  return app;
}

describe("GET /api/home-assets/assets/*filePath", () => {
  beforeEach(async () => {
    homeDir = await mkdtemp(path.join(tmpdir(), "home-assets-test-"));
    process.env.PAPERCLIP_HOME = homeDir;
    await mkdir(path.join(homeDir, "assets", "内容与宣传", "2026-11-03"), {
      recursive: true,
    });
    await writeFile(
      path.join(homeDir, "assets", "内容与宣传", "2026-11-03", "card_1.png"),
      Buffer.from("fake-png-bytes-0123456789"),
    );
    await writeFile(
      path.join(homeDir, "assets", "clip.mp4"),
      Buffer.from("fake-mp4-bytes-abcdefghijklmnop"),
    );
    await writeFile(
      path.join(homeDir, "assets", ".hidden.png"),
      Buffer.from("hidden"),
    );
    await writeFile(path.join(homeDir, "secret.txt"), Buffer.from("secret"));
  });

  afterEach(async () => {
    delete process.env.PAPERCLIP_HOME;
    if (homeDir) await rm(homeDir, { recursive: true, force: true });
  });

  it("streams an asset with preview headers", async () => {
    const app = await createApp(true);
    const res = await request(app).get("/api/home-assets/assets/clip.mp4");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("video/mp4");
    expect(res.headers["accept-ranges"]).toBe("bytes");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-disposition"]).toContain("inline");
    expect(res.body.toString()).toBe("fake-mp4-bytes-abcdefghijklmnop");
  });

  it("serves URL-encoded non-ASCII paths", async () => {
    const app = await createApp(true);
    const res = await request(app).get(
      "/api/home-assets/assets/" +
        encodeURIComponent("内容与宣传") +
        "/" +
        encodeURIComponent("2026-11-03") +
        "/" +
        encodeURIComponent("card_1.png"),
    );
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.body.toString()).toBe("fake-png-bytes-0123456789");
  });

  it("honors a single range request with 206", async () => {
    const app = await createApp(true);
    const res = await request(app)
      .get("/api/home-assets/assets/clip.mp4")
      .set("Range", "bytes=5-9");
    expect(res.status).toBe(206);
    expect(res.headers["content-range"]).toBe("bytes 5-9/31");
    expect(res.headers["content-length"]).toBe("5");
    expect(res.body.toString()).toBe("mp4-b");
  });

  it("streams a non-ASCII filename without header corruption", async () => {
    await writeFile(path.join(homeDir, "assets", "AI的语言税-final.mp4"), Buffer.from("cjk-mp4"));
    const app = await createApp(true);
    const res = await request(app).get(
      "/api/home-assets/assets/" + encodeURIComponent("AI的语言税-final.mp4"),
    );
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("video/mp4");
    expect(res.headers["content-disposition"]).toBe(
      'inline; filename="AI____-final.mp4"; filename*=UTF-8\'\'AI%E7%9A%84%E8%AF%AD%E8%A8%80%E7%A8%8E-final.mp4',
    );
    expect(res.body.toString()).toBe("cjk-mp4");
  });

  it("rejects malformed ranges with 416", async () => {
    const app = await createApp(true);
    const res = await request(app)
      .get("/api/home-assets/assets/clip.mp4")
      .set("Range", "bytes=5-9,20-25");
    expect(res.status).toBe(416);
    expect(res.headers["content-range"]).toBe("bytes */31");
  });

  it("rejects unauthenticated requests with 401", async () => {
    const app = await createApp(false);
    const res = await request(app).get("/api/home-assets/assets/clip.mp4");
    expect(res.status).toBe(401);
  });

  it("blocks traversal outside the assets subtree", async () => {
    const app = await createApp(true);
    const res = await request(app).get(
      "/api/home-assets/assets/" + encodeURIComponent("../secret.txt"),
    );
    expect(res.status).toBe(404);
  });

  it("blocks hidden files and non-previewable extensions", async () => {
    const app = await createApp(true);
    expect(
      (await request(app).get("/api/home-assets/assets/" + encodeURIComponent(".hidden.png"))).status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/home-assets/assets/secret.txt")).status,
    ).toBe(404);
  });

  it("404s for missing files", async () => {
    const app = await createApp(true);
    const res = await request(app).get("/api/home-assets/assets/nope.png");
    expect(res.status).toBe(404);
  });
});
