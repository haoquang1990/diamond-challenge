/** CORS and JSON helpers shared by the account Edge Functions (story 019). */

/** Origins allowed to call the functions: the GitHub Pages app and the Vite dev server. */
export const ALLOWED_ORIGINS: readonly string[] = ['https://haoquang1990.github.io', 'http://localhost:5173'];

/** CORS headers for a request, echoing its origin only when allowed. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** A JSON response with CORS headers. */
export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
