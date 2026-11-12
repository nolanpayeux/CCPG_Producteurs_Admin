// Cloudflare Workers + Static Assets : carte publique statique + API D1 protégée.
// Les données approuvées sont stockées dans D1 pilote ; le GeoJSON public reste inchangé.
import { onRequest as authorize } from '../functions/api/_middleware.js';
import { onRequestGet as listFeatures } from '../functions/api/features.js';
import { onRequestGet as getMe } from '../functions/api/me.js';
import { onRequestGet as listProposals, onRequestPost as createProposal } from '../functions/api/proposals.js';
import { onRequestPost as reviewProposal } from '../functions/api/proposals/[id].js';
import { json } from '../lib/utils.js';

function chooseHandler(path, method, context) {
  if (path === '/api/me' && method === 'GET') return () => getMe(context);
  if (path === '/api/features' && method === 'GET') return () => listFeatures(context);
  if (path === '/api/proposals' && method === 'GET') return () => listProposals(context);
  if (path === '/api/proposals' && method === 'POST') return () => createProposal(context);
  const match = path.match(/^\/api\/proposals\/([0-9a-fA-F-]{36})$/);
  if (match && method === 'POST') {
    context.params = { id: match[1] };
    return () => reviewProposal(context);
  }
  return null;
}

export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const context = {request, env, data: {}, params: {}, waitUntil: p => executionContext.waitUntil(p)};
      const handler = chooseHandler(url.pathname, request.method, context);
      if (!handler) return json({error:'Route API ou méthode inconnue.'},404);
      context.next = handler;
      return authorize(context); // JWT Cloudflare Access vérifié avant toute opération D1.
    }
    return env.ASSETS.fetch(request);
  }
};
