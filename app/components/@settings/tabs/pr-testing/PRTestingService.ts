import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';
import type { PullRequest, PRTestingResult } from './types';

interface CloneResponse {
  success: boolean;
  message: string;
  data?: {
    prNumber: number;
    branch: string;
    repoUrl: string;
    repoName: string;
    tempDir: string;
    testResults: string;
  };
}

interface StartResponse {
  success: boolean;
  message: string;
  data?: {
    pid: number;
    prNumber: number;
    tempDir: string;
    startCommand: string;
    port?: number;
  };
}

interface StopResponse {
  success: boolean;
  message: string;
  data?: {
    pid: number;
    prNumber: number;
    tempDir: string;
  };
}

export class PRTestingService {
  private static _instance: PRTestingService;
  private _token: string | null = null;
  private _activeTests: Map<number, { pid?: number; tempDir?: string }> = new Map();
  private _initialized: boolean = false;
  private _initPromise: Promise<void> | null = null;
  private _setupLogs: Map<number, string[]> = new Map();

  private constructor() {
    // Initialize the service
    this._loadToken();
    this._initPromise = this._initialize();
  }

  private async _initialize(): Promise<void> {
    try {
      await this._loadActiveTests();
      this._initialized = true;
    } catch (error) {
      console.error('Failed to initialize PR Testing Service:', error);
    }
  }

  static getInstance(): PRTestingService {
    if (!PRTestingService._instance) {
      PRTestingService._instance = new PRTestingService();
    }

    return PRTestingService._instance;
  }

  private _loadToken(): void {
    try {
      const githubConnection = localStorage.getItem('github_connection');

      if (githubConnection) {
        const { token } = JSON.parse(githubConnection);
        this._token = token;
      }
    } catch (error) {
      logStore.logError('Failed to load GitHub token', { error });
      this._token = null;
    }
  }

