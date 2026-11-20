import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CloudinaryMenuImageStorage,
  LocalMenuImageStorage,
} from "./menu-image.storage.js";

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

describe("Cloudinary menu image storage", () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);

  it("uploads a validated image with a server-generated identifier", async () => {
    const uploads: Array<{ folder: string; publicId: string }> = [];
    const storage = new CloudinaryMenuImageStorage(
      "restroflow-demo",
      "restroflow/menu",
      (input) => {
        uploads.push({ folder: input.folder, publicId: input.publicId });
        return Promise.resolve(
          `https://res.cloudinary.com/restroflow-demo/image/upload/v1/restroflow/menu/${input.publicId}.png`,
        );
      },
    );

    await expect(storage.save("image/png", png)).resolves.toMatch(
      /^https:\/\/res\.cloudinary\.com\/restroflow-demo\/image\/upload\//,
    );
    expect(uploads).toHaveLength(1);
    expect(uploads[0]!.folder).toBe("restroflow/menu");
    expect(uploads[0]!.publicId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("validates locally and returns a safe error when storage fails", async () => {
    const upload = () => Promise.reject(new Error("credential detail"));
    const storage = new CloudinaryMenuImageStorage(
      "restroflow-demo",
      "restroflow/menu",
      upload,
    );

    await expect(
      storage.save("image/png", Buffer.from("spoofed")),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE_CONTENT" });
    await expect(storage.save("image/png", png)).rejects.toMatchObject({
      code: "IMAGE_STORAGE_FAILED",
      statusCode: 502,
      message: "The image could not be stored. Please try again.",
    });
  });

  it("rejects an unexpected delivery URL from the provider", async () => {
    const storage = new CloudinaryMenuImageStorage(
      "restroflow-demo",
      "restroflow/menu",
      () => Promise.resolve("https://example.com/untrusted.png"),
    );
    await expect(storage.save("image/png", png)).rejects.toMatchObject({
      code: "IMAGE_STORAGE_FAILED",
    });
  });
});
