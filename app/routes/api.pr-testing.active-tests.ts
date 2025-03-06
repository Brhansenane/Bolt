/**
 * @server-only
 *
 * @file API route for retrieving active PR tests
 */

import type { LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const loader: LoaderFunction = async () => {
  try {
    // Get the .pr-testing directory
    const prTestingDir = path.join(os.tmpdir(), '.pr-testing');

    // If the directory doesn't exist, return an empty array
    if (!fs.existsSync(prTestingDir)) {
      return json({
        success: true,
        data: [],
      });
    }

    // Read all files in the directory
    const files = fs.readdirSync(prTestingDir);

    // Filter for PR test files
    const prFiles = files.filter((file) => file.startsWith('pr-') && file.endsWith('.json'));

    // Read each file and extract the PR number, PID, and temp directory
    const activeTests = prFiles
      .map((file) => {
        try {
          const filePath = path.join(prTestingDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(fileContent);

          // Check if the PR test is active (has a PID)
          if (data.pid) {
            return {
              prNumber: data.prNumber,
              pid: data.pid,
              tempDir: data.tempDir,
              port: data.port,
            };
          }

          return null;
        } catch (error) {
          console.error(`Error reading PR test file ${file}:`, error);
          return null;
        }
      })
      .filter(Boolean);

    return json({
      success: true,
      data: activeTests,
    });
  } catch (error) {
    console.error('Error retrieving active tests:', error);
    return json(
      {
        success: false,
        message: `Failed to retrieve active tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: [],
      },
      { status: 500 },
    );
  }
};
