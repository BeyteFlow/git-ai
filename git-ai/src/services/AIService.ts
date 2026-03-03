import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { ConfigService } from "./ConfigService.js";
import { logger } from "../utils/logger.js";

export interface AIProvider {
  generateCommitMessage(diff: string): Promise<string>;
  analyzeConflicts(conflictFileContents: Record<string, string>): Promise<string>;
  generateContent(prompt: string): Promise<string>;
}

export class AIService implements AIProvider {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.initClient();
  }

  private initClient(): void {
    const config = this.configService.getConfig();

    // Ensure we only init if the provider is gemini
    if (config.ai.provider === "gemini") {
      if (!config.ai.apiKey) {
        throw new Error("Gemini API Key is missing in .aigitrc");
      }

      this.genAI = new GoogleGenerativeAI(config.ai.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: config.ai.model || "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 200,
        },
      });
    }
  }

  /**
   * Generates a conventional commit message based on git diff
   */
  public async generateCommitMessage(diff: string): Promise<string> {
    if (!this.model) {
      throw new Error("Gemini AI model not initialized. Check your config.");
    }

    const prompt = `
      You are an expert software engineer.
      Generate a professional, concise conventional commit message based on this git diff:
      
      "${diff}"
      
      Instructions:
      1. Use the format: <type>(<scope>): <description>
      2. Common types: feat, fix, docs, style, refactor, test, chore.
      3. Description should be in present tense and lowercase.
      4. Return ONLY the commit message text.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Clean up potential markdown formatting if Gemini returns backticks
      return text.replace(/`/g, "");
    } catch (error) {
      logger.error(
        `Gemini API Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error("Failed to generate commit message via Gemini.");
    }
  }

  /**
   * Analyzes merge conflicts and suggests resolutions
   */
  public async analyzeConflicts(conflictFileContents: Record<string, string>): Promise<string> {
    if (!this.model) throw new Error("AI Service not ready");

    const conflictsWithContent = Object.entries(conflictFileContents)
      .map(([fileName, content]) => `FILE: ${fileName}\n${content}`)
      .join("\n\n");

    const prompt = `Analyze the following files currently in a git conflict state and provide a high-level summary of the clashing changes. Include key differences and likely intent from both sides of each conflict marker block.\n\n${conflictsWithContent}`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      logger.error(
        `Conflict Analysis Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "Could not analyze conflicts at this time.";
    }
  }

  public async generateContent(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error("Gemini AI model not initialized. Check your config.");
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        `AI generateContent Error: ${errorMsg}`,
      );
      throw new Error("Failed to generate content via AI service.");
    }
  }
}
