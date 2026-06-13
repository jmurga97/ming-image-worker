import { ServiceError } from "@/shared/errors/service-error";

import type { StorageProfile } from "./types";
import type { RuntimeConfig } from "@/config/runtime";
import type { Bindings } from "@/config/types";

export function createStorageRegistry(
  env: Bindings,
  runtime: RuntimeConfig,
): Record<string, StorageProfile> {
  return {
    roncalphoto: {
      id: "roncalphoto",
      originals: {
        binding: env.RONCALPHOTO_ORIGINALS_BUCKET,
        bucketName: runtime.RONCALPHOTO_ORIGINALS_BUCKET_NAME,
      },
      outputs: {
        binding: env.RONCALPHOTO_MEDIA_BUCKET,
        bucketName: runtime.RONCALPHOTO_MEDIA_BUCKET_NAME,
        publicBaseUrl: runtime.RONCALPHOTO_PUBLIC_MEDIA_BASE_URL ?? null,
      },
    },
  };
}

export function resolveStorageProfile(
  registry: Record<string, StorageProfile>,
  profileId: string,
): StorageProfile {
  const profile = registry[profileId];

  if (!profile) {
    throw new ServiceError(
      "INTERNAL_SERVER_ERROR",
      500,
      `Storage profile "${profileId}" is not configured`,
    );
  }

  return profile;
}
