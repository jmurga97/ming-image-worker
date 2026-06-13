import { createOriginalKey } from "@/modules/storage/keys";
import { resolveStorageProfile } from "@/modules/storage/registry";
import { createPresignedPutUrl } from "@/modules/storage/signing";
import { ServiceError } from "@/shared/errors/service-error";

import type { UploadJobsStore } from "../repository";
import type {
  CreateUploadInput,
  ImageUploadJob,
  ImageVariant,
  SignedUpload,
  UploadResult,
} from "../types";
import type { AcceptedImageMimeType, ImagePreset, ProductPolicy } from "@/config/policy";
import type { RuntimeConfig } from "@/config/runtime";
import type { QueueProducer } from "@/config/types";
import type { StorageProfile } from "@/modules/storage/types";

type SignUpload = typeof createPresignedPutUrl;

interface ResolvedPolicy {
  product: ProductPolicy;
  preset: ImagePreset;
  storage: StorageProfile;
}

function toFingerprintPayload(input: CreateUploadInput) {
  return {
    presetId: input.presetId,
    externalId: input.externalId ?? null,
    filename: input.filename,
    contentType: input.contentType.toLowerCase(),
    sizeBytes: input.sizeBytes,
    metadata: {
      requestId: input.metadata?.requestId ?? null,
      source: input.metadata?.source ?? null,
    },
  };
}

