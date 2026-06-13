import { z } from "zod";

import imagePolicy from "./image-policy.json";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

const mimeTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);
const imageFitSchema = z.enum(["scale-down", "contain", "cover", "crop", "pad", "squeeze"]);

const variantSchema = z
  .object({
    format: z.literal("image/webp"),
    width: z.number().int().positive().max(12_000),
    fit: imageFitSchema,
    quality: z.number().int().min(1).max(100),
  })
  .strict();

const presetSchema = z
  .object({
    version: z.number().int().positive(),
    variants: z
      .record(identifierSchema, variantSchema)
      .refine(
        (variants) => Object.keys(variants).length > 0,
        "A preset must define at least one variant",
      ),
    previousVersions: z
      .record(
        z.string().regex(/^[1-9]\d*$/),
        z
          .object({
            variants: z
              .record(identifierSchema, variantSchema)
              .refine(
                (variants) => Object.keys(variants).length > 0,
                "A preset must define at least one variant",
              ),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const productSchema = z
  .object({
    storageProfile: identifierSchema,
    allowedPresets: z.array(identifierSchema).min(1),
    acceptedInputFormats: z.array(mimeTypeSchema).min(1),
    maxUploadBytes: z.number().int().positive(),
    presignedUrlTtlSeconds: z.number().int().min(60).max(3600).default(900),
    retainOriginal: z.boolean().default(true),
  })
  .strict();

const imagePolicySchema = z
  .object({
    version: z.number().int().positive(),
    presets: z.record(identifierSchema, presetSchema),
    products: z.record(identifierSchema, productSchema),
  })
  .strict()
  .superRefine((policy, context) => {
    for (const [productId, product] of Object.entries(policy.products)) {
      for (const presetId of product.allowedPresets) {
        if (!policy.presets[presetId]) {
          context.addIssue({
            code: "custom",
            message: `Unknown preset "${presetId}"`,
            path: ["products", productId, "allowedPresets"],
          });
        }
      }
    }
  });

export type ImagePolicy = z.infer<typeof imagePolicySchema>;
export type ProductPolicy = ImagePolicy["products"][string];
export type ImagePreset = ImagePolicy["presets"][string];
export type ImageVariantPolicy = ImagePreset["variants"][string];
export type AcceptedImageMimeType = z.infer<typeof mimeTypeSchema>;

export function parseImagePolicy(value: unknown): ImagePolicy {
  return imagePolicySchema.parse(value);
}

export function loadImagePolicy(): ImagePolicy {
  return parseImagePolicy(imagePolicy);
}
