import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline/promises';
import { ConfigSchema, Config } from '../services/ConfigService.js';
import { logger } from '../utils/logger.js';

export async function initCommand() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('🚀 Welcome to AI-Git-Terminal Setup\n');

  try {
    const apiKey = await rl.question('🔑 Enter your Gemini API Key: ');
    const modelInput = await rl.question('🤖 Enter model name (default: gemini-1.5-flash): ');
    const model = modelInput.trim() || 'gemini-1.5-flash';

    const newConfig: Config = {
      ai: {
        provider: 'gemini',
        apiKey: apiKey.trim(),
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

    // Validate with Zod
    ConfigSchema.parse(newConfig);

    const configPath = path.join(os.homedir(), '.aigitrc');
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    console.log(`\n✅ Configuration saved to ${configPath}`);
    console.log('Try running: ai-git commit');
  } catch (error) {
    logger.error('Failed to save configuration: ' + (error instanceof Error ? error.message : String(error)));
    console.error('\n❌ Invalid input or failed to write config file.');
  } finally {
    rl.close();
  }
}