import { AiAttribution } from './schema.js';

export type AiFilter = {
  model?: string;
  provider?: string;
  author?: string;
  intent?: string;
  since?: string; // ISO date
  until?: string; // ISO date
};

export function matchesFilter(rec: Pick<AiAttribution, 'model' | 'provider' | 'author' | 'intent' | 'createdAt'>, filter: AiFilter): boolean {
  if (filter.model && rec.model !== filter.model) return false;
  if (filter.provider && rec.provider !== filter.provider) return false;
  if (filter.author && (rec.author ?? '') !== filter.author) return false;
  if (filter.intent && rec.intent !== filter.intent) return false;
  if (filter.since && rec.createdAt < filter.since) return false;
  if (filter.until && rec.createdAt > filter.until) return false;
  return true;
}
