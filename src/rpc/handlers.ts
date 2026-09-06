import {
  rpcBackfillVariantsSchema,
  rpcCreateUploadSchema,
  rpcGetUploadSchema,
  rpcRetryUploadSchema,
} from "@/modules/uploads/schemas";
import { errorEnvelope, errorEnvelopeFromError, successEnvelope } from "@/shared/lib/envelopes";

import type {
  VariantBackfillResult,
  VariantBackfillService,
} from "@/modules/processing/services/variant-backfill.service";
import type { CreateUploadInput, SignedUpload, UploadResult } from "@/modules/uploads/types";
import type { RpcErrorEnvelope, RpcEnvelope } from "@/shared/lib/envelopes";
import type { ZodError, ZodType } from "zod";

export interface ImageWorkerRpcService {
  createUpload(
    productId: string,
    idempotencyKey: string,
    input: CreateUploadInput,
  ): Promise<SignedUpload>;
  getUpload(productId: string, uploadId: string): Promise<UploadResult>;
  retryUpload(productId: string, uploadId: string): Promise<UploadResult>;
}

interface ValidationFailure {
  ok: false;
  envelope: RpcErrorEnvelope;
}

interface ValidationSuccess<Data> {
  ok: true;
  data: Data;
}

function invalidBodyEnvelope(error: ZodError): RpcErrorEnvelope {
  const issue = error.issues[0];
  const path = issue ? issue.path.join(".") : "";
  const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : "Invalid request";
  return errorEnvelope("INVALID_BODY", message, false);
}

function validateInput<Schema extends ZodType>(
  schema: Schema,
  input: unknown,
): ValidationSuccess<Schema["_output"]> | ValidationFailure {
  const result = schema.safeParse(input);

  if (!result.success) {
    return { ok: false, envelope: invalidBodyEnvelope(result.error) };
  }

  return { ok: true, data: result.data };
}

export async function handleCreateUpload(
  service: ImageWorkerRpcService,
  input: unknown,
): Promise<RpcEnvelope<SignedUpload>> {
  const parsed = validateInput(rpcCreateUploadSchema, input);

  if (!parsed.ok) {
    return parsed.envelope;
  }

  try {
    const result = await service.createUpload(
      parsed.data.productId,
      parsed.data.idempotencyKey,
      parsed.data.upload,
    );
    return successEnvelope(result);
  } catch (error) {
    return errorEnvelopeFromError(error);
  }
}

export async function handleGetUpload(
  service: ImageWorkerRpcService,
  input: unknown,
): Promise<RpcEnvelope<UploadResult>> {
  const parsed = validateInput(rpcGetUploadSchema, input);

  if (!parsed.ok) {
    return parsed.envelope;
  }

  try {
    const result = await service.getUpload(parsed.data.productId, parsed.data.uploadId);
    return successEnvelope(result);
  } catch (error) {
    return errorEnvelopeFromError(error);
  }
}

export async function handleRetryUpload(
  service: ImageWorkerRpcService,
  input: unknown,
): Promise<RpcEnvelope<UploadResult>> {
  const parsed = validateInput(rpcRetryUploadSchema, input);

  if (!parsed.ok) {
    return parsed.envelope;
  }

  try {
    const result = await service.retryUpload(parsed.data.productId, parsed.data.uploadId);
    return successEnvelope(result);
  } catch (error) {
    return errorEnvelopeFromError(error);
  }
}

export async function handleBackfillVariants(
  service: VariantBackfillService,
  input: unknown,
): Promise<RpcEnvelope<VariantBackfillResult>> {
  const parsed = validateInput(rpcBackfillVariantsSchema, input);

  if (!parsed.ok) {
    return parsed.envelope;
  }

  try {
    const result = await service.run(parsed.data);
    return successEnvelope(result);
  } catch (error) {
    return errorEnvelopeFromError(error);
  }
}
