import { z } from "zod";

import { loadImagePolicy } from "./policy";

import type { ImagePolicy } from "./policy";
import type { Bindings } from "./types";

const runtimeSchema = z
  .object({
    R2_ACCOUNT_ID: z.string().trim().min(1),
    R2_ACCESS_KEY_ID: z.string().trim().min(1),
    R2_SECRET_ACCESS_KEY: z.string().trim().min(1),
    RONCALPHOTO_ORIGINALS_BUCKET_NAME: z.string().trim().min(1),
    RONCALPHOTO_MEDIA_BUCKET_NAME: z.string().trim().min(1),
    RONCALPHOTO_PUBLIC_MEDIA_BASE_URL: z.url().optional(),
    PROCESSING_QUEUE_NAME: z.string().trim().min(1),
    PROCESSING_DLQ_NAME: z.string().trim().min(1),
  })
  .strict();

export interface RuntimeConfig extends z.output<typeof runtimeSchema> {
  policy: ImagePolicy;
}

export function parseRuntimeConfig(env: Bindings): RuntimeConfig {
  const runtime = runtimeSchema.parse({
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    RONCALPHOTO_ORIGINALS_BUCKET_NAME: env.RONCALPHOTO_ORIGINALS_BUCKET_NAME,
    RONCALPHOTO_MEDIA_BUCKET_NAME: env.RONCALPHOTO_MEDIA_BUCKET_NAME,
    RONCALPHOTO_PUBLIC_MEDIA_BASE_URL: env.RONCALPHOTO_PUBLIC_MEDIA_BASE_URL,
    PROCESSING_QUEUE_NAME: env.PROCESSING_QUEUE_NAME,
    PROCESSING_DLQ_NAME: env.PROCESSING_DLQ_NAME,
  });

  return {
    ...runtime,
    policy: loadImagePolicy(),
  };
}
