import { corsHeaders } from '../middleware/security.js';

export function json(res, status, body, req) {
  try {
    return res.json(body, status, corsHeaders(req || {}));
  } catch {
    try {
      return res.json(body || { error: 'INTERNAL' }, status || 500);
    } catch {
      return res.text(JSON.stringify(body || { error: 'INTERNAL' }), status || 500);
    }
  }
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

export function match(path, pattern) {
  const pp = pattern.split('/').filter(Boolean);
  const sp = path.split('/').filter(Boolean);
  if (pp.length !== sp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(sp[i]);
    else if (pp[i] !== sp[i]) return null;
  }
  return params;
}

export function getPath(req) {
  let path = req.path || '/';
  if (!path.startsWith('/')) path = '/' + path;
  return path.split('?')[0].replace(/\/+$/, '') || '/';
}
