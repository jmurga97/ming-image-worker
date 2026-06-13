import type { ImageVariantPolicy } from "@/config/policy";

export interface SourceImageInfo {
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface TransformedImage {
  bytes: ArrayBuffer;
  contentType: string;
  width: number;
  height: number;
}

export interface ImageOptimizationEngine {
  readInfo(stream: ReadableStream<Uint8Array>, sizeBytes: number): Promise<SourceImageInfo>;
  transform(
    stream: ReadableStream<Uint8Array>,
    policy: ImageVariantPolicy,
  ): Promise<TransformedImage>;
}
