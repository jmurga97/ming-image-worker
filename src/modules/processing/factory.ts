import { CloudflareImagesEngine } from "@/modules/images/engine";
import { createStorageRegistry } from "@/modules/storage/registry";
import { UploadJobsRepository } from "@/modules/uploads/repository";

import { ProcessingService } from "./services/processing.service";

import type { RuntimeConfig } from "@/config/runtime";
import type { Bindings } from "@/config/types";

export function createProcessingService(env: Bindings, runtime: RuntimeConfig): ProcessingService {
  return new ProcessingService(
    runtime.policy,
    new UploadJobsRepository(env.DB),
    createStorageRegistry(env, runtime),
    new CloudflareImagesEngine(env.IMAGES),
  );
}
