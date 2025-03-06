/**
 * @server-only
 *
 * @file API route for cloning a PR
 */

import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { clonePR } from '~/server/pr-testing.server';

interface CloneRequestBody {
  prNumber: number;
  branch: string;
  repoUrl: string;
  repoName: string;
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = (await request.json()) as CloneRequestBody;
    const { prNumber, branch, repoUrl, repoName } = data;

    if (!prNumber || !branch || !repoUrl || !repoName) {
      return json(
        { success: false, message: 'Missing required fields: prNumber, branch, repoUrl, repoName' },
        { status: 400 },
      );
    }

    const result = await clonePR({
      prNumber,
      branch,
      repoUrl,
      repoName,
    });

    return json(result);
  } catch (error) {
    console.error('Error cloning PR:', error);
    return json(
      {
        success: false,
        message: `Failed to clone PR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
};
