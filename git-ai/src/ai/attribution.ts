import { randomUUID } from 'crypto';
import { GitService } from '../core/GitService.js';
import { hashLines } from './line-hash.js';
import { AiAttribution } from './schema.js';

export type AttributionInput = {
  provider: string;
  model: string;
  intent: string;
  prompt: string;
  author?: string;
  path?: string;
  // Optional raw content lines to anchor the attribution.
  lines?: string[];
};

export class AttributionService {
  constructor(private git: GitService) {}

  public async buildRecord(commit: string, input: AttributionInput): Promise<AiAttribution> {
    const createdAt = new Date().toISOString();
    const id = randomUUID();

    // Optional: capture the commit's tree for a second-order anchor.
    let tree: string | undefined;
    try {
      tree = (await this.git.raw(['show', '-s', '--format=%T', commit])).trim() || undefined;
    } catch {
      tree = undefined;
    }

    const lineHashes = input.lines ? hashLines(input.lines) : [];

    return {
      v: 1,
      id,
      commit,
      tree,
      path: input.path,
      provider: input.provider,
      model: input.model,
      intent: input.intent,
      prompt: input.prompt,
      author: input.author,
      createdAt,
      anchors: { lineHashes },
    };
  }
}
