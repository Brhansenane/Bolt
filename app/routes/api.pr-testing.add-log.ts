/**
 * @server-only
 *
 * @file API route for adding a setup log for a PR
 */

import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { addSetupLog } from '~/server/pr-testing.server';

interface AddLogRequest {
  prNumber: number;
  message: string;
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = (await request.json()) as AddLogRequest;
    const { prNumber, message } = data;

    if (!prNumber || !message) {
      return json({ success: false, message: 'Missing required fields: prNumber, message' }, { status: 400 });
    }

    const result = await addSetupLog({ prNumber, message });

    return json(result);
  } catch (error) {
    console.error('Error adding setup log:', error);
    return json(
      {
        success: false,
        message: `Failed to add setup log: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
