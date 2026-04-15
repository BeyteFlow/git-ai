import React from 'react';
import { render } from 'ink';
import { GitService } from '../core/GitService.js';
import { ConfigService } from '../services/ConfigService.js';
import { GitHubService, PullRequestMetadata } from '../services/GitHubService.js';
import { PRList } from '../ui/PRList.js';
import { logger } from '../utils/logger.js';

/**
 * Orchestrates the Interactive PR Selection UI
 */
export async function runPRCommand(): Promise<void> {
  try {
    const configService = new ConfigService();
    const gitService = new GitService();

    // 1. Get the remote URL to identify the GitHub repository
    const remotes = await gitService.getRemotes(true);
    const origin = remotes.find((r: any) => r.name === 'origin');

    if (!origin || !origin.refs.fetch) {
      console.error('❌ Error: No remote "origin" found. Ensure your repo is hosted on GitHub.');
      process.exit(1);
    }

    const githubService = new GitHubService(configService, origin.refs.fetch);

    // 2. Launch the Ink TUI
    const renderInstance = render(
      React.createElement(PRList, {
        githubService,
        onSelect: (pr: PullRequestMetadata) => {
          console.log('\n-----------------------------------');
          console.log(`🚀 Selected PR: #${pr.number}`);
          console.log(`🔗 URL: ${pr.url}`);
          console.log(`🌿 Branch: ${pr.branch} -> ${pr.base}`);
          console.log('-----------------------------------\n');
          // In a future update, we can trigger gitService.checkout(pr.branch)
          renderInstance.unmount();
        }
      })
    );

    // 3. Await clean exit
    await renderInstance.waitUntilExit();
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to initialize PR command');
    console.error('❌ Critical Error: Could not launch PR interface.');
    process.exit(1);
  }
}
