// /api/notion.js
// Universal Notion API proxy for Vercel.
// Hides the NOTION_TOKEN from the browser and forwards typed requests.
//
// Requests body shape:
//   { action: 'query'|'create'|'update'|'delete', database?: string, page?: string, body?: object }
//
// Env vars expected:
//   NOTION_TOKEN          — secret_xxx or ntn_xxx
//   DB_EXPENSES           — database id
//   DB_INCOMES            — database id
//   DB_CAT_EXPENSES       — database id
//   DB_CAT_INCOMES        — database id
//   DB_REGULARS           — database id
//
// You can pass either the env var KEY ("DB_EXPENSES") OR a raw database id directly.
// Using env keys is preferred so frontend never sees real ids.

const NOTION_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

const ALLOWED_DB_KEYS = new Set([
  'DB_EXPENSES',
  'DB_INCOMES',
  'DB_CAT_EXPENSES',
  'DB_CAT_INCOMES',
  'DB_REGULARS'
]);

function resolveDatabase(input) {
  if (!input) return null;
  // Allow whitelisted env keys
  if (ALLOWED_DB_KEYS.has(input)) return process.env[input] || null;
  // Allow raw IDs (32 hex chars, optionally with dashes)
  if (/^[a-f0-9-]{32,36}$/i.test(input)) return input.replace(/-/g, '');
  return null;
}

async function notionFetch(path, method, body) {
  const res = await fetch(NOTION_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

module.exports = async (req, res) => {
  // CORS — same origin in production, but useful for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.NOTION_TOKEN) {
    return res.status(500).json({ error: 'NOTION_TOKEN env var not set' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Missing body' });
  }

  const { action } = body;

  try {
    if (action === 'query') {
      const dbId = resolveDatabase(body.database);
      if (!dbId) return res.status(400).json({ error: 'Bad or missing database' });
      // Pass-through filter, sorts, page_size, start_cursor
      const payload = {};
      if (body.filter) payload.filter = body.filter;
      if (body.sorts) payload.sorts = body.sorts;
      if (body.page_size) payload.page_size = body.page_size;
      if (body.start_cursor) payload.start_cursor = body.start_cursor;
      const r = await notionFetch(`/databases/${dbId}/query`, 'POST', payload);
      return res.status(r.status).json(r.data);
    }

    if (action === 'create') {
      const dbId = resolveDatabase(body.database);
      if (!dbId) return res.status(400).json({ error: 'Bad or missing database' });
      if (!body.properties) return res.status(400).json({ error: 'Missing properties' });
      const payload = {
        parent: { database_id: dbId },
        properties: body.properties
      };
      const r = await notionFetch(`/pages`, 'POST', payload);
      return res.status(r.status).json(r.data);
    }

    if (action === 'update') {
      if (!body.page) return res.status(400).json({ error: 'Missing page id' });
      if (!body.properties) return res.status(400).json({ error: 'Missing properties' });
      const r = await notionFetch(`/pages/${body.page}`, 'PATCH', { properties: body.properties });
      return res.status(r.status).json(r.data);
    }

    if (action === 'delete') {
      // Notion archive = soft delete
      if (!body.page) return res.status(400).json({ error: 'Missing page id' });
      const r = await notionFetch(`/pages/${body.page}`, 'PATCH', { archived: true });
      return res.status(r.status).json(r.data);
    }

    if (action === 'schema') {
      // Returns database schema — useful for debugging field names/types
      const dbId = resolveDatabase(body.database);
      if (!dbId) return res.status(400).json({ error: 'Bad or missing database' });
      const r = await notionFetch(`/databases/${dbId}`, 'GET');
      return res.status(r.status).json(r.data);
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });
  } catch (e) {
    return res.status(500).json({ error: 'Proxy error', detail: String(e && e.message || e) });
  }
};
