import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalMenuImageStorage } from "./menu-image.storage.js";

describe("local menu image storage", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "restroflow-menu-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("stores a server-named PNG after checking its signature", async () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const reference = await new LocalMenuImageStorage(directory).save(
      "image/png",
      png,
    );
    expect(reference).toMatch(/^\/uploads\/menu\/[0-9a-f-]+\.png$/);
    await expect(
      stat(path.join(directory, path.basename(reference))),
    ).resolves.toMatchObject({ size: png.length });
  });

  it("rejects spoofed image content and oversized files", async () => {
    const storage = new LocalMenuImageStorage(directory);
    await expect(
      storage.save("image/png", Buffer.from("not png")),
    ).rejects.toMatchObject({
      code: "INVALID_IMAGE_CONTENT",
      statusCode: 415,
    });
    await expect(
      storage.save("image/jpeg", Buffer.alloc(3 * 1024 * 1024 + 1)),
    ).rejects.toMatchObject({
      code: "IMAGE_SIZE_INVALID",
      statusCode: 413,
    });
  });
});
