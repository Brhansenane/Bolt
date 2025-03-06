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
      return json({ success: true, data: [] });
    }

    // Read all files in the directory
    const files = fs.readdirSync(prTestingDir);

    // Filter for PR test files (pr-*.json)
    const prFiles = files.filter((file) => file.startsWith('pr-') && file.endsWith('.json'));

    // Read each file and parse the JSON
    const activeTests = prFiles
      .map((file) => {
        try {
          const filePath = path.join(prTestingDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(fileContent);

          // Check if the process is still running
          try {
            process.kill(data.pid, 0); // This will throw if the process is not running
            return data;
          } catch (error: any) {
            // Process is not running, delete the file
            console.log(`Process ${data.pid} is no longer running: ${error.message}`);
            fs.unlinkSync(filePath);

            return null;
          }
        } catch (fileError) {
          console.error(`Error reading PR test file ${file}:`, fileError);
          return null;
        }
      })
      .filter(Boolean); // Remove null entries

    return json({ success: true, data: activeTests });
  } catch (error) {
    console.error('Error retrieving active PR tests:', error);
    return json(
      {
        success: false,
        message: `Failed to retrieve active PR tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
