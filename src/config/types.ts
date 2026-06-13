import type { RuntimeConfig } from "./runtime";
import type { OpenAPIHono } from "@hono/zod-openapi";

export interface ImageInfoResponse {
  format: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad" | "squeeze";
}

export interface ImageOutputOptions {
  format: "image/webp";
  quality?: number;
  anim?: boolean;
}

export interface ImageTransformationResult {
  response(): Response;
  contentType(): string;
}

export interface ImageTransformer {
  transform(options: ImageTransformOptions): ImageTransformer;
  output(options: ImageOutputOptions): Promise<ImageTransformationResult>;
}

export interface ImagesBinding {
  info(stream: ReadableStream<Uint8Array>): Promise<ImageInfoResponse>;
  input(stream: ReadableStream<Uint8Array>): ImageTransformer;
}

export interface ProcessingQueueMessage {
  kind: "retry";
  uploadId: string;
}

export interface QueueProducer {
  send(message: ProcessingQueueMessage): Promise<void>;
}

export interface Bindings {
  DB: D1Database;
  IMAGES: ImagesBinding;
  IMAGE_PROCESSING_QUEUE: QueueProducer;
  RONCALPHOTO_ORIGINALS_BUCKET: R2Bucket;
  RONCALPHOTO_MEDIA_BUCKET: R2Bucket;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  RONCALPHOTO_ORIGINALS_BUCKET_NAME: string;
  RONCALPHOTO_MEDIA_BUCKET_NAME: string;
  RONCALPHOTO_PUBLIC_MEDIA_BASE_URL: string;
  PROCESSING_QUEUE_NAME: string;
  PROCESSING_DLQ_NAME: string;
}

export type AppBindings = {
  Bindings: Bindings;
  Variables: {
    runtimeConfig: RuntimeConfig;
  };
};

export type App = OpenAPIHono<AppBindings>;
