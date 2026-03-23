import { GitService } from '../core/GitService.js';
import { AIService } from '../services/AIService.js';
import { ConfigService } from '../services/ConfigService.js';
import { ConflictResolver } from '../services/ConflictResolver.js';

export async function runResolveCommand() {
  const config = new ConfigService();
  const git = new GitService();
  const ai = new AIService(config);
  const resolver = new ConflictResolver(ai, git);

  let conflicts;
  let skippedFiles: string[] = [];
  try {
    ({ conflicts, skippedFiles } = await resolver.getConflicts());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to list merge conflicts in runResolveCommand: ${message}`);
    process.exitCode = 1;
    return;
  }

  if (skippedFiles.length > 0) {
    console.warn(`⚠️ Could not read ${skippedFiles.length} conflicted file(s): ${skippedFiles.join(', ')}`);
  }

  if (conflicts.length === 0) {
    console.log('✅ No conflicts found.');
    if (skippedFiles.length > 0) process.exitCode = 1;
    return;
  }

  const failedFiles: string[] = [];
  let successCount = 0;

  for (const conflict of conflicts) {
    console.log(`🤖 Resolving: ${conflict.file}...`);
    try {
      const solution = await resolver.suggestResolution(conflict);
      await resolver.applyResolution(conflict.file, solution);
      console.log(`✅ Applied AI fix to ${conflict.file}`);
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to resolve ${conflict.file}: ${message}`);
      failedFiles.push(conflict.file);
    }
  }

  if (successCount > 0) {
    console.log(`\n🎉 Successfully resolved ${successCount} file(s).`);
  }

  if (failedFiles.length > 0 || skippedFiles.length > 0) {
    if (failedFiles.length > 0) {
      console.error(`⚠️ Resolution failed for ${failedFiles.length} file(s): ${failedFiles.join(', ')}`);
    }
    process.exitCode = 1;
  }
}