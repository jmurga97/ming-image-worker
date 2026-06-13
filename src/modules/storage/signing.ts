import { AwsClient } from "aws4fetch";

import { encodeObjectKey } from "./keys";

import type { AcceptedImageMimeType } from "@/config/policy";
import type { RuntimeConfig } from "@/config/runtime";

export async function createPresignedPutUrl(input: {
  runtime: RuntimeConfig;
  bucketName: string;
  key: string;
  contentType: AcceptedImageMimeType;
  ttlSeconds: number;
  now?: Date;
}) {
  const signer = new AwsClient({
    accessKeyId: input.runtime.R2_ACCESS_KEY_ID,
    secretAccessKey: input.runtime.R2_SECRET_ACCESS_KEY,
    region: "auto",
    service: "s3",
  });
  const url = new URL(
    `https://${input.runtime.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${input.bucketName}/${encodeObjectKey(input.key)}`,
  );
  url.searchParams.set("X-Amz-Expires", String(input.ttlSeconds));

  const request = await signer.sign(
    new Request(url, {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
      },
    }),
    {
      aws: {
        allHeaders: true,
        signQuery: true,
      },
    },
  );
  const now = input.now ?? new Date();

  return {
    url: request.url,
    expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000).toISOString(),
  };
}
