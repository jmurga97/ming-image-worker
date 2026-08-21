import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

const idempotencyKeySchema = z.string().trim().min(8).max(160);

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
  .strict();

export const rpcCreateUploadSchema = z
  .object({
    productId: identifierSchema,
    idempotencyKey: idempotencyKeySchema,
    upload: createUploadRequestSchema,
  })
  .strict();

const rpcUploadRefSchema = z
  .object({
    productId: identifierSchema,
    uploadId: z.string().trim().uuid(),
  })
  .strict();

export const rpcGetUploadSchema = rpcUploadRefSchema;

export const rpcRetryUploadSchema = rpcUploadRefSchema;
