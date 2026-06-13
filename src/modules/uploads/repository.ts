import type {
  CreateUploadRecord,
  ImageUploadJob,
  ImageVariant,
  OriginalRetentionStatus,
  ProcessingSource,
} from "./types";
import type { ServiceErrorCode } from "@/shared/errors/service-error";

interface UploadJobRow {
  id: string;
  product_id: string;
  preset_id: string;
  preset_version: number;
  storage_profile_id: string;
  idempotency_key: string;
  request_fingerprint: string;
  external_id: string | null;
  original_bucket: string;
  original_key: string;
  original_filename: string;
  declared_content_type: string;
  declared_size_bytes: number;
  detected_content_type: string | null;
  detected_size_bytes: number | null;
  source_width: number | null;
  source_height: number | null;
  status: ImageUploadJob["status"];
  lease_expires_at: string | null;
  attempts: number;
  retain_original: number;
  original_retention_status: OriginalRetentionStatus;
  error_code: string | null;
  error_message: string | null;
  error_retryable: number | null;
  operational_metadata: string | null;
  created_at: string;
  updated_at: string;
  queued_at: string | null;
  processing_started_at: string | null;
  completed_at: string | null;
}

interface VariantRow {
  name: string;
  bucket: string;
  key: string;
  public_url: string | null;
  content_type: string;
  width: number;
  height: number;
  size_bytes: number;
}

export interface UploadJobsStore {
  create(record: CreateUploadRecord): Promise<ImageUploadJob>;
  findById(uploadId: string): Promise<ImageUploadJob | null>;
  findByProductAndId(uploadId: string, productId: string): Promise<ImageUploadJob | null>;
  findByIdempotencyKey(productId: string, key: string): Promise<ImageUploadJob | null>;
  findByOriginalObject(bucket: string, key: string): Promise<ImageUploadJob | null>;
  listVariants(uploadId: string): Promise<ImageVariant[]>;
  markQueued(uploadId: string): Promise<void>;
  claim(uploadId: string, leaseSeconds: number): Promise<ImageUploadJob | null>;
  markTransientFailure(
    uploadId: string,
    attempt: number,
    code: ServiceErrorCode,
    message: string,
  ): Promise<boolean>;
  markPermanentFailure(
    uploadId: string,
    attempt: number,
    code: ServiceErrorCode,
    message: string,
  ): Promise<boolean>;
  markExhausted(uploadId: string): Promise<boolean>;
  complete(
    uploadId: string,
    attempt: number,
    source: ProcessingSource,
    variants: ImageVariant[],
  ): Promise<boolean>;
  updateRetention(uploadId: string, status: OriginalRetentionStatus): Promise<void>;
}

function parseMetadata(value: string | null): CreateUploadRecord["operationalMetadata"] {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as CreateUploadRecord["operationalMetadata"];
  } catch {
    return undefined;
  }
}

