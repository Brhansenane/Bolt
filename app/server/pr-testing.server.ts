/**
 * @server-only
 *
 * @file Server-side module for PR testing
 * This file contains server-only code and should not be imported in browser contexts
 */

import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import { path } from './path.server';
import * as os from 'os';

// Helper function to execute shell commands
export const execPromise = (command: string, options: any = {}): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${error.message}\n${stderr}`));
        return;
      }

      resolve(stdout.toString());
    });
  });
};

export interface ClonePRParams {
  prNumber: number;
  branch: string;
  repoUrl: string;
  repoName: string;
}

export interface StartAppParams {
  tempDir: string;
  prNumber: number;
}

export interface StopAppParams {
  pid: number;
  tempDir: string;
  prNumber: number;
}

export async function clonePR(params: ClonePRParams) {
  const { prNumber, branch, repoUrl, repoName } = params;

  // Create a temporary directory for the PR
  const tempDir = path.join(os.tmpdir(), `pr-${prNumber}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  console.log(`Created temporary directory: ${tempDir}`);

  try {
    // Clone the repository
    console.log(`Cloning repository: ${repoUrl} to ${tempDir}`);
    await execPromise(`git clone ${repoUrl} ${tempDir}`);

    // Navigate to the repository directory
    const originalDir = process.cwd();

    process.chdir(tempDir);

    try {
      // Fetch the PR branch
      console.log(`Fetching PR branch: ${branch}`);
      await execPromise(`git fetch origin ${branch}:pr-${prNumber}`);

      // Checkout the PR branch
      console.log(`Checking out PR branch: pr-${prNumber}`);
      await execPromise(`git checkout pr-${prNumber}`);

      // Install dependencies if package.json exists
      let testResults = 'No tests found';

      if (fs.existsSync(path.join(tempDir, 'package.json'))) {
        console.log('Installing dependencies');
        await execPromise('npm install');

        // Run tests if available
        const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));

        if (packageJson.scripts && packageJson.scripts.test) {
          console.log('Running tests');

          try {
            testResults = await execPromise('npm test');
          } catch (error) {
            testResults = `Tests failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }

      // Return to the original directory
      process.chdir(originalDir);

      return {
        success: true,
        message: `Successfully cloned and set up PR #${prNumber}`,
        data: {
          prNumber,
          branch,
          repoUrl,
          repoName,
          tempDir,
          testResults,
        },
      };
    } finally {
      // Make sure we return to the original directory even if an error occurs
      process.chdir(originalDir);
    }
  } catch (error) {
    console.error('Error testing PR:', error);

    return {
      success: false,
      message: `Failed to test PR: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function startApp(params: StartAppParams) {
  const { tempDir, prNumber } = params;

  try {
    // Check if the directory exists
    if (!fs.existsSync(tempDir)) {
      return {
        success: false,
        message: `Directory not found: ${tempDir}`,
      };
    }

    // Create .pr-testing directory if it doesn't exist
    const prTestingDir = path.join(os.tmpdir(), '.pr-testing');

    if (!fs.existsSync(prTestingDir)) {
      fs.mkdirSync(prTestingDir, { recursive: true });
    }

    // Navigate to the repository directory
    const originalDir = process.cwd();

    process.chdir(tempDir);

    try {
      // Start the application
      console.log('Starting application with command: npm run dev');

      // Use a fixed port for the PR test (5174 for the first PR, increment for others)
      const port = 5174;

      // Set environment variables for the PR test
      const env = {
        ...process.env,
        PORT: port.toString(),
        PR_TEST: 'true',
        PR_NUMBER: prNumber.toString(),
      };

      // Start the application as a detached process
      const child = spawn('npm', ['run', 'dev'], {
        env,
        detached: true,
        stdio: 'ignore',
      });

      // Get the process ID
      const pid = child.pid;

      // Unref the child to allow the parent to exit
      child.unref();

      // Create a .pr-testing directory if it doesn't exist
      const prTestingDir = path.join(os.tmpdir(), '.pr-testing');

      if (!fs.existsSync(prTestingDir)) {
        fs.mkdirSync(prTestingDir, { recursive: true });
      }

      // Write process info to a file for tracking
      const processInfo = {
        pid,
        prNumber,
        tempDir,
        startCommand: 'npm run dev',
        port: 5174, // Fixed port for the first PR
        setupLogs: [], // Initialize empty setup logs array
      };

      fs.writeFileSync(path.join(prTestingDir, `pr-${prNumber}.json`), JSON.stringify(processInfo, null, 2), 'utf-8');

      // Return to the original directory
      process.chdir(originalDir);

      return {
        success: true,
        message: `Successfully started application for PR #${prNumber}`,
        data: {
          pid,
          prNumber,
          tempDir,
          startCommand: 'npm run dev',
          port: 5174, // Return the port in the response
        },
      };
    } catch (error) {
      // Return to the original directory in case of error
      process.chdir(originalDir);
      throw error;
    }
  } catch (error) {
    console.error('Error starting application:', error);

    return {
      success: false,
      message: `Failed to start application: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function stopApp(params: StopAppParams) {
  const { pid, tempDir, prNumber } = params;

  try {
    console.log(`Stopping app for PR #${prNumber} with PID ${pid} in ${tempDir}`);

    // First, try to kill all child processes
    try {
      // For Unix-like systems (macOS, Linux)
      if (process.platform !== 'win32') {
        try {
          // On macOS, find and kill the process listening on the PR port (5174)
          console.log(`Checking for processes on port 5174 for PR #${prNumber}`);
          await execPromise(`lsof -i :5174 -t | xargs -r kill -9`).catch((error) => {
            console.log(`lsof/kill command failed: ${error.message}`);
          });

          // Try to kill the process tree using pkill
          await execPromise(`pkill -P ${pid}`).catch((error) => {
            console.log(`pkill command failed: ${error.message}`);
          });

          // Try to kill the process tree using ps and kill
          await execPromise(`ps -o pid --ppid ${pid} --no-headers | xargs -r kill -9`).catch((error) => {
            console.log(`ps/kill command failed: ${error.message}`);
          });

          // Kill the main process with SIGKILL
          try {
            process.kill(pid, 'SIGKILL');
            console.log(`Sent SIGKILL to process with PID: ${pid}`);
          } catch (killError: unknown) {
            const errorMessage = killError instanceof Error ? killError.message : String(killError);
            console.log(`Failed to kill process with PID ${pid}: ${errorMessage}`);
          }
        } catch (error) {
          console.log(`Error killing child processes: ${error}`);
        }
      } else {
        // For Windows
        try {
          await execPromise(`taskkill /F /T /PID ${pid}`).catch((error) => {
            console.log(`taskkill command failed: ${error.message}`);
          });
        } catch (error) {
          console.log(`Error killing process tree: ${error}`);
        }
      }
    } catch (error) {
      console.log(`Error during process termination: ${error}`);
    }

    // Clean up the PR test file
    const prTestingDir = path.join(os.tmpdir(), '.pr-testing');
    const prFilePath = path.join(prTestingDir, `pr-${prNumber}.json`);

    if (fs.existsSync(prFilePath)) {
      try {
        fs.unlinkSync(prFilePath);
        console.log(`Removed PR test file: ${prFilePath}`);
      } catch (error) {
        console.log(`Error removing PR test file: ${error}`);
      }
    }

    // Clean up the temporary directory
    try {
      if (fs.existsSync(tempDir)) {
        console.log(`Cleaning up temporary directory: ${tempDir}`);

        // Use recursive deletion with force option to handle read-only files
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Successfully removed directory: ${tempDir}`);
      }
    } catch (cleanupError) {
      console.error(`Error cleaning up temporary directory: ${cleanupError}`);

      // Continue with the operation even if cleanup fails
    }

    return {
      success: true,
      message: `Successfully stopped application for PR #${prNumber}`,
      data: {
        pid,
        prNumber,
        tempDir,
      },
    };
  } catch (error) {
    console.error('Error stopping application:', error);
    return {
      success: false,
      message: `Failed to stop application: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Add a new function to store setup logs
export async function addSetupLog(params: { prNumber: number; message: string }) {
  const { prNumber, message } = params;

  try {
    // Get the .pr-testing directory
    const prTestingDir = path.join(os.tmpdir(), '.pr-testing');

    // If the directory doesn't exist, return an error
    if (!fs.existsSync(prTestingDir)) {
      return {
        success: false,
        message: 'No active PR tests found',
      };
    }

    // Check if the PR test file exists
    const prFilePath = path.join(prTestingDir, `pr-${prNumber}.json`);

    if (!fs.existsSync(prFilePath)) {
      return {
        success: false,
        message: `No active test found for PR #${prNumber}`,
      };
    }

    // Read the PR test file
    const fileContent = fs.readFileSync(prFilePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Add the log message with timestamp
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    // Initialize setupLogs array if it doesn't exist
    if (!data.setupLogs) {
      data.setupLogs = [];
    }

    // Add the log message
    data.setupLogs.push(logMessage);

    // Write the updated data back to the file
    fs.writeFileSync(prFilePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      message: 'Log added successfully',
    };
  } catch (error) {
    console.error('Error adding setup log:', error);

    return {
      success: false,
      message: `Failed to add setup log: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Add a new function to get setup logs
export async function getSetupLogs(prNumber: number) {
  try {
    // Get the .pr-testing directory
    const prTestingDir = path.join(os.tmpdir(), '.pr-testing');

    // If the directory doesn't exist, return an empty array
    if (!fs.existsSync(prTestingDir)) {
      return {
        success: true,
        data: [],
      };
    }

    // Check if the PR test file exists
    const prFilePath = path.join(prTestingDir, `pr-${prNumber}.json`);

    if (!fs.existsSync(prFilePath)) {
      return {
        success: true,
        data: [],
      };
    }

    // Read the PR test file
    const fileContent = fs.readFileSync(prFilePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Return the setup logs
    return {
      success: true,
      data: data.setupLogs || [],
    };
  } catch (error) {
    console.error('Error getting setup logs:', error);

    return {
      success: false,
      message: `Failed to get setup logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: [],
    };
  }
}
