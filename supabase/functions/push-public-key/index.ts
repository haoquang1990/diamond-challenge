/**
 * push-public-key (story 057): the VAPID public key browsers need to turn web push on.
 * Public by design (no sign-in); the private key never leaves the function secrets.
 * Responds { publicKey } or 503 `not_configured` before the deploy created the keys.
 */
import { corsHeaders, json } from '../_shared/http.ts';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'GET' && req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  if (!publicKey) return json(req, 503, { error: 'not_configured' });
  return json(req, 200, { publicKey });
});
