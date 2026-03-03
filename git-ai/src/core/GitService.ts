import { simpleGit, SimpleGit, StatusResult, LogResult } from 'simple-git';
import { logger } from './../utils/logger.js';

export class GitService {
  private git: SimpleGit;

  constructor(workingDir: string = process.cwd()) {
    this.git = simpleGit(workingDir);
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
}