// Bonus fetcher: node scrape.js  -> writes output/<slug>.json + output/all.json
// Node 18+ (global fetch). No login; uses the same public endpoint the promo page calls.
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'output');
const UA = 'Mozilla/5.0 (compatible; MyCasinoDirectoryBot/1.0; +https://example.com/bot)';

const stripHtml = s => (s || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<link[^>]*>|<!--[\s\S]*?-->/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const num = v => (v === null || v === undefined || v === '' ? null : Number(v));
const json = s => { try { return JSON.parse(s); } catch { return null; } };

// Description is JSON with a Quill delta: {Description, DescQuillEditor:{ops:[{insert:"<html>"}]}}
function descText(raw) {
  const d = json(raw);
  if (!d) return stripHtml(raw);
  const html = (d.DescQuillEditor?.ops || []).map(o => (typeof o.insert === 'string' ? o.insert : '')).join('') || d.Description || '';
  return stripHtml(html);
}

// ---- Adapters: one per platform/site type. Each returns normalized bonuses.
const adapters = {
  // White-label wallet platform used by yeah96 (POST /api/v1/index.php module=/merchants/getPublicInfo)
  'wallet-api': async c => {
    const body = new URLSearchParams({ module: '/merchants/getPublicInfo', merchantId: c.merchantId, accessId: '', accessToken: '', walletIsAdmin: '' });
    const r = await fetch(`${c.baseUrl}/api/v1/index.php`, { method: 'POST', body,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${c.baseUrl}/promotion` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const promos = j?.data?.promotions;
    if (!Array.isArray(promos)) throw new Error('no data.promotions in response');
    return promos.map(p => {
      const pct = num(p.bonus), fixed = num(p.bonusFixed), cfg = json(p.claimConfig) || {};
      return {
        id: String(p.id),
        title: stripHtml(p.name),
        category: stripHtml(p.displayGroup) || null,
        type: p.claimCondition || null,            // e.g. DEPOSIT, FREE...
        bonusPercent: pct || null,
        bonusFixed: fixed || null,
        bonusLabel: pct ? `${pct}%` : fixed ? `${c.currency} ${fixed}` : null,
        minDeposit: num(p.minTopup),
        maxDeposit: num(p.maxTopup),
        wageringX: num(p.rollover),                // turnover multiplier
        minWithdraw: num(p.minWithdraw),
        maxWithdraw: num(p.maxWithdraw),
        resets: p.reset || null,                   // DAILY / WEEKLY / ''
        maxClaims: num(p.maxRound),
        mobileAppOnly: cfg.mobileAppOnly === '1',
        image: p.image || null,
        description: descText(p.description).slice(0, 1500),
        displayOrder: num(p.displayOrder),
        sourceUrl: `${c.baseUrl}/promotion`,
      };
    });
  },
  // Add more e.g. 'html-cheerio' (static sites), 'playwright' (JS-only sites), 'affiliate-feed'.
};

// Pick 5: pinned ids first (in admin order), then fill by displayOrder; flag missing pins.
function choose(all, pinned = [], n = 5) {
  const byId = new Map(all.map(b => [b.id, b]));
  const picked = pinned.map(id => byId.get(String(id))).filter(Boolean);
  const missing = pinned.filter(id => !byId.has(String(id)));
  for (const b of [...all].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)))
    if (picked.length >= n) break; else if (!picked.includes(b)) picked.push(b);
  return { picked: picked.slice(0, n), missing };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const casinos = JSON.parse(fs.readFileSync(path.join(__dirname, 'casinos.json'), 'utf8'));
  const result = [];
  for (const c of casinos) {
    const file = path.join(OUT, `${c.slug}.json`);
    try {
      const all = await adapters[c.adapter](c);
      const { picked, missing } = choose(all, c.pinnedBonusIds);
      const rec = { casino: c.slug, name: c.name, fetchedAt: new Date().toISOString(), status: 'ok',
        missingPinnedIds: missing, featured: picked, allCount: all.length, all };
      fs.writeFileSync(file, JSON.stringify(rec, null, 2));
      result.push(rec);
      console.log(`${c.slug}: ${all.length} bonuses, featured ${picked.map(b => b.id).join(',')}${missing.length ? ' MISSING ' + missing : ''}`);
    } catch (e) {
      // keep last good data instead of blanking the card
      const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      result.push(prev ? { ...prev, status: 'stale', error: e.message } : { casino: c.slug, status: 'error', error: e.message, featured: [] });
      console.error(`${c.slug}: FAILED ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000)); // be polite between sites
  }
  fs.writeFileSync(path.join(OUT, 'all.json'), JSON.stringify(result.map(({ all, ...r }) => r), null, 2));
})();
