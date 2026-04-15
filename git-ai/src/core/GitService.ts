import { simpleGit, SimpleGit, StatusResult, LogResult, BranchSummary } from 'simple-git';
import { logger } from '../utils/logger.js';

function redactGitArgs(args: string[]): string[] {
  // `git notes add -m <message>` can contain prompts/metadata. Avoid logging secrets.
  const redacted: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? '';
    redacted.push(a);

    if (a === '-m' || a === '--message' || a === '-F' || a === '--file') {
      const next = args[i + 1];
      if (typeof next === 'string') {
        redacted.push('<redacted>');
        i++;
      }
    }
  }
  return redacted;
}

export class GitService {
  private git: SimpleGit;

  constructor(workingDir: string = process.cwd()) {
    this.git = simpleGit(workingDir);
  }

  /** Run an arbitrary git command and capture stdout. */
  public async raw(args: string[]): Promise<string> {
    try {
      return await this.git.raw(args);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to run git ${redactGitArgs(args).join(' ')}: ${details}`);
      throw error;
    }
  }

  /** Run an arbitrary git command without logging on failure (caller handles errors). */
  public async rawQuiet(args: string[]): Promise<string> {
    return this.git.raw(args);
  }

  public async getRemotes(verbose: boolean = true): Promise<any[]> {
    // simple-git uses overloads for verbose true/false; keep a single ergonomic API.
    const v = Boolean(verbose);
    return v ? this.git.getRemotes(true) : this.git.getRemotes(false);
  }

  public async getStatus(): Promise<StatusResult> {
    try {
      return await this.git.status();
    } catch (error) {
      logger.error(`Failed to fetch git status: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  public async getDiff(): Promise<string> {
    return await this.git.diff(['--cached']);
  }

  public async commit(message: string): Promise<void> {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      throw new Error('Commit message cannot be empty or whitespace.');
    }

    try {
      await this.git.commit(normalizedMessage);
    } catch (error) {
      const original = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create git commit: ${original}`);
    }
  }

  public async getLog(limit: number = 10): Promise<LogResult> {
    return await this.git.log({ maxCount: limit });
  }

  public async getCurrentBranch(): Promise<string> {
    const branchData = await this.git.branch();
    return branchData.current;
  }

  public async getBranches(): Promise<BranchSummary> {
    try {
      return await this.git.branch();
    } catch (error) {
      logger.error(`Failed to fetch git branches: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
