import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline/promises';
import { ConfigSchema, Config } from '../services/ConfigService.js';
import { logger } from '../utils/logger.js';

/**
 * Reads a secret/password from the terminal without echoing characters.
 * Falls back to normal readline if stdin is not a TTY (e.g. piped input).
 */
async function readSecretInput(rl: readline.Interface, prompt: string): Promise<string> {
  const rlAny = rl as any;
  const originalWrite = rlAny._writeToOutput;
  let promptWritten = false;
  rlAny._writeToOutput = function _writeToOutput(str: string) {
    if (!promptWritten) {
      promptWritten = true;
      process.stdout.write(str);
    }
    // Suppress all subsequent echoed characters
  };
  try {
    return await rl.question(prompt);
  } finally {
    process.stdout.write('\n');
    rlAny._writeToOutput = originalWrite;
  }
}

/**
 * Atomically writes content to filePath using a temp file + fsync + rename,
 * ensuring the file has permissions 0o600.
 */
function atomicWriteFileSync(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.tmp-${process.pid}-${Date.now()}`);
  const fd = fs.openSync(tempPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try {
    try {
      fs.writeFileSync(fd, content);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try { fs.unlinkSync(tempPath); } catch { /* best-effort cleanup */ }
    throw error;
  }
}

export async function initCommand() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('🚀 Welcome to AI-Git-Terminal Setup\n');

  try {
    // --- Step 1: Read API Key ---
    let apiKey = '';
    while (!apiKey) {
      const apiKeyInput = await readSecretInput(rl, '🔑 Enter your Gemini API Key: ');
      apiKey = apiKeyInput.trim();
      if (!apiKey) {
        console.error('❌ API key cannot be empty. Please enter a valid key.');
      }
    }

    // --- Step 2: Read model name ---
    const modelInput = await rl.question('🤖 Enter model name (default: gemini-1.5-flash): ');
    const model = modelInput.trim() || 'gemini-1.5-flash';

    // --- Step 3: Build config object ---
    const newConfig: Config = {
      ai: { provider: 'gemini', apiKey, model },
      git: { autoStage: false },
      ui: { theme: 'dark', showIcons: true },
    };

    // Validate with Zod
    ConfigSchema.parse(newConfig);

    const configPath = path.join(os.homedir(), '.aigitrc');

    // --- Step 4: Attempt atomic creation ---
    try {
      const fd = fs.openSync(configPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR, 0o600);
      try {
        fs.writeFileSync(fd, JSON.stringify(newConfig, null, 2));
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      console.log(`\n✅ Configuration saved to ${configPath}`);
      console.log('Try running: ai-git commit');
      return;
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
      // File already exists, proceed to backup/overwrite prompt
    }

    // --- Step 5: Handle existing file ---
    const overwriteChoice = (await rl.question(
      '⚠️ Existing config found. Choose [o]verwrite, [b]ackup then replace, or [c]ancel: '
    )).trim().toLowerCase();

    if (overwriteChoice === 'b' || overwriteChoice === 'backup') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${configPath}.bak-${timestamp}`;
      fs.renameSync(configPath, backupPath);
      console.log(`📦 Existing config backed up to ${backupPath}`);
      atomicWriteFileSync(configPath, JSON.stringify(newConfig, null, 2));
    } else if (overwriteChoice === 'o' || overwriteChoice === 'overwrite') {
      atomicWriteFileSync(configPath, JSON.stringify(newConfig, null, 2));
      console.log('📝 Overwriting existing config file.');
    } else {
      console.log('🚫 Initialization canceled. Existing config left unchanged.');
      return;
    }

    console.log(`\n✅ Configuration saved to ${configPath}`);
    console.log('Try running: ai-git commit');

  } catch (error) {
    logger.error('Failed to save configuration: ' + (error instanceof Error ? error.message : String(error)));
    console.error('\n❌ Invalid input or failed to write config file.');
  } finally {
    rl.close();
  }
}
