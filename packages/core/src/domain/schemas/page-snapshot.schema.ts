import { z } from 'zod';

export const PageMetricsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const ViewportSizeSchema = PageMetricsSchema;

export const InventoryItemSchema = z.object({
  index: z.number().int().nonnegative(),
  shortId: z.string().regex(/^E\d{2,}$/),
  locator: z.string().nullable(),
  selector: z.string().min(1),
  score: z.number(),
  labelShown: z.boolean(),
  tagName: z.string(),
  id: z.string().nullable(),
  role: z.string().nullable(),
  name: z.string().nullable(),
  ariaLabel: z.string().nullable(),
  textPreview: z.string().nullable().optional(),
  locatorMatchCount: z.number().int().nonnegative().optional(),
  selectorMatchCount: z.number().int().nonnegative().optional(),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
    })
    .nullable()
    .optional(),
});

export const PageSnapshotInventorySchema = z.object({
  url: z.url(),
  capturedAt: z.string().datetime(),
  pageMetrics: PageMetricsSchema,
  viewport: ViewportSizeSchema,
  items: z.array(InventoryItemSchema),
  labeledCount: z.number().int().nonnegative(),
});

export type PageMetrics = z.infer<typeof PageMetricsSchema>;
export type ViewportSize = z.infer<typeof ViewportSizeSchema>;
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type PageSnapshotInventory = z.infer<typeof PageSnapshotInventorySchema>;
