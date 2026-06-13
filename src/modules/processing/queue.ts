import { parseRuntimeConfig } from "@/config/runtime";
import { UploadJobsRepository } from "@/modules/uploads/repository";

import { createProcessingService } from "./factory";

import type { ProcessingService } from "./services/processing.service";
import type { R2EventNotification } from "./types";
import type { Bindings, ProcessingQueueMessage } from "@/config/types";
import type { UploadJobsStore } from "@/modules/uploads/repository";

type QueueBody = R2EventNotification | ProcessingQueueMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseQueueBody(value: unknown): QueueBody | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.kind === "retry" && typeof value.uploadId === "string") {
    return {
      kind: "retry",
      uploadId: value.uploadId,
    };
  }

  const bucket = value.bucket;
  const object = value.object;
  const validBucket =
    typeof bucket === "string" || (isRecord(bucket) && typeof bucket.name === "string");

  if (!validBucket || !isRecord(object) || typeof object.key !== "string") {
    return null;
  }

  return {
    bucket: bucket as R2EventNotification["bucket"],
    object: {
      key: object.key,
    },
  };
}

function isRetryMessage(body: QueueBody): body is ProcessingQueueMessage {
  return "kind" in body && body.kind === "retry";
}

function readBucketName(event: R2EventNotification): string {
  return typeof event.bucket === "string" ? event.bucket : event.bucket.name;
}

async function resolveUploadId(
  body: QueueBody,
  repository: UploadJobsStore,
): Promise<string | null> {
  if (isRetryMessage(body)) {
    return body.uploadId;
  }

  const job = await repository.findByOriginalObject(readBucketName(body), body.object.key);
  return job?.id ?? null;
}

function retryDelaySeconds(attempt: number): number {
  if (attempt <= 1) {
    return 30;
  }

  if (attempt === 2) {
    return 120;
  }

  return 300;
}

async function processMainQueueMessage(
  message: Message<unknown>,
  service: ProcessingService,
  repository: UploadJobsStore,
): Promise<void> {
  const body = parseQueueBody(message.body);

  if (!body) {
    message.ack();
    return;
  }

  const uploadId = await resolveUploadId(body, repository);

  if (!uploadId) {
    message.ack();
    return;
  }

  const outcome = await service.process(uploadId, isRetryMessage(body));

  if (outcome.kind === "retry") {
    message.retry({ delaySeconds: retryDelaySeconds(outcome.attempt) });
    return;
  }

  message.ack();
}

async function processDeadLetterMessage(
  message: Message<unknown>,
  service: ProcessingService,
  repository: UploadJobsStore,
): Promise<void> {
  const body = parseQueueBody(message.body);
  const uploadId = body ? await resolveUploadId(body, repository) : null;

  if (uploadId) {
    await service.failExhausted(uploadId);
  }

  message.ack();
}

export async function processQueueBatch(
  batch: MessageBatch<unknown>,
  env: Bindings,
): Promise<void> {
  const runtime = parseRuntimeConfig(env);
  const service = createProcessingService(env, runtime);
  const repository = new UploadJobsRepository(env.DB);
  const isDeadLetterQueue = batch.queue === runtime.PROCESSING_DLQ_NAME;

  for (const message of batch.messages) {
    try {
      if (isDeadLetterQueue) {
        await processDeadLetterMessage(message, service, repository);
      } else {
        await processMainQueueMessage(message, service, repository);
      }
    } catch {
      console.error("Queue handler failed");
      message.retry({ delaySeconds: 300 });
    }
  }
}
