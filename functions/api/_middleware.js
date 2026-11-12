import { json } from '../../lib/utils.js';
let jwksMemo = null;
let jwksExpiry = 0;
function base64urlDecode(value) {
  const s = value.replace(/-/g,'+').replace(/_/g,'/');
  const decoded = atob(s + '='.repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(decoded, ch => ch.charCodeAt(0));
}
function cleanDomain(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) throw new Error('ACCESS_TEAM_DOMAIN invalide.');
  return url.origin;
}
async function accessUser(ctx) {
  const env = ctx.env;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL) throw new Error('Configuration Access incomplète.');
  const token = ctx.request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));
  } catch { return null; }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) return null;
  const origin = cleanDomain(env.ACCESS_TEAM_DOMAIN);
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== origin || !Array.isArray(payload.aud) || !payload.aud.includes(env.ACCESS_AUD) ||
      typeof payload.exp !== 'number' || payload.exp <= now || typeof payload.iat !== 'number' || payload.iat > now + 60) return null;
  const email = String(payload.email || '').toLowerCase().trim();
  if (!email) return null;
  const admin = String(env.ADMIN_EMAIL).toLowerCase().trim();
  const editors = String(env.EDITOR_EMAILS || '').toLowerCase().split(/[;,]/).map(s=>s.trim()).filter(Boolean);
  if (email !== admin && !editors.includes(email)) return null;
  if (!jwksMemo || Date.now() > jwksExpiry) {
    const response = await fetch(origin + '/cdn-cgi/access/certs');
    if (!response.ok) throw new Error('Certificats Access indisponibles.');
    jwksMemo = await response.json();
    jwksExpiry = Date.now() + 30 * 60 * 1000;
  }
  let jwk = jwksMemo.keys?.find(key => key.kid === header.kid);
  if (!jwk) {
    jwksExpiry = 0;
    const response = await fetch(origin + '/cdn-cgi/access/certs');
    if (!response.ok) return null;
    jwksMemo = await response.json();
    jwksExpiry = Date.now() + 30 * 60 * 1000;
    jwk = jwksMemo.keys?.find(key => key.kid === header.kid);
  }
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64urlDecode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  if (!valid) return null;
  return {email,role:email === admin ? 'admin':'editor'};
}
export async function onRequest(context) {
  try {
    const request = context.request;
    if (!['GET','POST'].includes(request.method)) return json({error:'Méthode refusée.'},405);
    if (request.method === 'POST') {
      const origin = request.headers.get('Origin');
      if (!origin || origin !== new URL(request.url).origin) return json({error:'Origine refusée.'},403);
    }
    const user = await accessUser(context);
    if (!user) return json({error:'Accès refusé : authentification Cloudflare Access et adresse autorisée requises.'},403);
    context.data.user = user;
    return context.next();
  } catch (err) {
    console.error('Auth error',err.message);
    return json({error:'Service d’authentification indisponible ou mal configuré.'},503);
  }
}
