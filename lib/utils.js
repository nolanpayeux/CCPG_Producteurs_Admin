export function json(data, status = 200) {
  return Response.json(data, { status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'} });
}
export function error(message, status = 400) { return json({error:message},status); }
export function db(context) {
  if (!context.env.DB) throw new Error('Binding D1 DB non configuré.');
  return context.env.DB;
}
export async function inputJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new Error('Content-Type application/json requis.');
  const max = 250000;
  if (Number(request.headers.get('content-length') || 0) > max) throw new Error('Requête trop volumineuse.');
  const body = await request.text();
  if (body.length > max) throw new Error('Requête trop volumineuse.');
  return JSON.parse(body);
}
export function validateFeature(value) {
  if (!value || typeof value !== 'object' || value.type !== 'Feature' ||
      value.geometry?.type !== 'Point' || !Array.isArray(value.geometry.coordinates) || value.geometry.coordinates.length !== 2) {
    throw new Error('Un objet GeoJSON de type Feature/Point est attendu.');
  }
  const [lon,lat] = value.geometry.coordinates;
  if (![lon,lat].every(Number.isFinite) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error('Coordonnées WGS84 invalides.');
  }
  if (!value.properties || typeof value.properties !== 'object' || Array.isArray(value.properties)) throw new Error('Attributs manquants.');
  if (!String(value.properties.name || '').trim()) throw new Error('Le nom du producteur est obligatoire.');
  if (!String(value.properties.categorie || '').trim()) throw new Error('La catégorie est obligatoire.');
  const cleaned = JSON.parse(JSON.stringify(value));
  if (JSON.stringify(cleaned).length > 150000) throw new Error('Fiche trop volumineuse.');
  return cleaned;
}
export function currentUser(context) { return context.data.user; }
export function isAdmin(context) { return currentUser(context).role === 'admin'; }
