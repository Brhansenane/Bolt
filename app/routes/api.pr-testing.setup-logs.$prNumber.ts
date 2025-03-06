/**
 * @server-only
 *
 * @file API route for retrieving setup logs for a specific PR
 */

import type { LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getSetupLogs } from '~/server/pr-testing.server';

export const loader: LoaderFunction = async ({ params }) => {
  try {
    const { prNumber } = params;

    if (!prNumber) {
      return json({ success: false, message: 'PR number is required' }, { status: 400 });
    }

    const result = await getSetupLogs(parseInt(prNumber, 10));

    return json(result);
  } catch (error) {
    console.error('Error retrieving setup logs:', error);
    return json(
      {
        success: false,
        message: `Failed to retrieve setup logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: [],
      },
      { status: 500 },
    );
  }
};
