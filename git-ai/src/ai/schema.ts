import { z } from 'zod';

export const AiAttributionSchema = z.object({
  // Schema version for forwards/backwards compatibility.
  v: z.literal(1),

  // Stable ID for the attribution record.
  id: z.string().min(1),

  // Git object linkage.
  commit: z.string().min(7),
  tree: z.string().min(7).optional(),

  // Optional file linkage.
  // Note: line-level attribution is stored separately via line hashes.
  path: z.string().min(1).optional(),

  // Human-level metadata.
  provider: z.string().min(1),
  model: z.string().min(1),
  intent: z.string().min(1),
  prompt: z.string().min(1),

  // Actors and time.
  author: z.string().min(1).optional(),
  createdAt: z.string().min(1),

  // Content anchors for survivability across history rewrites/refactors.
  // These are best-effort and allow correlation even when commit ids change.
  anchors: z.object({
    // Hashes of the final version lines (or a representative subset).
    lineHashes: z.array(z.string().min(1)).default([]),
  }).default({ lineHashes: [] }),
});

export type AiAttribution = z.infer<typeof AiAttributionSchema>;

export const AiIndexEntrySchema = z.object({
  // Minimal entry for indexing and filtering.
  id: z.string().min(1),
  commit: z.string().min(7),
  path: z.string().min(1).optional(),
  provider: z.string().min(1),
  model: z.string().min(1),
  intent: z.string().min(1),
  author: z.string().min(1).optional(),
  createdAt: z.string().min(1),
});

export type AiIndexEntry = z.infer<typeof AiIndexEntrySchema>;
