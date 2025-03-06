/**
 * @server-only
 *
 * @file API route for retrieving server information for a specific PR
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

    // If the directory doesn't exist, return an error
    if (!fs.existsSync(prTestingDir)) {
      return json({ success: false, message: 'No active PR tests found' }, { status: 404 });
    }

    // Check if the PR test file exists
    const prFilePath = path.join(prTestingDir, `pr-${prNumber}.json`);

    if (!fs.existsSync(prFilePath)) {
      return json({ success: false, message: `No active test found for PR #${prNumber}` }, { status: 404 });
    }

    // Read the PR test file
    const fileContent = fs.readFileSync(prFilePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Check if the process is still running
    try {
      process.kill(data.pid, 0); // This will throw if the process is not running
    } catch (processError: any) {
      // Process is not running, delete the file
      console.log(`Process ${data.pid} is no longer running: ${processError.message}`);
      fs.unlinkSync(prFilePath);

      return json({ success: false, message: `Test for PR #${prNumber} is no longer running` }, { status: 404 });
    }

    return json({ success: true, data });
  } catch (error) {
    console.error('Error retrieving server information:', error);
    return json(
      {
        success: false,
        message: `Failed to retrieve server information: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
