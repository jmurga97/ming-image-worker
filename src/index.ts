import { createApp } from "@/app/create-app";
import { processQueueBatch } from "@/modules/processing/queue";

import type { Bindings } from "@/config/types";

const app = createApp();

export default {
  fetch: app.fetch,
  queue: processQueueBatch,
} satisfies ExportedHandler<Bindings>;
