import { createPublicUrl, createVariantKey } from "@/modules/storage/keys";
import { resolveStorageProfile } from "@/modules/storage/registry";
import { ServiceError } from "@/shared/errors/service-error";

import type { ProcessingOutcome } from "../types";
import type { ImagePolicy, ImageVariantPolicy } from "@/config/policy";
import type { ImageOptimizationEngine } from "@/modules/images/types";
import type { StorageProfile } from "@/modules/storage/types";
import type { UploadJobsStore } from "@/modules/uploads/repository";
import type { ImageUploadJob, ImageVariant } from "@/modules/uploads/types";

const processingLeaseSeconds = 5 * 60;

function getObjectBody(object: R2ObjectBody | null): ReadableStream<Uint8Array> {
  if (!object?.body) {
    throw new ServiceError("ORIGINAL_NOT_FOUND", 503, "Original image is unavailable", true);
  }

  const body: unknown = object.body;
  return body as ReadableStream<Uint8Array>;
}

function normalizeProcessingError(error: unknown): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }

  return new ServiceError("IMAGE_PROCESSING_FAILED", 502, "Image processing failed", true);
}

export class ProcessingService {
  constructor(
    private readonly policy: ImagePolicy,
    private readonly repository: UploadJobsStore,
    private readonly storageRegistry: Record<string, StorageProfile>,
    private readonly engine: ImageOptimizationEngine,
  ) {}

  async process(uploadId: string, explicitRetry = false): Promise<ProcessingOutcome> {
    const existing = await this.repository.findById(uploadId);

    if (!existing || existing.status === "succeeded") {
      return { kind: "ignored", uploadId: existing?.id };
    }

    if (existing.status === "failed" && !explicitRetry) {
      return { kind: "ignored", uploadId };
    }

    if (existing.status === "awaiting_upload" || existing.status === "failed") {
      await this.repository.markQueued(existing.id);
    }

    const job = await this.repository.claim(uploadId, processingLeaseSeconds);

    if (!job) {
      return { kind: "ignored", uploadId };
    }

    try {
      const completed = await this.processClaimedJob(job);

      if (!completed) {
        return { kind: "ignored", uploadId: job.id };
      }

      return { kind: "completed", uploadId: job.id, attempt: job.attempts };
    } catch (error) {
      const serviceError = normalizeProcessingError(error);

      if (serviceError.retryable) {
        const updated = await this.repository.markTransientFailure(
          job.id,
          job.attempts,
          serviceError.code,
          serviceError.message,
        );

        if (!updated) {
          return { kind: "ignored", uploadId: job.id };
        }

        return {
          kind: "retry",
          uploadId: job.id,
          attempt: job.attempts,
          errorCode: serviceError.code,
          message: serviceError.message,
        };
      }

      const updated = await this.repository.markPermanentFailure(
        job.id,
        job.attempts,
        serviceError.code,
        serviceError.message,
      );

      if (!updated) {
        return { kind: "ignored", uploadId: job.id };
      }

      return {
        kind: "permanent_failure",
        uploadId: job.id,
        attempt: job.attempts,
        errorCode: serviceError.code,
      };
    }
  }

  async failExhausted(uploadId: string): Promise<void> {
    const job = await this.repository.findById(uploadId);

    if (!job || job.status === "succeeded") {
      return;
    }

    const updated = await this.repository.markExhausted(job.id);

    if (!updated) {
      return;
    }
  }

  private async processClaimedJob(job: ImageUploadJob): Promise<boolean> {
    const product = this.policy.products[job.productId];
    const preset = this.policy.presets[job.presetId];
    const variants: Record<string, ImageVariantPolicy> | undefined =
      preset?.version === job.presetVersion
        ? preset.variants
        : preset?.previousVersions?.[String(job.presetVersion)]?.variants;

    if (!product || !variants) {
      throw new ServiceError(
        "INTERNAL_SERVER_ERROR",
        500,
        "Upload references an unavailable product policy",
      );
    }

    const storage = resolveStorageProfile(this.storageRegistry, job.storageProfileId);
    const original = await storage.originals.binding.get(job.originalKey);
    const info = await this.engine.readInfo(getObjectBody(original), original?.size ?? 0);

    if (!product.acceptedInputFormats.some((format) => format === info.contentType)) {
      throw new ServiceError("UNSUPPORTED_MEDIA_TYPE", 415, "Uploaded image format is not allowed");
    }

    if (info.sizeBytes > product.maxUploadBytes) {
      throw new ServiceError("UPLOAD_TOO_LARGE", 413, "Uploaded image exceeds the size limit");
    }

    const outputVariants: ImageVariant[] = [];

    for (const [variantName, variantPolicy] of Object.entries(variants)) {
      const sourceObject = await storage.originals.binding.get(job.originalKey);
      const transformed = await this.engine.transform(getObjectBody(sourceObject), variantPolicy);
      const key = createVariantKey({
        productId: job.productId,
        uploadId: job.id,
        presetId: job.presetId,
        presetVersion: job.presetVersion,
        variantName,
        contentType: transformed.contentType,
      });

      try {
        await storage.outputs.binding.put(key, transformed.bytes, {
          httpMetadata: {
            contentType: transformed.contentType,
            cacheControl: "public, max-age=31536000, immutable",
          },
        });
      } catch {
        throw new ServiceError("STORAGE_FAILED", 503, "Failed to store image variant", true);
      }

      outputVariants.push({
        name: variantName,
        bucket: storage.outputs.bucketName,
        key,
        publicUrl: createPublicUrl(storage.outputs.publicBaseUrl, key),
        contentType: transformed.contentType,
        width: transformed.width,
        height: transformed.height,
        sizeBytes: transformed.bytes.byteLength,
      });
    }

    const completed = await this.repository.complete(job.id, job.attempts, info, outputVariants);

    if (!completed) {
      return false;
    }

    await this.applyRetention(job, storage);
    return true;
  }

  private async applyRetention(job: ImageUploadJob, storage: StorageProfile): Promise<void> {
    if (job.retainOriginal) {
      await this.repository.updateRetention(job.id, "retained").catch(() => undefined);
      return;
    }

    try {
      await storage.originals.binding.delete(job.originalKey);
      await this.repository.updateRetention(job.id, "deleted");
    } catch {
      await this.repository.updateRetention(job.id, "delete_failed").catch(() => undefined);
    }
  }
}
