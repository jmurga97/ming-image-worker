import type { AcceptedImageMimeType } from "@/config/policy";

export const uploadStatuses = [
  "awaiting_upload",
  "queued",
  "processing",
  "succeeded",
  "failed",
] as const;

export type UploadStatus = (typeof uploadStatuses)[number];
export type OriginalRetentionStatus = "pending" | "retained" | "deleted" | "delete_failed";

export interface OperationalMetadata {
  requestId?: string;
  source?: string;
}

export interface CreateUploadInput {
  presetId: string;
  externalId?: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  metadata?: OperationalMetadata;
}

export interface CreateUploadRecord {
  id: string;
  productId: string;
  presetId: string;
  presetVersion: number;
  storageProfileId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  externalId?: string;
  originalBucket: string;
  originalKey: string;
  originalFilename: string;
  declaredContentType: AcceptedImageMimeType;
  declaredSizeBytes: number;
  retainOriginal: boolean;
  operationalMetadata?: OperationalMetadata;
}

export interface ImageUploadJob extends CreateUploadRecord {
  detectedContentType: string | null;
  detectedSizeBytes: number | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  status: UploadStatus;
  leaseExpiresAt: string | null;
  attempts: number;
  originalRetentionStatus: OriginalRetentionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  errorRetryable: boolean | null;
  createdAt: string;
  updatedAt: string;
  queuedAt: string | null;
  processingStartedAt: string | null;
  completedAt: string | null;
}

export interface ImageVariant {
  name: string;
  bucket: string;
  key: string;
  publicUrl: string | null;
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface UploadManifest {
  source: {
    contentType: string;
    width: number;
    height: number;
    sizeBytes: number;
  };
  variants: Record<string, ImageVariant>;
}

export interface UploadResult {
  uploadId: string;
  productId: string;
  presetId: string;
  externalId: string | null;
  status: UploadStatus;
  attempts: number;
  originalRetentionStatus: OriginalRetentionStatus;
  manifest: UploadManifest | null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface SignedUpload {
  uploadId: string;
  status: UploadStatus;
  upload: {
    url: string;
    expiresAt: string;
    headers: {
      "Content-Type": AcceptedImageMimeType;
    };
  } | null;
}

export interface ProcessingSource {
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
}
