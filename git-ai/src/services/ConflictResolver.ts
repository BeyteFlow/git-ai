import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { AIService } from './AIService.js';
import { GitService } from '../core/GitService.js';
import { logger } from '../utils/logger.js';

export interface ConflictDetail {
  file: string;
  content: string;
  suggestion?: string;
}

/**
 * Patterns for detecting secrets and sensitive data in conflict content.
 */
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE KEY-----/gi,
  /(?:api[_\s-]?key|apikey|secret|token|password|passwd|pwd|auth)['":\s=]+['"]?[A-Za-z0-9/+_\-]{16,}['"]?/gi,
  // Long base64-like strings that resemble encoded tokens (standalone, not part of identifiers)
  /(?<![A-Za-z0-9])([A-Za-z0-9+/]{40,}={0,2})(?![A-Za-z0-9])/g,
  /(?<![A-Za-z0-9_])[a-f0-9]{32,64}(?![A-Za-z0-9_])/gi, // hex strings (hashes/keys)
];

/**
 * Extracts only the conflict hunks (lines between <<<<<<< ... >>>>>>>) from file content.
 */
function extractConflictHunks(content: string): string {
  const lines = content.split('\n');
  const hunks: string[] = [];
  let inConflict = false;
  let hunk: string[] = [];

  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      hunk = [line];
    } else if (inConflict) {
      hunk.push(line);
      if (line.startsWith('>>>>>>>')) {
        hunks.push(hunk.join('\n'));
        hunk = [];
        inConflict = false;
      }
    }
  }

  return hunks.length > 0 ? hunks.join('\n\n') : content;
}

/**
 * Redacts common secret patterns from content before sending to an external model.
 */
function sanitizeContent(content: string): string {
  let sanitized = extractConflictHunks(content);
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
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
   * Uses Gemini to analyze the conflict markers and suggest a fix.
   * Sanitizes the content before sending to the external model.
   */
  public async suggestResolution(conflict: ConflictDetail): Promise<string> {
    const sanitizedContent = sanitizeContent(conflict.content);

    const prompt = `
      You are a senior software architect. I have a merge conflict in the file: ${conflict.file}.
      Below are the conflict hunks containing git conflict markers (<<<<<<<, =======, >>>>>>>).
      
      CONFLICT HUNKS:
      ${sanitizedContent}
      
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
   * Applies the AI's suggested resolution to the physical file using a truly atomic
   * write: write to a temp file in the same directory, fsync, then rename to target.
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
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        // File does not exist, proceeding with creation is safe
      } else {
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

    // Atomic write: write to a temp file, fsync, then rename into place.
    const tempPath = path.join(targetParent, `.tmp-${process.pid}-${randomBytes(8).toString('hex')}`);
    const buffer = Buffer.from(resolvedContent, 'utf-8');
    const tempHandle = await fs.open(tempPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o644);
    try {
      await tempHandle.writeFile(buffer);
      await tempHandle.sync();
      await tempHandle.close();
    } catch (error) {
      await tempHandle.close().catch(() => {});
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }

    // Atomically replace target with temp file
    try {
      await fs.rename(tempPath, targetPath);
    } catch (error) {
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
    // Note: User should still 'git add' the file manually or via CLI flow
  }
}