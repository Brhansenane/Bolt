/**
 * @server-only
 *
 * @file API route for retrieving server info for a specific PR
 */

import type { LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const loader: LoaderFunction = async ({ params }) => {
  try {
    const { prNumber } = params;

    if (!prNumber) {
      return json({ success: false, message: 'PR number is required' }, { status: 400 });
    }

    // Get the .pr-testing directory
    const prTestingDir = path.join(os.tmpdir(), '.pr-testing');

    // If the directory doesn't exist, return an empty array
    if (!fs.existsSync(prTestingDir)) {
      return json(
        {
          success: false,
          message: 'PR testing directory not found',
        },
        { status: 404 },
      );
    }

    // Check if the PR test file exists
    const prFilePath = path.join(prTestingDir, `pr-${prNumber}.json`);

    if (!fs.existsSync(prFilePath)) {
      return json(
        {
          success: false,
          message: `PR #${prNumber} test not found`,
        },
        { status: 404 },
      );
    }

    // Read the PR test file
    const fileContent = fs.readFileSync(prFilePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Check if the PR test is active (has a PID)
    if (!data.pid) {
      return json(
        {
          success: false,
          message: `PR #${prNumber} test is not active`,
        },
        { status: 404 },
      );
    }

    return json({
      success: true,
      data: {
        prNumber: parseInt(prNumber, 10),
        pid: data.pid,
        tempDir: data.tempDir,
        port: data.port,
      },
    });
  } catch (error) {
    console.error('Error retrieving server info:', error);
    return json(
      {
        success: false,
        message: `Failed to retrieve server info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
