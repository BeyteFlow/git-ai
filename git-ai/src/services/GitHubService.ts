import { Octokit } from "@octokit/rest";
import { ConfigService } from "./ConfigService.js";
import { logger } from "../utils/logger.js";

export interface PullRequestMetadata {
    id: number;
    number: number;
    title: string;
    author: string;
    branch: string;
    base: string;
    state: string;
    url: string;
    isMergeable: boolean | null;
}

export class GitHubService {
    private octokit: Octokit;
    private owner: string = "";
    private repo: string = "";

    constructor(configService: ConfigService, repoUrl: string) {
        const config = configService.getConfig();
        const githubToken = config.github?.token;
        if (!githubToken) {
            throw new Error("GitHub token is missing in configuration. Set github.token in .aigitrc.");
        }

        this.octokit = new Octokit({
            auth: githubToken,
        });

        this.parseRepoInfo(repoUrl);
    }

    /**
     * Strips credentials (userinfo) from a URL for safe logging.
     */
    private sanitizeUrl(url: string): string {
        try {
            // Handle SSH-style git URLs like git@github.com:owner/repo.git
            const sshMatch = url.match(/^[^@]+@([^:]+):(.+)$/);
            if (sshMatch) {
                return `${sshMatch[1]}:${sshMatch[2]}`;
            }
            const parsed = new URL(url);
            parsed.username = '';
            parsed.password = '';
            return parsed.toString();
        } catch {
            // If URL parsing fails, return a placeholder
            return '[unparseable URL]';
        }
    }

    /**
     * Extracts owner and repo name from a git remote URL
     */
    private parseRepoInfo(url: string): void {
        const match = url.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
        if (match) {
            this.owner = match[1];
            this.repo = match[2];
        } else {
            logger.error(`Could not parse GitHub owner/repo from remote URL: ${this.sanitizeUrl(url)}`);
            throw new Error("Invalid GitHub remote URL. Expected github.com/<owner>/<repo>.");
        }

        if (!this.owner || !this.repo) {
            logger.error(`Parsed empty GitHub owner/repo from remote URL: ${this.sanitizeUrl(url)}`);
            throw new Error("Could not determine GitHub owner and repository from remote URL.");
        }
    }

    /**
     * Lists all open pull requests for the current repository.
     * Note: pulls.list does not provide mergeability; isMergeable is set to null.
     */
    public async listOpenPRs(): Promise<PullRequestMetadata[]> {
        try {
            const { data } = await this.octokit.pulls.list({
                owner: this.owner,
                repo: this.repo,
                state: "open",
            });

            return data.map((pr) => ({
                id: pr.id,
                number: pr.number,
                title: pr.title,
                author: pr.user?.login || "unknown",
                branch: pr.head.ref,
                base: pr.base.ref,
                state: pr.state,
                url: pr.html_url,
                isMergeable: null,
            }));
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error(
                    { err: error, owner: this.owner, repo: this.repo },
                    "Failed to fetch Pull Requests"
                );
            } else {
                logger.error(
                    { err: error, owner: this.owner, repo: this.repo },
                    "Failed to fetch Pull Requests (non-Error thrown)"
                );
            }

            throw new Error("GitHub API request failed.");
        }
    }

    /**
     * Merges a Pull Request
     */
    public async mergePR(
        prNumber: number,
        method: "merge" | "squash" | "rebase" = "merge",
    ): Promise<boolean> {
        try {
            const { data } = await this.octokit.pulls.merge({
                owner: this.owner,
                repo: this.repo,
                pull_number: prNumber,
                merge_method: method,
            });

            return data.merged;
        } catch (error) {
            logger.error(
                `Failed to merge PR #${prNumber}: ${error instanceof Error ? error.message : String(error)}`,
            );
            return false;
        }
    }
}
