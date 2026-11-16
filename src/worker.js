
 // Cloudflare Workers + Static Assets : carte publique + API D1 protégée.

import { onRequest as authorize } from '../functions/api/_middleware.js';
import { onRequestGet as listFeatures } from '../functions/api/features.js';
import { onRequestGet as getMe } from '../functions/api/me.js';
import {
  onRequestGet as listProposals,
  onRequestPost as createProposal
} from '../functions/api/proposals.js';
import { onRequestPost as reviewProposal } from '../functions/api/proposals/[id].js';
import { json } from '../lib/utils.js';

function chooseHandler(path, method, context) {
  if (path === '/api/me' && method === 'GET') {
    return () => getMe(context);
  }

  if (path === '/api/features' && method === 'GET') {
    return () => listFeatures(context);
  }

  if (path === '/api/proposals' && method === 'GET') {
    return () => listProposals(context);
  }

  if (path === '/api/proposals' && method === 'POST') {
    return () => createProposal(context);
  }

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

    // Diagnostic temporaire : uniquement sur les variables présentes.
    if (
      url.pathname === '/api/diagnostic-config' &&
      request.method === 'GET'
    ) {
      console.log('Diagnostic configuration CCPG', {
        ACCESS_AUD: Boolean(env.ACCESS_AUD),
        ACCESS_TEAM_DOMAIN: Boolean(env.ACCESS_TEAM_DOMAIN),
        ADMIN_EMAIL: Boolean(env.ADMIN_EMAIL),
        EDITOR_EMAILS: Boolean(env.EDITOR_EMAILS),
        DB: Boolean(env.DB)
      });

      return Response.json(
        { diagnostic: 'Consulter les journaux Workers' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const context = {
        request,
        env,
        data: {},
        params: {},
        waitUntil: p => executionContext.waitUntil(p)
      };

      const handler = chooseHandler(
        url.pathname,
        request.method,
        context
      );

      if (!handler) {
        return json(
          { error: 'Route API ou méthode inconnue.' },
          404
        );
      }

      context.next = handler;

      // Vérification du jeton Cloudflare Access.
      return authorize(context);
    }

    return env.ASSETS.fetch(request);
  }
};
