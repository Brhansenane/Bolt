import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

// Handle all HTTP methods
export async function action({ request, params }: ActionFunctionArgs) {
  return handleProxyRequest(request, params['*']);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return handleProxyRequest(request, params['*']);
}

async function handleProxyRequest(request: Request, path: string | undefined) {
  try {
    if (!path) {
      return json({ error: 'Invalid proxy URL format' }, { status: 400 });
    }

    // Get the LMStudio base URL from the query parameters or use default
    const url = new URL(request.url);
    const baseUrl = url.searchParams.get('baseUrl') || 'http://127.0.0.1:1234';

    // Remove the baseUrl parameter from the search params
    url.searchParams.delete('baseUrl');

    // Reconstruct the target URL
    const targetURL = `${baseUrl}/${path}${url.search}`;

    console.log(`Proxying request to LMStudio: ${targetURL}`);

    // Forward the request to the target URL
    const response = await fetch(targetURL, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),

        // Override host header with the target host
        host: new URL(targetURL).host,
      },
      body: ['GET', 'HEAD'].includes(request.method) ? null : await request.arrayBuffer(),
    });

    // Create response with CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
        status: 204,
      });
    }

    // Forward the response with CORS headers
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('LMStudio proxy error:', error);
    return json(
      { error: 'Proxy error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
