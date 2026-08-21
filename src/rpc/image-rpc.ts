import { WorkerEntrypoint } from "cloudflare:workers";

import { parseRuntimeConfig } from "@/config/runtime";
import { createUploadsService } from "@/modules/uploads/factory";
import { handleCreateUpload, handleGetUpload, handleRetryUpload } from "@/rpc/handlers";

import type { Bindings } from "@/config/types";
import type { SignedUpload, UploadResult } from "@/modules/uploads/types";
import type { RpcEnvelope } from "@/shared/lib/envelopes";

export class ImageRpc extends WorkerEntrypoint<Bindings> {
  async createUpload(input: unknown): Promise<RpcEnvelope<SignedUpload>> {
    return handleCreateUpload(createUploadsService(this.env, parseRuntimeConfig(this.env)), input);
  }

  async getUpload(input: unknown): Promise<RpcEnvelope<UploadResult>> {
    return handleGetUpload(createUploadsService(this.env, parseRuntimeConfig(this.env)), input);
  }

  async retryUpload(input: unknown): Promise<RpcEnvelope<UploadResult>> {
    return handleRetryUpload(createUploadsService(this.env, parseRuntimeConfig(this.env)), input);
  }
}
