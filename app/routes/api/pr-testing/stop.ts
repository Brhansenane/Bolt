/**
 * @server-only
 *
 * @file API route for stopping applications from pull requests
 */

import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { stopApp } from '~/server/pr-testing.server';

interface StopAppRequest {
  pid: number;
  tempDir: string;
  prNumber: number;
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = (await request.json()) as StopAppRequest;
    const { pid, tempDir, prNumber } = data;

    if (!pid || !tempDir || !prNumber) {
      return json({ success: false, message: 'Missing required fields: pid, tempDir, prNumber' }, { status: 400 });
    }

    const result = await stopApp({ pid, tempDir, prNumber });

    return json(result);
  } catch (error) {
    console.error('Error stopping application:', error);
    return json(
      {
        success: false,
        message: `Failed to stop application: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
