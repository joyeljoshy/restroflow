import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CloudinaryMenuImageStorage,
  createCloudinaryUpload,
  LocalMenuImageStorage,
  type MenuImageFailureDiagnostic,
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
  const credentials = {
    cloudName: "restroflow-demo",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
  };

  function captureDiagnostics(requestId = "upload-request-id") {
    const entries: MenuImageFailureDiagnostic[] = [];
    return {
      entries,
      context: {
        requestId,
        logFailure: (diagnostic: MenuImageFailureDiagnostic) => {
          entries.push(diagnostic);
        },
      },
    };
  }

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

  it("logs a sanitized SDK callback failure and preserves the public error", async () => {
    const sensitiveError = {
      http_code: 503,
      code: "ECONNRESET",
      message: "api_secret=test-api-secret",
      signedUrl: "https://example.com/signed?token=session-token",
      credentials: { apiKey: "test-api-key" },
    };
    const upload = createCloudinaryUpload(credentials, (_options, callback) => {
      let onError: ((error: unknown) => void) | undefined;
      return {
        once(_event, listener) {
          onError = listener;
          return this;
        },
        end() {
          callback(sensitiveError);
          expect(onError).toBeDefined();
        },
      };
    });
    const storage = new CloudinaryMenuImageStorage(
      "restroflow-demo",
      "restroflow/menu",
      upload,
    );
    const diagnostics = captureDiagnostics();

    await expect(
      storage.save("image/png", Buffer.from("spoofed")),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE_CONTENT" });
    await expect(
      storage.save("image/png", png, diagnostics.context),
    ).rejects.toMatchObject({
      code: "IMAGE_STORAGE_FAILED",
      statusCode: 502,
      message: "The image could not be stored. Please try again.",
    });
    expect(diagnostics.entries).toEqual([
      {
        requestId: "upload-request-id",
        provider: "cloudinary",
        stage: "sdk_callback",
        imageMimeType: "image/png",
        imageByteCount: png.length,
        cloudinaryHttpStatus: 503,
        providerErrorCode: "ECONNRESET",
        errorCategory: "network",
      },
    ]);
    const serializedLog = JSON.stringify(diagnostics.entries);
    expect(serializedLog).not.toContain("test-api-secret");
    expect(serializedLog).not.toContain("test-api-key");
    expect(serializedLog).not.toContain("session-token");
    expect(serializedLog).not.toContain("signedUrl");
    expect(serializedLog).not.toContain("message");
  });

  it("reports a missing secure URL without exposing the provider response", async () => {
    const upload = createCloudinaryUpload(
      credentials,
      (_options, callback) => ({
        once() {
          return this;
        },
        end() {
          callback(undefined, { secure_url: undefined });
        },
      }),
    );
    const storage = new CloudinaryMenuImageStorage(
      "restroflow-demo",
      "restroflow/menu",
      upload,
    );
    const diagnostics = captureDiagnostics();

    await expect(
      storage.save("image/png", png, diagnostics.context),
    ).rejects.toMatchObject({ code: "IMAGE_STORAGE_FAILED", statusCode: 502 });
    expect(diagnostics.entries).toEqual([
      expect.objectContaining({
        stage: "missing_secure_url",
        errorCategory: "response_invalid",
      }),
    ]);
  });

  it("reports stream errors with only allowlisted fields", async () => {
    const upload = createCloudinaryUpload(credentials, () => {
      let onError: ((error: unknown) => void) | undefined;
      return {
        once(_event, listener) {
          onError = listener;
          return this;
        },
        end() {
          onError?.({
            code: "ETIMEDOUT",
            message: "secret provider detail",
          });
        },
      };
    });
    const storage = new CloudinaryMenuImageStorage(
      "restroflow-demo",
      "restroflow/menu",
      upload,
    );
    const diagnostics = captureDiagnostics();

    await expect(
      storage.save("image/png", png, diagnostics.context),
    ).rejects.toMatchObject({ code: "IMAGE_STORAGE_FAILED", statusCode: 502 });
    expect(diagnostics.entries).toEqual([
      expect.objectContaining({
        stage: "stream_error",
        providerErrorCode: "ETIMEDOUT",
        errorCategory: "timeout",
      }),
    ]);
    expect(JSON.stringify(diagnostics.entries)).not.toContain(
      "secret provider detail",
    );
  });

  it.each([
    ["malformed response", "not-a-url"],
    ["untrusted host", "https://example.com/untrusted.png"],
    [
      "wrong cloud path",
      "https://res.cloudinary.com/another-cloud/image/upload/image.png",
    ],
  ])("rejects a %s during response validation", async (_name, reference) => {
    const storage = new CloudinaryMenuImageStorage(
      "restroflow-demo",
      "restroflow/menu",
      () => Promise.resolve(reference),
    );
    const diagnostics = captureDiagnostics();

    await expect(
      storage.save("image/png", png, diagnostics.context),
    ).rejects.toMatchObject({ code: "IMAGE_STORAGE_FAILED", statusCode: 502 });
    expect(diagnostics.entries).toEqual([
      expect.objectContaining({
        stage: "response_validation",
        errorCategory: "response_invalid",
      }),
    ]);
    expect(JSON.stringify(diagnostics.entries)).not.toContain(reference);
  });
});
