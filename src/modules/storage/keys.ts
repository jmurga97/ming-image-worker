const unsafeFilenameCharacters = /[^a-zA-Z0-9._-]+/g;

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function sanitizeSegment(value: string, fallback: string): string {
  const sanitized = value.trim().replace(unsafeFilenameCharacters, "-").replace(/-+/g, "-");
  return sanitized.length > 0 ? sanitized : fallback;
}

export function encodeObjectKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function createOriginalKey(productId: string, uploadId: string, filename: string): string {
  return `products/${sanitizeSegment(productId, "product")}/uploads/${uploadId}/original/${sanitizeSegment(filename, "original")}`;
}

export function extensionForMimeType(contentType: string): string {
  switch (contentType) {
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    default:
      return "bin";
  }
}

export function createVariantKey(input: {
  productId: string;
  uploadId: string;
  presetId: string;
  presetVersion: number;
  variantName: string;
  contentType: string;
}): string {
  const extension = extensionForMimeType(input.contentType);
  return [
    "products",
    sanitizeSegment(input.productId, "product"),
    "uploads",
    input.uploadId,
    `preset-${sanitizeSegment(input.presetId, "preset")}-v${input.presetVersion}`,
    `${sanitizeSegment(input.variantName, "variant")}.${extension}`,
  ].join("/");
}

export function createPublicUrl(baseUrl: string | null, key: string): string | null {
  return baseUrl ? `${trimSlashes(baseUrl)}/${encodeObjectKey(key)}` : null;
}
