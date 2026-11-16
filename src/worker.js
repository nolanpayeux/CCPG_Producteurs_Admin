
export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);

    // DIAGNOSTIC TEMPORAIRE — à supprimer après vérification
    if (url.pathname === '/api/diagnostic-config' && request.method === 'GET') {
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

      const handler = chooseHandler(url.pathname, request.method, context);

      if (!handler) {
        return json({ error: 'Route API ou méthode inconnue.' }, 404);
      }

      context.next = handler;
      return authorize(context);
    }

    return env.ASSETS.fetch(request);
  }
};
