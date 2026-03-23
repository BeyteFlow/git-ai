import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

export const ConfigSchema = z.object({
  ai: z.object({
    provider: z.enum(['openai', 'gemini']),
    apiKey: z.string(),
    model: z.string().optional(),
  }),
  github: z.object({
    token: z.string().min(1),
  }).optional(),
  git: z.object({
    autoStage: z.boolean().default(false),
    messagePrefix: z.string().optional(),
  }),
  ui: z.object({
    theme: z.enum(['dark', 'light', 'system']).default('dark'),
    showIcons: z.boolean().default(true),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigService {
  private static readonly CONFIG_PATH = path.join(os.homedir(), '.aigitrc');
  private config: Config | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    if (!fs.existsSync(ConfigService.CONFIG_PATH)) {
      this.config = null;
      return;
    }

    try {
      const rawConfig = JSON.parse(fs.readFileSync(ConfigService.CONFIG_PATH, 'utf-8'));
      this.config = ConfigSchema.parse(rawConfig);
    } catch (error) {
      throw new Error(`Invalid configuration file at ${ConfigService.CONFIG_PATH}: ${error}`);
    }
  }

  public getConfig(): Config {
    if (!this.config) {
      throw new Error("Configuration not initialized. Please run 'ai-git init'.");
    }
    return this.config;
  }

  public saveConfig(newConfig: Config): void {
    const validated = ConfigSchema.parse(newConfig);
    const configPath = ConfigService.CONFIG_PATH;
    const tempPath = path.join(path.dirname(configPath), `.tmp-${process.pid}-${Date.now()}`);
    const fd = fs.openSync(tempPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(validated, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    try {
      fs.renameSync(tempPath, configPath);
    } catch (error) {
      try { fs.unlinkSync(tempPath); } catch { /* best-effort cleanup */ }
      throw error;
    }
    this.config = validated;
  }
}