function toJob(row: UploadJobRow): ImageUploadJob {
  return {
    id: row.id,
    productId: row.product_id,
    presetId: row.preset_id,
    presetVersion: row.preset_version,
    storageProfileId: row.storage_profile_id,
    idempotencyKey: row.idempotency_key,
    requestFingerprint: row.request_fingerprint,
    externalId: row.external_id ?? undefined,
    originalBucket: row.original_bucket,
    originalKey: row.original_key,
    originalFilename: row.original_filename,
    declaredContentType: row.declared_content_type as ImageUploadJob["declaredContentType"],
    declaredSizeBytes: row.declared_size_bytes,
    detectedContentType: row.detected_content_type,
    detectedSizeBytes: row.detected_size_bytes,
    sourceWidth: row.source_width,
    sourceHeight: row.source_height,
    status: row.status,
    leaseExpiresAt: row.lease_expires_at,
    attempts: row.attempts,
    retainOriginal: row.retain_original === 1,
    originalRetentionStatus: row.original_retention_status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    errorRetryable: row.error_retryable === null ? null : row.error_retryable === 1,
    operationalMetadata: parseMetadata(row.operational_metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    queuedAt: row.queued_at,
    processingStartedAt: row.processing_started_at,
    completedAt: row.completed_at,
  };
}

function toVariant(row: VariantRow): ImageVariant {
  return {
    name: row.name,
    bucket: row.bucket,
    key: row.key,
    publicUrl: row.public_url,
    contentType: row.content_type,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
  };
}

export class UploadJobsRepository implements UploadJobsStore {
  constructor(private readonly db: D1Database) {}

  async create(record: CreateUploadRecord): Promise<ImageUploadJob> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO image_upload_jobs (
          id, product_id, preset_id, preset_version, storage_profile_id,
          idempotency_key, request_fingerprint, external_id,
          original_bucket, original_key, original_filename,
          declared_content_type, declared_size_bytes, retain_original,
          operational_metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.productId,
        record.presetId,
        record.presetVersion,
        record.storageProfileId,
        record.idempotencyKey,
        record.requestFingerprint,
        record.externalId ?? null,
        record.originalBucket,
        record.originalKey,
        record.originalFilename,
        record.declaredContentType,
        record.declaredSizeBytes,
        record.retainOriginal ? 1 : 0,
        record.operationalMetadata ? JSON.stringify(record.operationalMetadata) : null,
        now,
        now,
      )
      .run();

    const created = await this.findById(record.id);

    if (!created) {
      throw new Error("Created upload job could not be loaded");
    }

    return created;
  }

  async findById(uploadId: string): Promise<ImageUploadJob | null> {
    const row = await this.db
      .prepare("SELECT * FROM image_upload_jobs WHERE id = ? LIMIT 1")
      .bind(uploadId)
      .first<UploadJobRow>();

    return row ? toJob(row) : null;
  }

  async findByProductAndId(uploadId: string, productId: string): Promise<ImageUploadJob | null> {
    const row = await this.db
      .prepare("SELECT * FROM image_upload_jobs WHERE id = ? AND product_id = ? LIMIT 1")
      .bind(uploadId, productId)
      .first<UploadJobRow>();

    return row ? toJob(row) : null;
  }

  async findByIdempotencyKey(productId: string, key: string): Promise<ImageUploadJob | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM image_upload_jobs WHERE product_id = ? AND idempotency_key = ? LIMIT 1",
      )
      .bind(productId, key)
      .first<UploadJobRow>();

    return row ? toJob(row) : null;
  }

  async findByOriginalObject(bucket: string, key: string): Promise<ImageUploadJob | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM image_upload_jobs WHERE original_bucket = ? AND original_key = ? LIMIT 1",
      )
      .bind(bucket, key)
      .first<UploadJobRow>();

    return row ? toJob(row) : null;
  }

  async listVariants(uploadId: string): Promise<ImageVariant[]> {
    const result = await this.db
      .prepare(
        `SELECT name, bucket, key, public_url, content_type, width, height, size_bytes
         FROM image_variants WHERE upload_id = ? ORDER BY name`,
      )
      .bind(uploadId)
      .all<VariantRow>();

    return result.results.map(toVariant);
  }

  async markQueued(uploadId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE image_upload_jobs
         SET status = 'queued', queued_at = COALESCE(queued_at, ?), updated_at = ?,
             error_code = NULL, error_message = NULL, error_retryable = NULL
         WHERE id = ? AND status IN ('awaiting_upload', 'failed')`,
      )
      .bind(now, now, uploadId)
      .run();
  }

  async claim(uploadId: string, leaseSeconds: number): Promise<ImageUploadJob | null> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
    const row = await this.db
      .prepare(
        `UPDATE image_upload_jobs
         SET status = 'processing', attempts = attempts + 1, lease_expires_at = ?,
             processing_started_at = ?, updated_at = ?
         WHERE id = ?
           AND (
             status = 'queued'
             OR (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?)
           )
         RETURNING *`,
      )
      .bind(leaseExpiresAt, now.toISOString(), now.toISOString(), uploadId, now.toISOString())
      .first<UploadJobRow>();

    return row ? toJob(row) : null;
  }

  async markTransientFailure(
    uploadId: string,
    attempt: number,
    code: ServiceErrorCode,
    message: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        `UPDATE image_upload_jobs
         SET status = 'queued', lease_expires_at = NULL, error_code = ?,
             error_message = ?, error_retryable = 1, updated_at = ?
         WHERE id = ? AND status = 'processing' AND attempts = ?`,
      )
      .bind(code, message, new Date().toISOString(), uploadId, attempt)
      .run();

    return result.meta.changes === 1;
  }

  async markPermanentFailure(
    uploadId: string,
    attempt: number,
    code: ServiceErrorCode,
    message: string,
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db
      .prepare(
        `UPDATE image_upload_jobs
         SET status = 'failed', lease_expires_at = NULL, error_code = ?,
             error_message = ?, error_retryable = 0, updated_at = ?, completed_at = ?
         WHERE id = ? AND status = 'processing' AND attempts = ?`,
      )
      .bind(code, message, now, now, uploadId, attempt)
      .run();

    return result.meta.changes === 1;
  }

  async markExhausted(uploadId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db
      .prepare(
        `UPDATE image_upload_jobs
         SET status = 'failed', lease_expires_at = NULL,
             error_code = 'PROCESSING_RETRIES_EXHAUSTED',
             error_message = 'Image processing retries were exhausted',
             error_retryable = 0, updated_at = ?, completed_at = ?
         WHERE id = ? AND status = 'queued'`,
      )
      .bind(now, now, uploadId)
      .run();

    return result.meta.changes === 1;
  }

  async complete(
    uploadId: string,
    attempt: number,
    source: ProcessingSource,
    variants: ImageVariant[],
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `DELETE FROM image_variants
           WHERE upload_id = ? AND EXISTS (
             SELECT 1 FROM image_upload_jobs
             WHERE id = ? AND status = 'processing' AND attempts = ?
           )`,
        )
        .bind(uploadId, uploadId, attempt),
      ...variants.map((variant) =>
        this.db
          .prepare(
            `INSERT INTO image_variants (
              id, upload_id, name, bucket, key, public_url, content_type,
              width, height, size_bytes, created_at
            )
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (
              SELECT 1 FROM image_upload_jobs
              WHERE id = ? AND status = 'processing' AND attempts = ?
            )`,
          )
          .bind(
            crypto.randomUUID(),
            uploadId,
            variant.name,
            variant.bucket,
            variant.key,
            variant.publicUrl,
            variant.contentType,
            variant.width,
            variant.height,
            variant.sizeBytes,
            now,
            uploadId,
            attempt,
          ),
      ),
      this.db
        .prepare(
          `UPDATE image_upload_jobs
           SET status = 'succeeded', detected_content_type = ?, detected_size_bytes = ?,
               source_width = ?, source_height = ?, lease_expires_at = NULL,
               error_code = NULL, error_message = NULL, error_retryable = NULL,
               updated_at = ?, completed_at = ?
           WHERE id = ? AND status = 'processing' AND attempts = ?`,
        )
        .bind(
          source.contentType,
          source.sizeBytes,
          source.width,
          source.height,
          now,
          now,
          uploadId,
          attempt,
        ),
    ];

    const results = await this.db.batch(statements);
    return results.at(-1)?.meta.changes === 1;
  }

  async updateRetention(uploadId: string, status: OriginalRetentionStatus): Promise<void> {
    await this.db
      .prepare(
        `UPDATE image_upload_jobs
         SET original_retention_status = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(status, new Date().toISOString(), uploadId)
      .run();
  }
}
