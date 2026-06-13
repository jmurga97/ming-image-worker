import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const imageUploadJobs = sqliteTable(
  "image_upload_jobs",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    presetId: text("preset_id").notNull(),
    presetVersion: integer("preset_version").notNull(),
    storageProfileId: text("storage_profile_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    externalId: text("external_id"),
    originalBucket: text("original_bucket").notNull(),
    originalKey: text("original_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    declaredContentType: text("declared_content_type").notNull(),
    declaredSizeBytes: integer("declared_size_bytes").notNull(),
    detectedContentType: text("detected_content_type"),
    detectedSizeBytes: integer("detected_size_bytes"),
    sourceWidth: integer("source_width"),
    sourceHeight: integer("source_height"),
    status: text("status", {
      enum: ["awaiting_upload", "queued", "processing", "succeeded", "failed"],
    })
      .notNull()
      .default("awaiting_upload"),
    leaseExpiresAt: text("lease_expires_at"),
    attempts: integer("attempts").notNull().default(0),
    retainOriginal: integer("retain_original", { mode: "boolean" }).notNull().default(true),
    originalRetentionStatus: text("original_retention_status", {
      enum: ["pending", "retained", "deleted", "delete_failed"],
    })
      .notNull()
      .default("pending"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    errorRetryable: integer("error_retryable", { mode: "boolean" }),
    operationalMetadata: text("operational_metadata"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    queuedAt: text("queued_at"),
    processingStartedAt: text("processing_started_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("image_upload_jobs_product_idempotency_unique").on(
      table.productId,
      table.idempotencyKey,
    ),
    uniqueIndex("image_upload_jobs_original_object_unique").on(
      table.originalBucket,
      table.originalKey,
    ),
    index("image_upload_jobs_product_status_idx").on(table.productId, table.status),
  ],
);

export const imageVariants = sqliteTable(
  "image_variants",
  {
    id: text("id").primaryKey(),
    uploadId: text("upload_id")
      .notNull()
      .references(() => imageUploadJobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    bucket: text("bucket").notNull(),
    key: text("key").notNull(),
    publicUrl: text("public_url"),
    contentType: text("content_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("image_variants_upload_name_unique").on(table.uploadId, table.name),
    uniqueIndex("image_variants_bucket_key_unique").on(table.bucket, table.key),
    index("image_variants_upload_idx").on(table.uploadId),
  ],
);
