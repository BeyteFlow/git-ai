import fs from 'fs/promises';
import path from 'path';
import { AIService } from './AIService.js';
import { GitService } from '../core/GitService.js';
import { logger } from '../utils/logger.js';

export interface ConflictDetail {
  file: string;
  content: string;
  suggestion?: string;
}

export class ConflictResolver {
  constructor(
    private aiService: AIService,
    private gitService: GitService
  ) {}

  /**
   * Identifies files with merge conflicts and fetches their content
   */
  public async getConflicts(): Promise<ConflictDetail[]> {
    const status = await this.gitService.getStatus();
    const conflictFiles = status.conflicted;

    if (conflictFiles.length === 0) return [];

    const results = await Promise.allSettled(
      conflictFiles.map(async (file) => {
        const filePath = path.resolve(process.cwd(), file);
        const content = await fs.readFile(filePath, 'utf-8');
        return { file, content };
      })
    );

    const conflicts: ConflictDetail[] = [];
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const file = conflictFiles[index];
      if (result.status === 'fulfilled') {
        conflicts.push(result.value);
        continue;
      }

      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      logger.error(`Failed to read conflicted file ${file}: ${reason}`);
    }

    return conflicts;
  }

  /**
   * Uses Gemini to analyze the conflict markers and suggest a fix
   */
  public async suggestResolution(conflict: ConflictDetail): Promise<string> {
    const prompt = `
      You are a senior software architect. I have a merge conflict in the file: ${conflict.file}.
      Below is the file content containing git conflict markers (<<<<<<<, =======, >>>>>>>).
      
      FILE CONTENT:
      ${conflict.content}
      
      INSTRUCTIONS:
      1. Analyze the changes from both branches.
      2. Provide the full RESOLVED file content.
      3. Remove all git conflict markers.
      4. Ensure the code is syntactically correct and merges the intent of both changes.
      5. Return ONLY the code for the resolved file.
    `;

    try {
      const responseText = await this.aiService.generateContent(prompt);
      return responseText
        .replace(/^```[a-z]*\s*\n?/gim, '')
        .replace(/\n?```\s*$/gim, '')
        .trim();
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `AI Resolution failed for ${conflict.file}`);
      throw new Error('Could not generate resolution suggestion.');
    }
  }

  /**
   * Applies the AI's suggested resolution to the physical file.
   * Uses atomic write with O_NOFOLLOW to prevent symlink attacks and TOCTOU races.
   */
  public async applyResolution(file: string, resolvedContent: string): Promise<void> {
    const realRepoRoot = await fs.realpath(process.cwd());
    const targetPath = path.resolve(realRepoRoot, file);

    // Check if file exists and reject if it's a symlink
    try {
      const targetStats = await fs.lstat(targetPath);
      if (targetStats.isSymbolicLink()) {
        throw new Error(`Refusing to write to symlink: ${file}`);
      }
    } catch (error: unknown) {
      // Handle ENOENT gracefully - file doesn't exist yet, which is fine
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        // File does not exist, proceeding with creation is safe
      } else {
        // Re-throw any other error
        throw error;
      }
    }

    // Validate repository boundary by checking parent directory
    const targetParent = path.dirname(targetPath);
    let realParent: string;
    try {
      realParent = await fs.realpath(targetParent);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        throw new Error(`Parent directory does not exist: ${targetParent}`);
      }
      throw error;
    }
    const normalizedRoot = realRepoRoot.endsWith(path.sep) ? realRepoRoot : `${realRepoRoot}${path.sep}`;
    if (!realParent.startsWith(normalizedRoot) && realParent !== realRepoRoot) {
      throw new Error(`Refusing to write outside repository root: ${file}`);
    }

    // Use atomic write with O_NOFOLLOW to prevent TOCTOU races and symlink escape
    const flags = fs.constants.O_NOFOLLOW | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_WRONLY;
    const buffer = Buffer.from(resolvedContent, 'utf-8');
    const fileHandle = await fs.open(targetPath, flags, 0o644);
    try {
      await fileHandle.write(buffer, 0, buffer.length);
      await fileHandle.sync();
    } finally {
      await fileHandle.close();
    }
    // Note: User should still 'git add' the file manually or via CLI flow
  }
}