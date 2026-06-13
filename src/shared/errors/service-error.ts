export type ServiceErrorCode =
  | "INVALID_BODY"
  | "INVALID_JSON"
  | "NOT_FOUND"
  | "PRODUCT_NOT_ALLOWED"
  | "PRESET_NOT_ALLOWED"
  | "UPLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "IDEMPOTENCY_CONFLICT"
  | "UPLOAD_NOT_FOUND"
  | "UPLOAD_NOT_RETRYABLE"
  | "ORIGINAL_NOT_FOUND"
  | "INVALID_IMAGE"
  | "IMAGE_PROCESSING_FAILED"
  | "PROCESSING_RETRIES_EXHAUSTED"
  | "STORAGE_FAILED"
  | "INTERNAL_SERVER_ERROR";

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    public readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 500 | 502 | 503,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function toServiceError(error: unknown): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }

  return new ServiceError("INTERNAL_SERVER_ERROR", 500, "Internal server error");
}
