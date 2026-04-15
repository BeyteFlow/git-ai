import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { GitHubService, PullRequestMetadata } from '../services/GitHubService.js';

interface PRListProps {
  githubService: GitHubService;
  onSelect: (pr: PullRequestMetadata) => void;
}

export const PRList: React.FC<PRListProps> = ({ githubService, onSelect }) => {
  const [prs, setPrs] = useState<PullRequestMetadata[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prsRef = useRef<PullRequestMetadata[]>([]);
  const selectedIndexRef = useRef(0);

  useEffect(() => {
    prsRef.current = prs;
  }, [prs]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    async function fetchPRs() {
      try {
        const data = await githubService.listOpenPRs();
        setPrs(data);
      } catch (err) {
        setError('Failed to load Pull Requests');
      } finally {
        setLoading(false);
      }
    }
    fetchPRs();
  }, [githubService]);

  useInput((_input, key) => {
    const currentPrs = prsRef.current;
    if (currentPrs.length === 0) {
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => {
        const nextIndex = prev > 0 ? prev - 1 : currentPrs.length - 1;
        return Math.max(0, Math.min(nextIndex, currentPrs.length - 1));
      });
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => {
        const nextIndex = prev < currentPrs.length - 1 ? prev + 1 : 0;
        return Math.max(0, Math.min(nextIndex, currentPrs.length - 1));
      });
    }
    if (key.return) {
      const currentIndex = selectedIndexRef.current;
      if (currentIndex >= 0 && currentIndex < currentPrs.length) {
        onSelect(currentPrs[currentIndex]);
      }
    }
  });

  if (loading) return <Text color="yellow">Loading Pull Requests...</Text>;
  if (error) return <Text color="red">{error}</Text>;
  if (prs.length === 0) return <Text italic>No open Pull Requests found.</Text>;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline color="cyan">Open Pull Requests</Text>
      </Box>
      
      {prs.map((pr, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={pr.id}>
            <Text color={isSelected ? 'blue' : 'white'}>
              {isSelected ? '❯ ' : '  '}
              <Text bold={isSelected}>
                #{pr.number} {pr.title}
              </Text>
              <Text color="gray"> ({pr.author})</Text>
            </Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text dimColor>Use Up/Down to navigate, Enter to select</Text>
      </Box>
    </Box>
  );
};
