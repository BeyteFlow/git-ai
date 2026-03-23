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
  // Suppress character echoing: only allow the initial prompt to be written
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

export async function initCommand() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('🚀 Welcome to AI-Git-Terminal Setup\n');

  try {
    let apiKey = '';
    while (!apiKey) {
      const apiKeyInput = await readSecretInput(rl, '🔑 Enter your Gemini API Key: ');
      apiKey = apiKeyInput.trim();
      if (!apiKey) {
        console.error('❌ API key cannot be empty. Please enter a valid key.');
      }
    }

    const modelInput = await rl.question('🤖 Enter model name (default: gemini-1.5-flash): ');
    const model = modelInput.trim() || 'gemini-1.5-flash';

    const newConfig: Config = {
      ai: {
        provider: 'gemini',
        apiKey,
        model: model,
      },
      git: {
        autoStage: false,
      },
      ui: {
        theme: 'dark',
        showIcons: true,
      },
    };

    // Validate with Zod and persist with restricted permissions (mode 0o600)
    ConfigSchema.parse(newConfig);

    const configPath = path.join(os.homedir(), '.aigitrc');

    if (fs.existsSync(configPath)) {
      const overwriteChoice = (await rl.question(
        '⚠️ Existing config found. Choose [o]verwrite, [b]ackup then replace, or [c]ancel: '
      )).trim().toLowerCase();

      if (overwriteChoice === 'b' || overwriteChoice === 'backup') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${configPath}.bak-${timestamp}`;
        fs.renameSync(configPath, backupPath);
        console.log(`📦 Existing config backed up to ${backupPath}`);
      } else if (overwriteChoice === 'o' || overwriteChoice === 'overwrite') {
        console.log('📝 Overwriting existing config file.');
      } else {
        console.log('🚫 Initialization canceled. Existing config left unchanged.');
        return;
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), { mode: 0o600 });
    fs.chmodSync(configPath, 0o600);

    console.log(`\n✅ Configuration saved to ${configPath}`);
    console.log('Try running: ai-git commit');
  } catch (error) {
    logger.error('Failed to save configuration: ' + (error instanceof Error ? error.message : String(error)));
    console.error('\n❌ Invalid input or failed to write config file.');
  } finally {
    rl.close();
  }
}