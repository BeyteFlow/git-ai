import { z } from 'zod';
import { GitService } from '../core/GitService.js';
import { AiAttribution, AiAttributionSchema, AiIndexEntry, AiIndexEntrySchema } from './schema.js';

const NOTES_REF = 'refs/notes/git-ai';

const NotesPayloadSchema = z.object({
  v: z.literal(1),
  // Minimal searchable index for the commit.
  index: z.array(AiIndexEntrySchema).default([]),
  // Full records keyed by id.
  records: z.record(z.string(), AiAttributionSchema).default({}),
});

type NotesPayload = z.infer<typeof NotesPayloadSchema>;

function emptyPayload(): NotesPayload {
  return { v: 1, index: [], records: {} };
}

function parseJsonOrNull(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export class AiNotesStore {
  constructor(private git: GitService) {}

  public getNotesRef(): string {
    return NOTES_REF;
  }

  public async ensureNotesRefExists(): Promise<void> {
    // Best-effort: git notes will create the ref on first add.
    // This exists mostly for UX checks.
    return;
  }

  public async readCommitNote(commit: string): Promise<NotesPayload> {
    // `git notes --ref <ref> show <commit>` exits non-zero when no note exists.
    let out = '';
    try {
      out = await this.git.rawQuiet(['notes', '--ref', NOTES_REF, 'show', commit]);
    } catch {
      return emptyPayload();
    }

    const parsed = parseJsonOrNull(out);
    if (!parsed) return emptyPayload();

    const validated = NotesPayloadSchema.safeParse(parsed);
    if (!validated.success) return emptyPayload();
    return validated.data;
  }

  public async writeCommitNote(commit: string, payload: NotesPayload): Promise<void> {
    const serialized = JSON.stringify(payload);
    // Replace existing note.
    await this.git.raw(['notes', '--ref', NOTES_REF, 'add', '-f', '-m', serialized, commit]);
  }

  public async upsertAttribution(record: AiAttribution): Promise<void> {
    const validated = AiAttributionSchema.parse(record);
    const existing = await this.readCommitNote(validated.commit);

    const next: NotesPayload = {
      ...existing,
      v: 1,
      records: { ...existing.records, [validated.id]: validated },
      index: this.upsertIndex(existing.index, validated),
    };

    await this.writeCommitNote(validated.commit, next);
  }

  private upsertIndex(index: AiIndexEntry[], rec: AiAttribution): AiIndexEntry[] {
    const entry: AiIndexEntry = {
      id: rec.id,
      commit: rec.commit,
      path: rec.path,
      provider: rec.provider,
      model: rec.model,
      intent: rec.intent,
      author: rec.author,
      createdAt: rec.createdAt,
    };

    const next = index.filter((e) => e.id !== rec.id);
    next.push(entry);
    // Keep stable ordering by createdAt then id.
    next.sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
    return next;
  }

  public async listIndexForCommit(commit: string): Promise<AiIndexEntry[]> {
    const payload = await this.readCommitNote(commit);
    return payload.index.map((e) => ({ ...e, commit }));
  }

  public async getRecord(commit: string, id: string): Promise<AiAttribution | null> {
    const payload = await this.readCommitNote(commit);
    const rec = payload.records[id];
    if (!rec) return null;
    // Validate on read to avoid propagating corrupted notes.
    const validated = AiAttributionSchema.safeParse(rec);
    return validated.success ? { ...validated.data, commit } : null;
  }
}
