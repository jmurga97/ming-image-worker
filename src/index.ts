import { processQueueBatch } from "@/modules/processing/queue";
import { ImageRpc } from "@/rpc/image-rpc";

import type { Bindings } from "@/config/types";

export { ImageRpc };

function healthResponse(): Response {
  return Response.json({
    success: true as const,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
}

export default {
  fetch: healthResponse,
  queue: processQueueBatch,
} satisfies ExportedHandler<Bindings>;
