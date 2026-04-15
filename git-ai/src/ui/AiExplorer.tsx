import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { GitService } from '../core/GitService.js';
import { AiNotesStore } from '../ai/notes-store.js';
import type { AiIndexEntry } from '../ai/schema.js';

type Props = {
  git: GitService;
  store: AiNotesStore;
};

type Row = {
  commit: string;
  entry: AiIndexEntry;
};

export const AiExplorer: React.FC<Props> = ({ git, store }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [details, setDetails] = useState<string>('');
  const [listOffset, setListOffset] = useState(0);

  const rowsRef = useRef<Row[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const selectedRef = useRef(0);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    let alive = true;
    async function load(): Promise<void> {
      try {
        const out = await git.raw(['rev-list', '--max-count=200', 'HEAD']);
        const commits = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const loaded: Row[] = [];

        for (const c of commits) {
          const idx = await store.listIndexForCommit(c);
          for (const entry of idx) loaded.push({ commit: c, entry });
        }

        if (!alive) return;
        setRows(loaded);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [git, store]);

  const selectedRow = useMemo(() => rows[selected] ?? null, [rows, selected]);

  useEffect(() => {
    let alive = true;
    async function loadDetails(): Promise<void> {
      if (!selectedRow) {
        setDetails('');
        return;
      }
      try {
        const rec = await store.getRecord(selectedRow.commit, selectedRow.entry.id);
        if (!alive) return;
        setDetails(rec ? JSON.stringify(rec, null, 2) : '(missing record payload)');
      } catch (e) {
        if (!alive) return;
        setDetails(e instanceof Error ? e.message : String(e));
      }
    }
    loadDetails();
    return () => {
      alive = false;
    };
  }, [selectedRow, store]);

  useEffect(() => {
    // Keep selected row within the visible window.
    const windowSize = 30;
    setListOffset((prev) => {
      const maxStart = Math.max(0, rows.length - windowSize);
      const clampedPrev = Math.min(Math.max(0, prev), maxStart);

      if (selected < clampedPrev) return selected;
      if (selected >= clampedPrev + windowSize) {
        return Math.min(maxStart, selected - windowSize + 1);
      }
      return clampedPrev;
    });
  }, [rows.length, selected]);

  useInput((_input, key) => {
    const current = rowsRef.current;
    if (key.escape || (key.ctrl && _input === 'c')) {
      process.exit(0);
    }
    if (current.length === 0) return;
    if (key.upArrow) {
      setSelected((prev) => (prev > 0 ? prev - 1 : current.length - 1));
    }
    if (key.downArrow) {
      setSelected((prev) => (prev < current.length - 1 ? prev + 1 : 0));
    }
  });

  if (loading) return <Text color="yellow">Loading AI attribution...</Text>;
  if (error) return <Text color="red">❌ {error}</Text>;
  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No AI attribution found.</Text>
        <Text dimColor>Tip: use `ai-git ai record ...` then come back here.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" gap={2}>
      <Box flexDirection="column" width={50} borderStyle="round" borderColor="cyan" padding={1}>
        <Text bold underline>AI Attribution</Text>
        {rows.slice(listOffset, listOffset + 30).map((r, idx) => {
          const i = listOffset + idx;
          const isSelected = i === selected;
          return (
            <Text key={`${r.commit}:${r.entry.id}`} color={isSelected ? 'blue' : undefined}>
              {isSelected ? '❯ ' : '  '}
              {r.commit.substring(0, 8)} {r.entry.provider}/{r.entry.model} {r.entry.intent}
            </Text>
          );
        })}
        <Text dimColor>
          ↑/↓ navigate, Esc exit ({Math.min(rows.length, listOffset + 30)}/{rows.length})
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" padding={1}>
        <Text bold underline>Details</Text>
        <Text>{details}</Text>
      </Box>
    </Box>
  );
};
