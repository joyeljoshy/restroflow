import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { v2 as cloudinary } from "cloudinary";

import { AppError } from "../../errors/app-error.js";

const extensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function matchesSignature(contentType: string, data: Buffer): boolean {
  if (contentType === "image/jpeg") {
    return (
      data.length >= 3 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff
    );
  }
  if (contentType === "image/png") {
    return (
      data.length >= 8 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    contentType === "image/webp" &&
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function validateImage(contentType: string | undefined, data: Buffer): string {
  const extension = contentType ? extensions.get(contentType) : undefined;
  if (!contentType || !extension) {
    throw new AppError(
      415,
      "UNSUPPORTED_IMAGE_TYPE",
      "Menu images must be JPEG, PNG, or WebP files.",
    );
  }
  if (data.length === 0 || data.length > 3 * 1024 * 1024) {
    throw new AppError(
      413,
      "IMAGE_SIZE_INVALID",
      "Menu images must be between 1 byte and 3 MB.",
    );
  }
  if (!matchesSignature(contentType, data)) {
    throw new AppError(
      415,
      "INVALID_IMAGE_CONTENT",
      "The uploaded file content does not match its image type.",
    );
  }
  return extension;
}

export interface MenuImageStorage {
  save(
    contentType: string | undefined,
    data: Buffer,
    diagnostics?: MenuImageDiagnostics,
  ): Promise<string>;
}

export type MenuImageFailureStage =
  | "sdk_callback"
  | "missing_secure_url"
  | "response_validation"
  | "stream_error";

type ProviderErrorCode =
  | "EAI_AGAIN"
  | "ECONNABORTED"
  | "ECONNREFUSED"
  | "ECONNRESET"
  | "ENETUNREACH"
  | "ENOTFOUND"
  | "ETIMEDOUT";

type MenuImageErrorCategory =
  | "authentication"
  | "invalid_request"
  | "network"
  | "provider_error"
  | "rate_limit"
  | "response_invalid"
  | "timeout"
  | "unknown";

export type MenuImageFailureDiagnostic = {
  requestId: string;
  provider: "cloudinary";
  stage: MenuImageFailureStage;
  imageMimeType: string;
  imageByteCount: number;
  cloudinaryHttpStatus?: number;
  providerErrorCode?: ProviderErrorCode;
  errorCategory: MenuImageErrorCategory;
};

export type MenuImageDiagnostics = {
  requestId: string;
  logFailure(diagnostic: MenuImageFailureDiagnostic): void;
};

export class LocalMenuImageStorage implements MenuImageStorage {
  constructor(private readonly directory: string) {}

  async save(contentType: string | undefined, data: Buffer): Promise<string> {
    const extension = validateImage(contentType, data);
    const fileName = `${randomUUID()}${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(path.join(this.directory, fileName), data, { flag: "wx" });
    return `/uploads/menu/${fileName}`;
  }
}

type CloudinaryUpload = (input: {
  data: Buffer;
  folder: string;
  publicId: string;
}) => Promise<string>;

type CloudinaryUploadStream = {
  once(event: "error", listener: (error: unknown) => void): unknown;
  end(data: Buffer): void;
};

type CloudinaryUploadStreamFactory = (
  options: {
    resource_type: "image";
    type: "upload";
    folder: string;
    public_id: string;
    overwrite: false;
    unique_filename: false;
    use_filename: false;
  },
  callback: (error?: unknown, result?: { secure_url?: unknown }) => void,
) => CloudinaryUploadStream;

const providerErrorCodes = new Set<ProviderErrorCode>([
  "EAI_AGAIN",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

function recordValue(error: unknown, key: string): unknown {
  if (typeof error !== "object" || error === null || !(key in error))
    return undefined;
  return (error as Record<string, unknown>)[key];
}

function cloudinaryHttpStatus(error: unknown): number | undefined {
  for (const key of ["http_code", "statusCode", "status"]) {
    const value = recordValue(error, key);
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 100 &&
      value <= 599
    )
      return value;
  }
  return undefined;
}

function providerErrorCode(error: unknown): ProviderErrorCode | undefined {
  const code = recordValue(error, "code");
  return typeof code === "string" &&
    providerErrorCodes.has(code as ProviderErrorCode)
    ? (code as ProviderErrorCode)
    : undefined;
}

function errorCategory(
  stage: MenuImageFailureStage,
  status: number | undefined,
  code: ProviderErrorCode | undefined,
): MenuImageErrorCategory {
  if (stage === "missing_secure_url" || stage === "response_validation")
    return "response_invalid";
  if (code === "ETIMEDOUT" || code === "ECONNABORTED") return "timeout";
  if (code) return "network";
  if (status === 401 || status === 403) return "authentication";
  if (status === 420 || status === 429) return "rate_limit";
  if (status === 408 || status === 499 || status === 504) return "timeout";
  if (status === 400 || status === 404) return "invalid_request";
  if (status !== undefined && status >= 500) return "provider_error";
  return "unknown";
}

class CloudinaryUploadFailure extends Error {
  readonly cloudinaryHttpStatus?: number;
  readonly providerErrorCode?: ProviderErrorCode;

  constructor(
    readonly stage: MenuImageFailureStage,
    error?: unknown,
  ) {
    super("Cloudinary image upload failed");
    this.name = "CloudinaryUploadFailure";
    this.cloudinaryHttpStatus = cloudinaryHttpStatus(error);
    this.providerErrorCode = providerErrorCode(error);
  }
}

export function createCloudinaryUpload(
  input: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  },
  uploadStream?: CloudinaryUploadStreamFactory,
): CloudinaryUpload {
  cloudinary.config({
    cloud_name: input.cloudName,
    api_key: input.apiKey,
    api_secret: input.apiSecret,
    secure: true,
  });

  const createUploadStream: CloudinaryUploadStreamFactory =
    uploadStream ??
    ((options, callback) =>
      cloudinary.uploader.upload_stream(options, (error, result) =>
        callback(error, result),
      ));

  return ({ data, folder, publicId }) =>
    new Promise((resolve, reject) => {
      let settled = false;
      const fail = (stage: MenuImageFailureStage, error?: unknown) => {
        if (settled) return;
        settled = true;
        reject(new CloudinaryUploadFailure(stage, error));
      };

      try {
        const stream = createUploadStream(
          {
            resource_type: "image",
            type: "upload",
            folder,
            public_id: publicId,
            overwrite: false,
            unique_filename: false,
            use_filename: false,
          },
          (error, result) => {
            if (error) {
              fail("sdk_callback", error);
              return;
            }
            if (typeof result?.secure_url !== "string") {
              fail("missing_secure_url");
              return;
            }
            if (settled) return;
            settled = true;
            resolve(result.secure_url);
          },
        );
        stream.once("error", (error) => fail("stream_error", error));
        stream.end(data);
      } catch (error) {
        fail("stream_error", error);
      }
    });
}

export class CloudinaryMenuImageStorage implements MenuImageStorage {
  constructor(
    private readonly cloudName: string,
    private readonly folder: string,
    private readonly upload: CloudinaryUpload,
  ) {}

  async save(
    contentType: string | undefined,
    data: Buffer,
    diagnostics?: MenuImageDiagnostics,
  ): Promise<string> {
    validateImage(contentType, data);
    try {
      const reference = await this.upload({
        data,
        folder: this.folder,
        publicId: randomUUID(),
      });
      let url: URL;
      try {
        url = new URL(reference);
      } catch {
        throw new CloudinaryUploadFailure("response_validation");
      }
      if (
        url.protocol !== "https:" ||
        url.hostname !== "res.cloudinary.com" ||
        !url.pathname.startsWith(`/${this.cloudName}/image/upload/`)
      ) {
        throw new CloudinaryUploadFailure("response_validation");
      }
      return url.toString();
    } catch (error) {
      const failure =
        error instanceof CloudinaryUploadFailure
          ? error
          : new CloudinaryUploadFailure("sdk_callback", error);
      const diagnostic: MenuImageFailureDiagnostic = {
        requestId: diagnostics?.requestId ?? "unavailable",
        provider: "cloudinary",
        stage: failure.stage,
        imageMimeType: contentType ?? "unknown",
        imageByteCount: data.length,
        ...(failure.cloudinaryHttpStatus === undefined
          ? {}
          : { cloudinaryHttpStatus: failure.cloudinaryHttpStatus }),
        ...(failure.providerErrorCode === undefined
          ? {}
          : { providerErrorCode: failure.providerErrorCode }),
        errorCategory: errorCategory(
          failure.stage,
          failure.cloudinaryHttpStatus,
          failure.providerErrorCode,
        ),
      };
      try {
        diagnostics?.logFailure(diagnostic);
      } catch {
        // Diagnostic logging must never change the public upload failure.
      }
      throw new AppError(
        502,
        "IMAGE_STORAGE_FAILED",
        "The image could not be stored. Please try again.",
      );
    }
  }
}
