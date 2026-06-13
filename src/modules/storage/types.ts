export interface StorageProfile {
  id: string;
  originals: {
    binding: R2Bucket;
    bucketName: string;
  };
  outputs: {
    binding: R2Bucket;
    bucketName: string;
    publicBaseUrl: string | null;
  };
}
