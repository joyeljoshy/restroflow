import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

export interface MenuImageStorage {
  save(contentType: string | undefined, data: Buffer): Promise<string>;
}

export class LocalMenuImageStorage implements MenuImageStorage {
  constructor(private readonly directory: string) {}

  async save(contentType: string | undefined, data: Buffer): Promise<string> {
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
    const fileName = `${randomUUID()}${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(path.join(this.directory, fileName), data, { flag: "wx" });
    return `/uploads/menu/${fileName}`;
  }
}
