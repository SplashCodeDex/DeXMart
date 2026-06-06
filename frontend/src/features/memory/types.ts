import { z } from 'zod';

/**
 * A single memory item in the user's agent memory.
 * Stored as text in Firestore — vectors live only on-device.
 */
const MemoryItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  score: z.number().min(0).max(1).optional(), // Only present in search results
  metadata: z
    .object({
      source: z.string().optional(),
      sessionId: z.string().optional(),
      agentId: z.string().optional(),
    })
    .optional(),
  createdAt: z.string(), // ISO string
});
export type MemoryItem = z.infer<typeof MemoryItemSchema>;

/**
 * The initialization progress reported by the memory worker.
 */
const MemoryInitProgressSchema = z.object({
  stage: z.enum(['loading_model', 'rehydrating']),
  pct: z.number().min(0).max(100),
});
export type MemoryInitProgress = z.infer<typeof MemoryInitProgressSchema>;

/**
 * Overall status of the memory worker.
 */
const MemoryStatusSchema = z.object({
  initialized: z.boolean(),
  modelLoaded: z.boolean(),
  memoriesInDB: z.number().int().min(0),
  maxLocalItems: z.number().int().positive(),
  userId: z.string().nullable(),
});
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;

/**
 * A semantic search result.
 */
const MemorySearchResultSchema = z.object({
  text: z.string(),
  score: z.number().min(0).max(1),
  metadata: z
    .object({
      source: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .optional(),
});
export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;
