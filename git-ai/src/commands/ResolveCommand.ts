import { GitService } from '../core/GitService.js';
import { AIService } from '../services/AIService.js';
import { ConfigService } from '../services/ConfigService.js';
import { ConflictResolver } from '../services/ConflictResolver.js';

export async function runResolveCommand() {
  const config = new ConfigService();
  const git = new GitService();
  const ai = new AIService(config);
  const resolver = new ConflictResolver(ai, git);

  const conflicts = await resolver.getConflicts();
  
  if (conflicts.length === 0) {
    console.log('✅ No conflicts found.');
    return;
  }

  for (const conflict of conflicts) {
    console.log(`🤖 Resolving: ${conflict.file}...`);
    const solution = await resolver.suggestResolution(conflict);
    await resolver.applyResolution(conflict.file, solution);
    console.log(`✅ Applied AI fix to ${conflict.file}`);
  }
}