async function createFingerprint(input: CreateUploadInput): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(toFingerprintPayload(input)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function variantsToRecord(variants: ImageVariant[]): Record<string, ImageVariant> {
  return Object.fromEntries(variants.map((variant) => [variant.name, variant]));
}

function createManifest(job: ImageUploadJob, variants: ImageVariant[]): UploadResult["manifest"] {
  if (
    job.status !== "succeeded" ||
    !job.detectedContentType ||
    job.detectedSizeBytes === null ||
    job.sourceWidth === null ||
    job.sourceHeight === null
  ) {
    return null;
  }

  return {
    source: {
      contentType: job.detectedContentType,
      sizeBytes: job.detectedSizeBytes,
      width: job.sourceWidth,
      height: job.sourceHeight,
    },
    variants: variantsToRecord(variants),
  };
}

export class UploadsService {
  constructor(
    private readonly runtime: RuntimeConfig,
    private readonly repository: UploadJobsStore,
    private readonly storageRegistry: Record<string, StorageProfile>,
    private readonly queue: QueueProducer,
    private readonly signUpload: SignUpload = createPresignedPutUrl,
  ) {}

  async createUpload(
    productId: string,
    idempotencyKey: string,
    input: CreateUploadInput,
  ): Promise<SignedUpload> {
    const resolved = this.resolvePolicy(productId, input.presetId);
    this.validateInput(resolved.product, input);
    const fingerprint = await createFingerprint(input);
    const existing = await this.repository.findByIdempotencyKey(productId, idempotencyKey);

    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new ServiceError(
          "IDEMPOTENCY_CONFLICT",
          409,
          "Idempotency-Key was already used with a different request",
        );
      }

      return this.createSignedResponse(existing, resolved.product, resolved.storage);
    }

    const uploadId = crypto.randomUUID();
    const originalKey = createOriginalKey(productId, uploadId, input.filename);
    let created: ImageUploadJob;

    try {
      created = await this.repository.create({
        id: uploadId,
        productId,
        presetId: input.presetId,
        presetVersion: resolved.preset.version,
        storageProfileId: resolved.storage.id,
        idempotencyKey,
        requestFingerprint: fingerprint,
        externalId: input.externalId,
        originalBucket: resolved.storage.originals.bucketName,
        originalKey,
        originalFilename: input.filename,
        declaredContentType: input.contentType.toLowerCase() as AcceptedImageMimeType,
        declaredSizeBytes: input.sizeBytes,
        retainOriginal: resolved.product.retainOriginal,
        operationalMetadata: input.metadata,
      });
    } catch (error) {
      const concurrent = await this.repository.findByIdempotencyKey(productId, idempotencyKey);

      if (!concurrent) {
        throw error;
      }

      if (concurrent.requestFingerprint !== fingerprint) {
        throw new ServiceError(
          "IDEMPOTENCY_CONFLICT",
          409,
          "Idempotency-Key was already used with a different request",
        );
      }

      created = concurrent;
    }

    return this.createSignedResponse(created, resolved.product, resolved.storage);
  }

  async getUpload(productId: string, uploadId: string): Promise<UploadResult> {
    this.resolveProduct(productId);
    const job = await this.repository.findByProductAndId(uploadId, productId);

    if (!job) {
      throw new ServiceError("UPLOAD_NOT_FOUND", 404, "Upload job not found");
    }

    const variants = await this.repository.listVariants(job.id);

    return {
      uploadId: job.id,
      productId: job.productId,
      presetId: job.presetId,
      externalId: job.externalId ?? null,
      status: job.status,
      attempts: job.attempts,
      originalRetentionStatus: job.originalRetentionStatus,
      manifest: createManifest(job, variants),
      error:
        job.errorCode && job.errorMessage
          ? {
              code: job.errorCode,
              message: job.errorMessage,
              retryable: job.errorRetryable ?? false,
            }
          : null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    };
  }

  async retryUpload(productId: string, uploadId: string): Promise<UploadResult> {
    this.resolveProduct(productId);
    const job = await this.repository.findByProductAndId(uploadId, productId);

    if (!job) {
      throw new ServiceError("UPLOAD_NOT_FOUND", 404, "Upload job not found");
    }

    if (job.status !== "failed") {
      throw new ServiceError("UPLOAD_NOT_RETRYABLE", 409, "Only failed uploads can be retried");
    }

    const storage = resolveStorageProfile(this.storageRegistry, job.storageProfileId);
    const original = await storage.originals.binding.head(job.originalKey);

    if (!original) {
      throw new ServiceError("ORIGINAL_NOT_FOUND", 409, "Original image is no longer available");
    }

    await this.queue.send({
      kind: "retry",
      uploadId: job.id,
    });

    return this.getUpload(productId, uploadId);
  }

  private resolveProduct(productId: string): ProductPolicy {
    const product = this.runtime.policy.products[productId];

    if (!product) {
      throw new ServiceError("PRODUCT_NOT_ALLOWED", 403, "Product is not configured");
    }

    return product;
  }

  private resolvePolicy(productId: string, presetId: string): ResolvedPolicy {
    const product = this.resolveProduct(productId);

    if (!product.allowedPresets.includes(presetId)) {
      throw new ServiceError("PRESET_NOT_ALLOWED", 403, "Preset is not allowed for this product");
    }

    const preset = this.runtime.policy.presets[presetId];

    if (!preset) {
      throw new ServiceError("PRESET_NOT_ALLOWED", 403, "Preset is not configured");
    }

    return {
      product,
      preset,
      storage: resolveStorageProfile(this.storageRegistry, product.storageProfile),
    };
  }

  private validateInput(product: ProductPolicy, input: CreateUploadInput): void {
    const contentType = input.contentType.toLowerCase();

    if (!product.acceptedInputFormats.includes(contentType as AcceptedImageMimeType)) {
      throw new ServiceError(
        "UNSUPPORTED_MEDIA_TYPE",
        415,
        "Image format is not allowed for this product",
      );
    }

    if (input.sizeBytes > product.maxUploadBytes) {
      throw new ServiceError("UPLOAD_TOO_LARGE", 413, "Image exceeds the product upload limit");
    }
  }

  private async createSignedResponse(
    job: ImageUploadJob,
    product: ProductPolicy,
    storage: StorageProfile,
  ): Promise<SignedUpload> {
    if (job.status !== "awaiting_upload") {
      return {
        uploadId: job.id,
        status: job.status,
        upload: null,
      };
    }

    const signed = await this.signUpload({
      runtime: this.runtime,
      bucketName: storage.originals.bucketName,
      key: job.originalKey,
      contentType: job.declaredContentType,
      ttlSeconds: product.presignedUrlTtlSeconds,
    });

    return {
      uploadId: job.id,
      status: job.status,
      upload: {
        url: signed.url,
        expiresAt: signed.expiresAt,
        headers: {
          "Content-Type": job.declaredContentType,
        },
      },
    };
  }
}
