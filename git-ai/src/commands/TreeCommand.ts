import React from 'react';
import { render } from 'ink';
import { GitService } from '../core/GitService.js';
import { TreeUI } from '../ui/TreeUI.js';

export async function treeCommand() {
  const gitService = new GitService();
  
  const { waitUntilExit } = render(
    React.createElement(TreeUI, { gitService })
  );

  await waitUntilExit();
}