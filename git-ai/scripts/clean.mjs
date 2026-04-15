import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const target = process.argv[2] || 'dist';

const allowed = new Set(['dist', 'dist-test']);
if (!allowed.has(target)) {
  console.error(`Refusing to delete unknown path: ${target}`);
  process.exitCode = 1;
} else {
  await rm(join(projectRoot, target), { recursive: true, force: true });
}
