import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import archy from 'archy';
import { GitService } from '../core/GitService.js';
import { logger } from '../utils/logger.js';

interface TreeUIProps {
  gitService: GitService;
}

export const TreeUI: React.FC<TreeUIProps> = ({ gitService }) => {
  const [treeOutput, setTreeOutput] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function buildTree() {
      try {
        const branchData = await gitService.getBranches();
        const currentBranch = branchData.current;
        
        // Structure for archy
        const data = {
          label: `📦 Project Root (${currentBranch})`,
          nodes: Object.values(branchData.branches).map((branch) => ({
            label: branch.current ? `● ${branch.name} (current)` : `○ ${branch.name}`,
            nodes: [
              { label: `ID: ${branch.commit?.substring(0, 7) ?? ''}` }
            ]
          }))
        };

        setTreeOutput(archy(data));
        setError(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
        logger.error(error, 'Failed to build tree UI');
      } finally {
        setLoading(false);
      }
    }

    buildTree();
  }, [gitService]);

  if (loading) return <Text color="yellow">⏳ Mapping branches...</Text>;
  if (error) return <Text color="red">❌ Failed to build branch tree: {error}</Text>;

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="magenta" bold>Git Branch Visualization</Text>
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text>{treeOutput}</Text>
      </Box>
      <Text dimColor>Hint: Use "ai-git prs" to see remote PRs for these branches.</Text>
    </Box>
  );
};