/**
 * @server-only
 *
 * @file API route for stopping a PR test
 */

import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { stopApp } from '~/server/pr-testing.server';

interface StopRequestBody {
  prNumber: number;
  pid: number;
  tempDir: string;
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = (await request.json()) as StopRequestBody;
    const { prNumber, pid, tempDir } = data;

    if (!prNumber || !pid || !tempDir) {
      return json({ success: false, message: 'Missing required fields: prNumber, pid, tempDir' }, { status: 400 });
    }

    const result = await stopApp({
      prNumber,
      pid,
      tempDir,
    });

    return json(result);
  } catch (error) {
    console.error('Error stopping PR test:', error);
    return json(
      {
        success: false,
        message: `Failed to stop PR test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
