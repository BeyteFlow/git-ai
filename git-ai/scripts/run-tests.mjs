import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await collectTestFiles(p)));
    } else if (e.isFile() && e.name.endsWith('.test.js')) {
      files.push(p);
    }
  }
  return files;
}

const testFiles = await collectTestFiles(distDir);

if (testFiles.length === 0) {
  console.error('No test files found in dist. Expected at least one *.test.js');
  process.exitCode = 1;
} else {
  const child = spawn(process.execPath, ['--test', ...testFiles], {
    stdio: 'inherit',
    cwd: projectRoot,
  });

  const code = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  process.exitCode = typeof code === 'number' ? code : 1;
}
