export interface R2EventNotification {
  account?: string;
  action?: string;
  bucket:
    | string
    | {
        name: string;
      };
  object: {
    key: string;
    size?: number;
    eTag?: string;
  };
  eventTime?: string;
}

export type ProcessingOutcome =
  | { kind: "completed"; uploadId: string; attempt: number }
  | { kind: "ignored"; uploadId?: string }
  | { kind: "permanent_failure"; uploadId: string; attempt: number; errorCode: string }
  | {
      kind: "retry";
      uploadId: string;
      attempt: number;
      errorCode: string;
      message: string;
    };
