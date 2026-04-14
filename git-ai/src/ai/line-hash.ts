import { createHash } from 'crypto';

export function normalizeLineForHash(line: string): string {
  // Normalize whitespace only; avoid language-specific parsing.
  return line.replace(/\s+/g, ' ').trim();
}

export function hashLine(line: string): string {
  return createHash('sha256').update(normalizeLineForHash(line), 'utf8').digest('hex');
}

export function hashLines(lines: string[]): string[] {
  return lines
    .map(hashLine)
    .filter((h) => h.length > 0);
}
