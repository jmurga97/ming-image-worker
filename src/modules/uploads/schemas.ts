import { z } from "@hono/zod-openapi";

import { createSuccessResponseSchema } from "@/shared/lib/http";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

export const productQuerySchema = z
  .object({
    productId: identifierSchema,
  })
  .strict();

export const uploadIdParamsSchema = z.object({
  uploadId: z
    .string()
    .trim()
    .uuid()
    .openapi({
      param: {
        name: "uploadId",
        in: "path",
      },
    }),
});

export const idempotencyHeadersSchema = z.object({
  "idempotency-key": z
    .string()
    .trim()
    .min(8)
    .max(160)
    .openapi({
      param: {
        name: "Idempotency-Key",
        in: "header",
      },
    }),
});

export const createUploadRequestSchema = z
  .object({
    presetId: identifierSchema,
    externalId: z.string().trim().min(1).max(160).optional(),
    filename: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(100),
    sizeBytes: z.number().int().positive(),
    metadata: z
      .object({
        requestId: z.string().trim().min(1).max(120).optional(),
        source: z.string().trim().min(1).max(80).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .openapi("CreateUploadRequest");

const uploadStatusSchema = z.enum([
  "awaiting_upload",
  "queued",
  "processing",
  "succeeded",
  "failed",
]);

const uploadErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  })
  .nullable();

const imageVariantSchema = z.object({
  name: z.string(),
  bucket: z.string(),
  key: z.string(),
  publicUrl: z.string().nullable(),
  contentType: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sizeBytes: z.number().int().positive(),
});

const uploadManifestSchema = z
  .object({
    source: z.object({
      contentType: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      sizeBytes: z.number().int().positive(),
    }),
    variants: z.record(z.string(), imageVariantSchema),
  })
  .nullable();

export const signedUploadResponseSchema = createSuccessResponseSchema(
  z.object({
    uploadId: z.string().uuid(),
    status: uploadStatusSchema,
    upload: z
      .object({
        url: z.url(),
        expiresAt: z.string(),
        headers: z.object({
          "Content-Type": z.string(),
        }),
      })
      .nullable(),
  }),
).openapi("CreateUploadResponse");

export const uploadResultDataSchema = z
  .object({
    uploadId: z.string().uuid(),
    productId: identifierSchema,
    presetId: identifierSchema,
    externalId: z.string().nullable(),
    status: uploadStatusSchema,
    attempts: z.number().int().nonnegative(),
    originalRetentionStatus: z.enum(["pending", "retained", "deleted", "delete_failed"]),
    manifest: uploadManifestSchema,
    error: uploadErrorSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: z.string().nullable(),
  })
  .openapi("UploadResult");

export const uploadResultResponseSchema =
  createSuccessResponseSchema(uploadResultDataSchema).openapi("UploadResultResponse");
