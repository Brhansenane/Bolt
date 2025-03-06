/**
 * @server-only
 *
 * @file API route for starting a PR test
 */

import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { startApp } from '~/server/pr-testing.server';

interface StartRequestBody {
  prNumber: number;
  tempDir: string;
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = (await request.json()) as StartRequestBody;
    const { prNumber, tempDir } = data;

    if (!prNumber || !tempDir) {
      return json({ success: false, message: 'Missing required fields: prNumber, tempDir' }, { status: 400 });
    }

    const result = await startApp({
      prNumber,
      tempDir,
    });

    return json(result);
  } catch (error) {
    console.error('Error starting PR test:', error);
    return json(
      {
        success: false,
        message: `Failed to start PR test: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
