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
      throw new ServiceError("INVALID_IMAGE", 415, "The uploaded object is not a valid image");
    }

    if (!info.width || !info.height) {
      throw new ServiceError("INVALID_IMAGE", 415, "Image dimensions could not be detected");
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
    const result = await this.images
      .input(stream)
      .transform({
        width: policy.width,
        fit: policy.fit,
      })
      .output({
        format: policy.format,
        quality: policy.quality,
        anim: false,
      });
    const response = result.response();

    if (!response.ok) {
      throw new ServiceError("IMAGE_PROCESSING_FAILED", 502, "Image transformation failed", true);
    }

    const bytes = await response.arrayBuffer();
    const info = await this.readInfo(toStream(bytes), bytes.byteLength);

    return {
      bytes,
      contentType: response.headers.get("Content-Type") ?? result.contentType() ?? policy.format,
      width: info.width,
      height: info.height,
    };
  }
}
