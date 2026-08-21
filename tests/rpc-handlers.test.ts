import { describe, expect, mock, test } from "bun:test";

import { handleCreateUpload, handleGetUpload, handleRetryUpload } from "@/rpc/handlers";
import { ServiceError } from "@/shared/errors/service-error";

import type { SignedUpload, UploadResult } from "@/modules/uploads/types";
import type { ImageWorkerRpcService } from "@/rpc/handlers";

const validCreateInput = {
  productId: "qmenut",
  idempotencyKey: "test-idempotency-key",
  upload: {
    presetId: "qmenut-logo",
    externalId: "qmenut:branchLogo:abc",
    filename: "logo.png",
    contentType: "image/png",
    sizeBytes: 1024,
    metadata: { source: "qmenut-admin" },
  },
};

const uploadId = "c45de47d-53a3-4df1-a2b0-928879bbc334";

const signedUpload: SignedUpload = {
  uploadId,
  status: "awaiting_upload",
  upload: {
    url: "https://account-id.r2.cloudflarestorage.com/bucket/key",
    expiresAt: "2026-06-12T12:15:00.000Z",
    headers: { "Content-Type": "image/png" },
  },
};

const uploadResult: UploadResult = {
  uploadId,
  productId: "qmenut",
  presetId: "qmenut-logo",
  externalId: null,
  status: "succeeded",
  attempts: 1,
  originalRetentionStatus: "deleted",
  manifest: null,
  error: null,
  createdAt: "2026-06-12T12:00:00.000Z",
  updatedAt: "2026-06-12T12:01:00.000Z",
  completedAt: "2026-06-12T12:01:00.000Z",
};

interface ServiceBehavior {
  createUpload?: () => Promise<SignedUpload>;
  getUpload?: () => Promise<UploadResult>;
  retryUpload?: () => Promise<UploadResult>;
}

function createService(behavior: ServiceBehavior = {}) {
  const createUpload = mock(behavior.createUpload ?? (() => Promise.resolve(signedUpload)));
  const getUpload = mock(behavior.getUpload ?? (() => Promise.resolve(uploadResult)));
  const retryUpload = mock(behavior.retryUpload ?? (() => Promise.resolve(uploadResult)));
  const service: ImageWorkerRpcService = { createUpload, getUpload, retryUpload };

  return { service, createUpload, getUpload, retryUpload };
}

function rejectWith(error: ServiceError) {
  return () => Promise.reject(error);
}

describe("handleCreateUpload", () => {
  test("returns a success envelope with the signed upload", async () => {
    const { service, createUpload } = createService();
    const response = await handleCreateUpload(service, validCreateInput);

    expect(response.success).toBe(true);
    if (response.success) expect(response.data).toEqual(signedUpload);
    expect(createUpload).toHaveBeenCalledWith(
      "qmenut",
      "test-idempotency-key",
      validCreateInput.upload,
    );
  });

  test("rejects an unknown product id without calling the service", async () => {
    const { service, createUpload } = createService();
    const response = await handleCreateUpload(service, {
      ...validCreateInput,
      productId: "NOT_A_VALID_ID",
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("INVALID_BODY");
      expect(response.error.retryable).toBe(false);
    }
    expect(createUpload).not.toHaveBeenCalled();
  });

  test("rejects a short idempotency key", async () => {
    const { service } = createService();
    const response = await handleCreateUpload(service, {
      ...validCreateInput,
      idempotencyKey: "short",
    });

    expect(response.success).toBe(false);
  });

  test("rejects unexpected top-level fields", async () => {
    const { service, createUpload } = createService();
    const response = await handleCreateUpload(service, {
      ...validCreateInput,
      bucketName: "arbitrary-bucket",
    });

    expect(response.success).toBe(false);
    expect(createUpload).not.toHaveBeenCalled();
  });

  test("maps service errors into the error envelope", async () => {
    const { service } = createService({
      createUpload: rejectWith(
        new ServiceError(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency-Key was already used with a different request",
        ),
      ),
    });
    const response = await handleCreateUpload(service, validCreateInput);

    expect(response).toEqual({
      success: false,
      error: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotency-Key was already used with a different request",
        retryable: false,
      },
    });
  });
});

describe("handleGetUpload", () => {
  test("returns a success envelope with the upload result", async () => {
    const { service, getUpload } = createService();
    const response = await handleGetUpload(service, { productId: "qmenut", uploadId });

    expect(response.success).toBe(true);
    if (response.success) expect(response.data).toEqual(uploadResult);
    expect(getUpload).toHaveBeenCalledWith("qmenut", uploadId);
  });

  test("rejects a non-uuid upload id", async () => {
    const { service, getUpload } = createService();
    const response = await handleGetUpload(service, { productId: "qmenut", uploadId: "abc" });

    expect(response.success).toBe(false);
    expect(getUpload).not.toHaveBeenCalled();
  });

  test("marks retryable service errors as retryable", async () => {
    const { service } = createService({
      getUpload: rejectWith(
        new ServiceError("STORAGE_FAILED", "Failed to store image variant", true),
      ),
    });
    const response = await handleGetUpload(service, { productId: "qmenut", uploadId });

    expect(response).toEqual({
      success: false,
      error: { code: "STORAGE_FAILED", message: "Failed to store image variant", retryable: true },
    });
  });
});

describe("handleRetryUpload", () => {
  test("returns a success envelope with the upload result", async () => {
    const { service, retryUpload } = createService();
    const response = await handleRetryUpload(service, { productId: "roncalphoto", uploadId });

    expect(response.success).toBe(true);
    if (response.success) expect(response.data).toEqual(uploadResult);
    expect(retryUpload).toHaveBeenCalledWith("roncalphoto", uploadId);
  });

  test("masks unexpected failures behind a generic internal error", async () => {
    const consoleError = mock(() => undefined);
    const original = console.error;
    console.error = consoleError;

    try {
      const { service } = createService({
        retryUpload: () => Promise.reject(new Error("database exploded")),
      });
      const response = await handleRetryUpload(service, { productId: "roncalphoto", uploadId });

      expect(response).toEqual({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
          retryable: false,
        },
      });
      expect(consoleError).toHaveBeenCalled();
    } finally {
      console.error = original;
    }
  });
});
