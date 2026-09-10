import { ServiceError } from "@/shared/errors/service-error";

import type { ImageOptimizationEngine, SourceImageInfo, TransformedImage } from "./types";
import type { ImageVariantPolicy } from "@/config/policy";
import type { ImagesBinding } from "@/config/types";

const formatAliases: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const ICO_CONTENT_TYPE = "image/x-icon";
const ICO_DIRECTORY_BYTES = 22; // ICONDIR (6) + one ICONDIRENTRY (16)

/**
 * Wraps raw PNG bytes into a single-entry ICO container (PNG-in-ICO), the format
 * every browser and Windows version since Vista accepts for favicon.ico.
 */
export function wrapPngInIco(png: ArrayBuffer, width: number, height: number): ArrayBuffer {
  const pngSize = png.byteLength;
  const header = new DataView(new ArrayBuffer(ICO_DIRECTORY_BYTES));
  header.setUint16(0, 0, true); // reserved
  header.setUint16(2, 1, true); // resource type: icon
  header.setUint16(4, 1, true); // image count
  header.setUint8(6, width >= 256 ? 0 : width); // 0 means 256
  header.setUint8(7, height >= 256 ? 0 : height);
  header.setUint8(8, 0); // palette color count
  header.setUint8(9, 0); // reserved
  header.setUint16(10, 1, true); // color planes
  header.setUint16(12, 32, true); // bits per pixel
  header.setUint32(14, pngSize, true);
  header.setUint32(18, ICO_DIRECTORY_BYTES, true); // image data offset

  const ico = new Uint8Array(ICO_DIRECTORY_BYTES + pngSize);
  ico.set(new Uint8Array(header.buffer), 0);
  ico.set(new Uint8Array(png), ICO_DIRECTORY_BYTES);
  return ico.buffer;
}

function normalizeContentType(format: string): string {
  const normalized = format.trim().toLowerCase();
  return formatAliases[normalized] ?? normalized;
}

function toStream(bytes: ArrayBuffer): ReadableStream<Uint8Array> {
  return new Blob([bytes]).stream();
}

export class CloudflareImagesEngine implements ImageOptimizationEngine {
  constructor(private readonly images: ImagesBinding) {}

  async readInfo(stream: ReadableStream<Uint8Array>, sizeBytes: number): Promise<SourceImageInfo> {
    let info;

    try {
      info = await this.images.info(stream);
    } catch {
      throw new ServiceError("INVALID_IMAGE", "The uploaded object is not a valid image");
    }

    if (!info.width || !info.height) {
      throw new ServiceError("INVALID_IMAGE", "Image dimensions could not be detected");
    }

    return {
      contentType: normalizeContentType(info.format),
      sizeBytes,
      width: info.width,
      height: info.height,
    };
  }

  async transform(
    stream: ReadableStream<Uint8Array>,
    policy: ImageVariantPolicy,
  ): Promise<TransformedImage> {
    const wantsIco = policy.format === ICO_CONTENT_TYPE;
    const outputFormat: "image/webp" | "image/png" = wantsIco ? "image/png" : "image/webp";
    const result = await this.images
      .input(stream)
      .transform({
        width: policy.width,
        ...(policy.height === undefined ? {} : { height: policy.height }),
        fit: policy.fit,
      })
      .output({
        format: outputFormat,
        ...(wantsIco ? {} : { quality: policy.quality }),
        anim: false,
      });
    const response = result.response();

    if (!response.ok) {
      throw new ServiceError("IMAGE_PROCESSING_FAILED", "Image transformation failed", true);
    }

    const bytes = await response.arrayBuffer();
    const info = await this.readInfo(toStream(bytes), bytes.byteLength);

    if (wantsIco) {
      return {
        bytes: wrapPngInIco(bytes, info.width, info.height),
        contentType: ICO_CONTENT_TYPE,
        width: info.width,
        height: info.height,
      };
    }

    return {
      bytes,
      contentType: response.headers.get("Content-Type") ?? result.contentType() ?? policy.format,
      width: info.width,
      height: info.height,
    };
  }
}
