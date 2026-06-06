/**
 * Memory feature — public API
 *
 * On-device hybrid memory for agent context.
 * Embeddings run locally via Transformers.js (WebWorker).
 * Text is backed up to Firestore. Vectors never leave the device.
 */
export { MemoryPanel } from './components/MemoryPanel';
export type {
  MemoryItem,
  MemorySearchResult,
  MemoryInitProgress,
  MemoryStatus,
} from './types';
