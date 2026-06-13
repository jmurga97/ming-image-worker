import { createStorageRegistry } from "@/modules/storage/registry";

import { UploadJobsRepository } from "./repository";
import { UploadsService } from "./services/uploads.service";

import type { RuntimeConfig } from "@/config/runtime";
import type { Bindings } from "@/config/types";

export function createUploadsService(env: Bindings, runtime: RuntimeConfig): UploadsService {
  return new UploadsService(
    runtime,
    new UploadJobsRepository(env.DB),
    createStorageRegistry(env, runtime),
    env.IMAGE_PROCESSING_QUEUE,
  );
}
