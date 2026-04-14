import { createHash } from 'crypto';

export function normalizeLineForHash(line: string): string {
  // Normalize whitespace only; avoid language-specific parsing.
  return line.replace(/\s+/g, ' ').trim();
}

export function hashLine(line: string): string {
  return createHash('sha256').update(normalizeLineForHash(line), 'utf8').digest('hex');
}

export function hashLines(lines: string[]): string[] {
  // Filter blank lines after normalization so we don't waste anchors on whitespace-only content.
  return lines
    .map((l) => normalizeLineForHash(l))
    .filter((l) => l.length > 0)
    .map((l) => createHash('sha256').update(l, 'utf8').digest('hex'));
}