  async fetchPullRequests(state: 'all' | 'open' | 'closed' = 'open'): Promise<PullRequest[]> {
    this._loadToken();

    if (!this._token) {
      toast.error('GitHub token not found. Please connect your GitHub account first.');
      return [];
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/stackblitz-labs/bolt.diy/pulls?state=${state}&per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${this._token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch pull requests: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError('Failed to fetch pull requests', { error });
      throw error;
    }
  }

  async fetchPullRequestDetails(prNumber: number): Promise<PullRequest> {
    this._loadToken();

    if (!this._token) {
      toast.error('GitHub token not found. Please connect your GitHub account first.');
      throw new Error('GitHub token not found');
    }

    try {
      const response = await fetch(`https://api.github.com/repos/stackblitz-labs/bolt.diy/pulls/${prNumber}`, {
        headers: {
          Authorization: `Bearer ${this._token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pull request details: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError('Failed to fetch pull request details', { error, prNumber });
      throw error;
    }
  }

  async testPullRequest(pr: PullRequest): Promise<PRTestingResult> {
    try {
      await this.ensureInitialized();

      // Check if there's already an active test for this PR
      if (this._activeTests.has(pr.number)) {
        return {
          success: false,
          message: `A test is already running for PR #${pr.number}`,
        };
      }

      // Initialize setup logs for this PR
      this._setupLogs.set(pr.number, []);
      this._addSetupLog(pr.number, `Starting test for PR #${pr.number}: ${pr.title}`);

      // Clone the PR
      this._addSetupLog(pr.number, `Cloning repository from ${pr.head.repo.clone_url}...`);

      const cloneResponse = await this._clonePR(pr);

      if (!cloneResponse.success || !cloneResponse.data) {
        this._addSetupLog(pr.number, `Failed to clone PR: ${cloneResponse.message}`);
        return {
          success: false,
          message: cloneResponse.message,
        };
      }

      this._addSetupLog(pr.number, `Successfully cloned PR to ${cloneResponse.data.tempDir}`);

      // Start the application
      this._addSetupLog(pr.number, `Starting application...`);

      const startResponse = await this._startApp(pr.number, cloneResponse.data.tempDir);

      if (!startResponse.success || !startResponse.data) {
        this._addSetupLog(pr.number, `Failed to start application: ${startResponse.message}`);
        return {
          success: false,
          message: startResponse.message,
        };
      }

      this._addSetupLog(pr.number, `Application started successfully with PID ${startResponse.data.pid}`);

      if (startResponse.data.port) {
        this._addSetupLog(pr.number, `Server running at http://localhost:${startResponse.data.port}`);
      }

      // Store the active test
      this._activeTests.set(pr.number, {
        pid: startResponse.data.pid,
        tempDir: startResponse.data.tempDir,
      });

      return {
        success: true,
        message: `Successfully started test for PR #${pr.number}`,
        data: {
          pid: startResponse.data.pid,
          tempDir: startResponse.data.tempDir,
          port: startResponse.data.port,
        },
      };
    } catch (error) {
      this._addSetupLog(pr.number, `Error testing PR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logStore.logError('Failed to test PR', { error, pr });

      return {
        success: false,
        message: `Failed to test PR #${pr.number}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async stopTest(prNumber: number): Promise<PRTestingResult> {
    try {
      await this.ensureInitialized();

      const activeTest = this._activeTests.get(prNumber);

      if (!activeTest || !activeTest.pid || !activeTest.tempDir) {
        return {
          success: false,
          message: `No active test found for PR #${prNumber}`,
        };
      }

      const stopResponse = await this._stopApp(prNumber, activeTest.pid, activeTest.tempDir);

      if (!stopResponse.success) {
        return {
          success: false,
          message: stopResponse.message,
        };
      }

      // Remove the active test
      this._activeTests.delete(prNumber);

      return {
        success: true,
        message: `Successfully stopped test for PR #${prNumber}`,
      };
    } catch (error) {
      logStore.logError('Failed to stop test', { error, prNumber });
      return {
        success: false,
        message: `Failed to stop test for PR #${prNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async _clonePR(pr: PullRequest): Promise<CloneResponse> {
    try {
      // Log the request for debugging
      console.log('Cloning PR:', {
        prNumber: pr.number,
        branch: pr.head.ref,
        repoUrl: pr.head.repo.clone_url,
        repoName: pr.head.repo.full_name,
      });

      const response = await fetch('/api/pr-testing/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prNumber: pr.number,
          branch: pr.head.ref,
          repoUrl: pr.head.repo.clone_url,
          repoName: pr.head.repo.full_name,
        }),
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server responded with ${response.status}: ${text}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError('Failed to clone PR', { error, pr });
      return {
        success: false,
        message: `Failed to clone PR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async _startApp(prNumber: number, tempDir: string): Promise<StartResponse> {
    try {
      console.log('Starting app:', { prNumber, tempDir });

      const response = await fetch('/api/pr-testing/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prNumber,
          tempDir,
        }),
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server responded with ${response.status}: ${text}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError('Failed to start application', { error, prNumber, tempDir });
      return {
        success: false,
        message: `Failed to start application: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async _stopApp(prNumber: number, pid: number, tempDir: string): Promise<StopResponse> {
    try {
      console.log('Stopping app:', { prNumber, pid, tempDir });

      const response = await fetch('/api/pr-testing/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prNumber,
          pid,
          tempDir,
        }),
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server responded with ${response.status}: ${text}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError('Failed to stop application', { error, prNumber, pid, tempDir });
      return {
        success: false,
        message: `Failed to stop application: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async fetchPRCommits(pr: PullRequest): Promise<any[]> {
    this._loadToken();

    if (!this._token) {
      toast.error('GitHub token not found. Please connect your GitHub account first.');
      return [];
    }

    try {
      const response = await fetch(`https://api.github.com/repos/stackblitz-labs/bolt.diy/pulls/${pr.number}/commits`, {
        headers: {
          Authorization: `Bearer ${this._token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PR commits: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError('Failed to fetch PR commits', { error, pr });
      throw error;
    }
  }

  async fetchPRFiles(pr: PullRequest): Promise<any[]> {
    this._loadToken();

    if (!this._token) {
      toast.error('GitHub token not found. Please connect your GitHub account first.');
      return [];
    }

    try {
      const response = await fetch(`https://api.github.com/repos/stackblitz-labs/bolt.diy/pulls/${pr.number}/files`, {
        headers: {
          Authorization: `Bearer ${this._token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PR files: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError('Failed to fetch PR files', { error, pr });
      throw error;
    }
  }

  async isTestActive(prNumber: number): Promise<boolean> {
    await this.ensureInitialized();
    return this._activeTests.has(prNumber);
  }

  async getActiveTest(prNumber: number): Promise<{ pid?: number; tempDir?: string } | undefined> {
    await this.ensureInitialized();
    return this._activeTests.get(prNumber);
  }

  async _loadActiveTests(): Promise<void> {
    try {
      const response = await fetch('/api/pr-testing/active-tests');

      if (!response.ok) {
        throw new Error(`Failed to load active tests: ${response.statusText}`);
      }

      const activeTests = (await response.json()) as {
        success: boolean;
        data?: Array<{
          prNumber: number;
          pid: number;
          tempDir: string;
          port: number;
        }>;
      };

      if (activeTests.success && activeTests.data) {
        // Clear existing active tests
        this._activeTests.clear();

        // Add active tests from server
        activeTests.data.forEach((test) => {
          this._activeTests.set(test.prNumber, {
            pid: test.pid,
            tempDir: test.tempDir,
          });
        });

        console.log('Loaded active tests:', this._activeTests);
      }
    } catch (error) {
      logStore.logError('Failed to load active tests', { error });
      console.error('Failed to load active tests:', error);
    }
  }

  async getServerInfo(prNumber: number): Promise<{ port: number; url: string; pid: number; tempDir: string } | null> {
    try {
      const response = await fetch(`/api/pr-testing/server-info/${prNumber}`);

      if (!response.ok) {
        throw new Error(`Failed to get server info: ${response.statusText}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: {
          port: number;
          pid: number;
          tempDir: string;
        };
      };

      if (result.success && result.data) {
        return {
          port: result.data.port,
          url: `http://localhost:${result.data.port}`,
          pid: result.data.pid,
          tempDir: result.data.tempDir,
        };
      }

      return null;
    } catch (error) {
      logStore.logError('Failed to get server info', { error, prNumber });
      console.error('Failed to get server info:', error);

      return null;
    }
  }

  async ensureInitialized(): Promise<void> {
    if (!this._initialized && this._initPromise) {
      await this._initPromise;
    }
  }

  private _addSetupLog(prNumber: number, message: string): void {
    const logs = this._setupLogs.get(prNumber) || [];
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
    this._setupLogs.set(prNumber, logs);
    console.log(`PR #${prNumber}: ${message}`);

    // Also send the log to the server
    this._sendLogToServer(prNumber, message).catch((error) => {
      console.error('Failed to send log to server:', error);
    });
  }

  private async _sendLogToServer(prNumber: number, message: string): Promise<void> {
    try {
      const response = await fetch('/api/pr-testing/add-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prNumber,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send log to server: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending log to server:', error);
    }
  }

  async getSetupLogs(prNumber: number): Promise<string[]> {
    // First, return any in-memory logs we have
    const inMemoryLogs = this._setupLogs.get(prNumber) || [];

    // Then try to fetch logs from the server
    try {
      const response = await fetch(`/api/pr-testing/setup-logs/${prNumber}`);

      if (!response.ok) {
        return inMemoryLogs;
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: string[];
      };

      if (result.success && result.data) {
        // Merge server logs with in-memory logs, avoiding duplicates
        const serverLogs = result.data;
        const allLogs = new Set([...serverLogs, ...inMemoryLogs]);

        // Update in-memory logs
        this._setupLogs.set(prNumber, [...allLogs]);

        return [...allLogs];
      }

      return inMemoryLogs;
    } catch (error) {
      console.error('Failed to get setup logs from server:', error);
      return inMemoryLogs;
    }
  }
}
