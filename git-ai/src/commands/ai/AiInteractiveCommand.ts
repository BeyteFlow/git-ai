import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { GitService } from '../../core/GitService.js';
import { AiNotesStore } from '../../ai/notes-store.js';
import { AiExplorer } from '../../ui/AiExplorer.js';

export function buildAiInteractiveCommand(): Command {
  const cmd = new Command('explore')
    .description('Interactive exploration mode for AI attribution')
    .action(async () => {
      const git = new GitService();
      const store = new AiNotesStore(git);

      const { waitUntilExit } = render(React.createElement(AiExplorer, { git, store }));
      await waitUntilExit();
    });

  return cmd;
}
