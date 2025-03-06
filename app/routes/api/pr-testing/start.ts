/**
 * @server-only
 *
 * @file API route for starting applications from pull requests
 */

import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { startApp } from '~/server/pr-testing.server';

interface StartAppRequest {
  tempDir: string;
  prNumber: number;
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = (await request.json()) as StartAppRequest;
    const { tempDir, prNumber } = data;

    if (!tempDir || !prNumber) {
      return json({ success: false, message: 'Missing required fields: tempDir, prNumber' }, { status: 400 });
    }

    const result = await startApp({ tempDir, prNumber });

    return json(result);
  } catch (error) {
    console.error('Error starting application:', error);
    return json(
      {
        success: false,
        message: `Failed to start application: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
