import { toServiceError } from "@/shared/errors/service-error";

export interface ErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
}

export interface RpcSuccessEnvelope<Data> {
  success: true;
  data: Data;
}

export interface RpcErrorEnvelope {
  success: false;
  error: ErrorPayload;
}

export type RpcEnvelope<Data> = RpcSuccessEnvelope<Data> | RpcErrorEnvelope;

export function successEnvelope<Data>(data: Data): RpcSuccessEnvelope<Data> {
  return { success: true, data };
}

export function errorEnvelope(code: string, message: string, retryable: boolean): RpcErrorEnvelope {
  return {
    success: false,
    error: {
      code,
      message,
      retryable,
    },
  };
}

export function errorEnvelopeFromError(error: unknown): RpcErrorEnvelope {
  const serviceError = toServiceError(error);

  if (serviceError.code === "INTERNAL_SERVER_ERROR") {
    console.error("Unhandled image worker error");
  }

  return errorEnvelope(serviceError.code, serviceError.message, serviceError.retryable);
}
