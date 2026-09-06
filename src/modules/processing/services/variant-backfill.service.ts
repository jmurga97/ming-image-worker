import { createPublicUrl, createVariantKey } from "@/modules/storage/keys";
import { resolveStorageProfile } from "@/modules/storage/registry";
import { ServiceError, toServiceError } from "@/shared/errors/service-error";

import type { ImagePolicy, ImageVariantPolicy } from "@/config/policy";
import type { ImageOptimizationEngine } from "@/modules/images/types";
import type { StorageProfile } from "@/modules/storage/types";
import type { ImageVariantBackfillStore } from "@/modules/uploads/repository";
import type { ImageUploadJob, ImageVariant } from "@/modules/uploads/types";

const MAX_BATCH_SIZE = 20;

export interface VariantBackfillInput {
  cursor: string | null;
  limit: number;
  presetId: "qmenut-menu-image" | "qmenut-branch-photo";
  productId: "qmenut";
}

export interface VariantBackfillResult {
  failed: number;
  failures: Array<{ uploadId: string; code: string; retryable: boolean }>;
  manifests: Array<{ uploadId: string; manifest: { variants: Record<string, ImageVariant> } }>;
  nextCursor: string | null;
  processed: number;
  succeeded: number;
}

function getObjectBody(object: R2ObjectBody | null): ReadableStream<Uint8Array> {
  if (!object?.body) {
    throw new ServiceError("ORIGINAL_NOT_FOUND", "Main image variant is unavailable", true);
  }

  return object.body as ReadableStream<Uint8Array>;
}

function encodeCursor(job: ImageUploadJob): string {
  return encodeURIComponent(`${job.createdAt}|${job.id}`);
}

export class VariantBackfillService {
  constructor(
    private readonly policy: ImagePolicy,
    private readonly repository: ImageVariantBackfillStore,
    private readonly storageRegistry: Record<string, StorageProfile>,
    private readonly engine: ImageOptimizationEngine,
  ) {}

  async run(input: VariantBackfillInput): Promise<VariantBackfillResult> {
    const product = this.policy.products[input.productId];
    const preset = this.policy.presets[input.presetId];

    if (!product || !product.allowedPresets.includes(input.presetId) || !preset) {
      throw new ServiceError("PRESET_NOT_ALLOWED", "Preset is not configured for this product");
    }

    const page = await this.repository.listSucceededForVariantBackfill(
      input.productId,
      input.presetId,
      input.cursor,
      Math.min(Math.max(input.limit, 1), MAX_BATCH_SIZE),
    );
    let succeeded = 0;
    const failures: VariantBackfillResult["failures"] = [];
    const manifests: VariantBackfillResult["manifests"] = [];

    for (const job of page.jobs) {
      try {
        const variants = await this.backfillJob({ job, presetVariants: preset.variants });
        manifests.push({
          uploadId: job.id,
          manifest: {
            variants: Object.fromEntries(variants.map((variant) => [variant.name, variant])),
          },
        });
        succeeded += 1;
      } catch (error) {
        const failure = toServiceError(error);
        failures.push({ uploadId: job.id, code: failure.code, retryable: failure.retryable });
      }
    }

    return {
      failed: failures.length,
      failures,
      manifests,
      nextCursor:
        page.hasMore && page.jobs.length > 0
          ? encodeCursor(page.jobs.at(-1) as ImageUploadJob)
          : null,
      processed: page.jobs.length,
      succeeded,
    };
  }

  private async backfillJob({
    job,
    presetVariants,
  }: {
    job: ImageUploadJob;
    presetVariants: Record<string, ImageVariantPolicy>;
  }): Promise<ImageVariant[]> {
    const existingVariants = await this.repository.listVariants(job.id);
    const existingNames = new Set(existingVariants.map((variant) => variant.name));
    const pendingPolicies = Object.entries(presetVariants).filter(
      ([name]) => name !== "main" && !existingNames.has(name),
    );

    if (pendingPolicies.length === 0) {
      return existingVariants;
    }

    const main = existingVariants.find((variant) => variant.name === "main");
    if (!main) {
      throw new ServiceError("ORIGINAL_NOT_FOUND", "Main image variant is unavailable", true);
    }

    const storage = resolveStorageProfile(this.storageRegistry, job.storageProfileId);
    const outputVariants: ImageVariant[] = [];

    for (const [variantName, variantPolicy] of pendingPolicies) {
      const sourceObject = await storage.outputs.binding.get(main.key);
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
          onlyIf: { etagDoesNotMatch: "*" },
          httpMetadata: {
            contentType: transformed.contentType,
            cacheControl: "public, max-age=31536000, immutable",
          },
        });
      } catch {
        throw new ServiceError("STORAGE_FAILED", "Failed to store image variant", true);
      }

      const variant: ImageVariant = {
        name: variantName,
        bucket: storage.outputs.bucketName,
        key,
        publicUrl: createPublicUrl(storage.outputs.publicBaseUrl, key),
        contentType: transformed.contentType,
        width: transformed.width,
        height: transformed.height,
        sizeBytes: transformed.bytes.byteLength,
      };
      // Keep completed work resumable if a later transform in the job fails.
      await this.repository.insertVariantsIfMissing(job.id, [variant]);
      outputVariants.push(variant);
    }

    return [...existingVariants, ...outputVariants];
  }
}
