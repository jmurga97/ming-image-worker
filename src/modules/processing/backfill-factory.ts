import { CloudflareImagesEngine } from "@/modules/images/engine";
import { createStorageRegistry } from "@/modules/storage/registry";
import { UploadJobsRepository } from "@/modules/uploads/repository";

import { VariantBackfillService } from "./services/variant-backfill.service";

import type { RuntimeConfig } from "@/config/runtime";
import type { Bindings } from "@/config/types";

export function createVariantBackfillService(
  env: Bindings,
  runtime: RuntimeConfig,
): VariantBackfillService {
  return new VariantBackfillService(
    runtime.policy,
    new UploadJobsRepository(env.DB),
    createStorageRegistry(env, runtime),
    new CloudflareImagesEngine(env.IMAGES),
  );
}
