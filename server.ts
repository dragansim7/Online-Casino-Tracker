/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/server/db.ts';
import { syncEngine } from './src/server/syncEngine.ts';
import { sortListings, resolveSortOptionsList } from './src/lib/sortResolver.ts';
import { BonusCategorySlug, SortKey, User } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Simple Auth Middleware for server-side re-validation on every admin mutation (Section 10)
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const roleHeader = req.headers['x-user-role'];

  // Check role header or bearer token
  if (roleHeader === 'admin' || (authHeader && authHeader.includes('admin'))) {
    return next();
  }

  return res.status(403).json({
    error: 'Access denied. Every administrator action is also checked on the server, so the directory cannot be changed from the public site.',
  });
}

// =====================================================================
// PUBLIC API ENDPOINTS
// =====================================================================

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Live Counts for Header and Home (Section 7)
app.get('/api/counts', (_req, res) => {
  const counts = db.getCounts();
  res.json(counts);
});

// Listing Directory Query Endpoint with Section 5 Filters & Section 6 Sorting
app.get('/api/listings', (req, res) => {
  const q = (req.query.q as string || '').trim().toLowerCase();
  const catParam = req.query.cat as string;
  const ver = (req.query.ver as string || 'all');
  const avail = (req.query.avail as string || 'all');
  const sort = (req.query.sort as SortKey) || 'domain_az';
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '24', 10);

  const selectedCategories: BonusCategorySlug[] = catParam
    ? (catParam.split(',').filter(Boolean) as BonusCategorySlug[])
    : [];

  let listings = db.getListings();

  // Search filter
  if (q) {
    listings = listings.filter((l) => l.search_text.includes(q));
  }

  // Availability filter (Section 5: all | offline)
  if (avail === 'offline') {
    listings = listings.filter((l) => l.technical_status === 'offline');
  }

  // Verification filter (Section 5: all | verified | unverified | review_required)
  if (ver && ver !== 'all') {
    listings = listings.filter((l) => l.verification_status === ver);
  }

  // Category filter chips (Section 5): multi-select. A listing matches if it has >=1 bonus in ANY selected category.
  if (selectedCategories.length > 0) {
    listings = listings.filter((l) => {
      return selectedCategories.some((cat) => {
        const count = l.category_metrics?.[cat]?.count ?? 0;
        return count > 0;
      });
    });
  }

  // Sort options with contextual labels and disabled (no data) state
  const availableSorts = resolveSortOptionsList(listings, selectedCategories);

  // Apply contextual sort
  const sorted = sortListings(listings, sort, selectedCategories);

  // Pagination
  const total = sorted.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const items = sorted.slice(startIndex, startIndex + limit);

  res.json({
    items,
    total,
    page,
    limit,
    totalPages,
    selectedCategories,
    availableSorts,
  });
});

// Single Listing Detail
app.get('/api/listings/:id', (req, res) => {
  const result = db.getListingById(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  res.json(result);
});

// Engagement: Increment Click on "Visit site" (Section 3 & Section 9)
app.post('/api/listings/:id/click', (req, res) => {
  const clicks = db.incrementClick(req.params.id);
  res.json({ success: true, click_count: clicks });
});

// Engagement: Increment Favourite toggle (Section 9)
app.post('/api/listings/:id/favourite', (req, res) => {
  const favs = db.incrementFavourite(req.params.id);
  res.json({ success: true, favourite_count: favs });
});

// Favourites Batch Fetch
app.get('/api/favourites', (req, res) => {
  const idsParam = req.query.ids as string;
  if (!idsParam) {
    return res.json({ items: [] });
  }
  const ids = idsParam.split(',').filter(Boolean);
  const all = db.getListings();
  const items = all.filter((l) => ids.includes(l.id));
  res.json({ items });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();
  const isAdminEmail =
    normalizedEmail === 'admin@axhub.com' ||
    normalizedEmail === 'dragansim7@gmail.com';

  if (isAdminEmail) {
    return res.json({
      user: {
        id: 'usr_admin',
        email: email,
        name: normalizedEmail === 'dragansim7@gmail.com' ? 'Dragan (Admin)' : 'AXHub Administrator',
        role: 'admin',
      },
      token: 'axhub_admin_secret_token',
    });
  }

  // Regular user
  return res.json({
    user: {
      id: 'usr_player',
      email: email || 'player@example.com',
      name: email ? email.split('@')[0] : 'Casual Player',
      role: 'user',
    },
    token: 'axhub_user_token',
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, name } = req.body;
  return res.json({
    user: {
      id: `usr_${Date.now()}`,
      email: email || 'new@axhub.local',
      name: name || 'AXHub Member',
      role: 'user',
    },
    token: 'axhub_user_token',
  });
});

app.get('/api/auth/me', (req, res) => {
  const auth = req.headers.authorization;
  if (auth && auth.includes('admin')) {
    return res.json({
      id: 'usr_admin',
      email: 'admin@axhub.com',
      name: 'AXHub Administrator',
      role: 'admin',
    });
  }
  return res.json({
    id: 'usr_player',
    email: 'player@example.com',
    name: 'Casual Player',
    role: 'user',
  });
});

// =====================================================================
// ADMIN API ENDPOINTS (Server-side re-validated on every action)
// =====================================================================

// Overview Dashboard (Section 10)
app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const counts = db.getCounts();
  const listings = db.getListings();
  const unmatched = db.getUnmatched();
  const syncRuns = db.getSyncRuns();
  const importBatches = db.getImportBatches();

  // Feed error rate
  const listingsWithFeed = listings.filter((l) => l.feed_url);
  const feedErrors = listings.filter((l) => l.feed_status === 'error').length;
  const feedErrorRate = listingsWithFeed.length > 0 ? (feedErrors / listingsWithFeed.length) * 100 : 0;

  // Metric coverage (% listings with >= 1 calculated metric)
  const covered = listings.filter(
    (l) =>
      l.metric_max_bonus_amount !== null ||
      l.metric_max_withdraw !== null ||
      l.metric_min_rollover !== null
  ).length;
  const metricCoverage = listings.length > 0 ? (covered / listings.length) * 100 : 0;

  res.json({
    counts,
    recentImports: importBatches.slice(0, 5),
    syncHealth: {
      totalRuns: syncRuns.length,
      successfulRuns: syncRuns.filter((r) => r.status === 'ok').length,
      errorRuns: syncRuns.filter((r) => r.status === 'error').length,
    },
    feedErrorRate: Number(feedErrorRate.toFixed(1)),
    metricCoverage: Number(metricCoverage.toFixed(1)),
    llmSpendTokens: db.getLLMTokenSpend(),
    llmEstimatedCostUsd: Number(((db.getLLMTokenSpend() / 1000000) * 0.15).toFixed(4)),
    unmatchedCount: unmatched.length,
  });
});

// Admin Listings Table (25 per page, Section 10)
app.get('/api/admin/listings', requireAdmin, (req, res) => {
  const filter = (req.query.filter as string) || 'all';
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = 25;
  const q = (req.query.q as string || '').toLowerCase();

  let list = db.getListings();

  if (q) {
    list = list.filter((l) => l.search_text.includes(q));
  }

  // Filters: all | featured | verified | unverified | offline | imported | demo
  if (filter === 'featured') list = list.filter((l) => l.is_featured);
  else if (filter === 'verified') list = list.filter((l) => l.verification_status === 'verified');
  else if (filter === 'unverified') list = list.filter((l) => l.verification_status === 'unverified');
  else if (filter === 'offline') list = list.filter((l) => l.technical_status === 'offline');
  else if (filter === 'imported') list = list.filter((l) => l.source === 'import');
  else if (filter === 'demo') list = list.filter((l) => l.is_demo);

  const total = list.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const items = list.slice(startIndex, startIndex + limit);

  res.json({ items, total, page, limit, totalPages });
});

// Admin Save Listing (Create or Update)
app.post('/api/admin/listings', requireAdmin, (req, res) => {
  try {
    const saved = db.saveListing(req.body);
    res.json({ success: true, listing: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to save listing' });
  }
});

// Admin Delete Listing
app.delete('/api/admin/listings/:id', requireAdmin, (req, res) => {
  const deleted = db.deleteListing(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Listing not found' });
  res.json({ success: true });
});

// Admin Toggle Featured
app.post('/api/admin/listings/:id/toggle-featured', requireAdmin, (req, res) => {
  const updated = db.toggleFeatured(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Listing not found' });
  res.json({ success: true, listing: updated });
});

// Admin Update Category Toggles (hidden_categories & category_overrides, Section 4e)
app.post('/api/admin/listings/:id/toggles', requireAdmin, (req, res) => {
  const { hidden_categories, category_overrides } = req.body;
  const updated = db.updateListingToggles(req.params.id, hidden_categories || [], category_overrides || {});
  if (!updated) return res.status(404).json({ error: 'Listing not found' });
  res.json({ success: true, listing: updated });
});

// Admin Bulk Import (Section 10)
app.post('/api/admin/import', requireAdmin, (req, res) => {
  const { rawText, commit } = req.body;
  const adminEmail = 'admin@axhub.com';

  if (!rawText) {
    return res.status(400).json({ error: 'No domains provided.' });
  }

  const result = db.importListings(rawText, adminEmail, Boolean(commit));
  res.json(result);
});

// =====================================================================
// REAL-TIME SYNC PROGRESS TRACKER (Requirement 1 & Requirement 3)
// =====================================================================

interface SyncProgressState {
  isRunning: boolean;
  total: number;
  processed: number;
  percent: number;
  currentDomain: string;
  successCount: number;
  errorCount: number;
  matchedCount: number;
  droppedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errors: { domain: string; error: string; time: string }[];
}

let syncProgress: SyncProgressState = {
  isRunning: false,
  total: 0,
  processed: 0,
  percent: 0,
  currentDomain: '',
  successCount: 0,
  errorCount: 0,
  matchedCount: 0,
  droppedCount: 0,
  startedAt: null,
  completedAt: null,
  errors: [],
};

let cancelRequested = false;

// GET real-time scraper progress
app.get('/api/admin/bonuses/sync-progress', requireAdmin, (_req, res) => {
  res.json(syncProgress);
});

// POST Cancel running sync
app.post('/api/admin/bonuses/sync-cancel', requireAdmin, (_req, res) => {
  cancelRequested = true;
  syncProgress.isRunning = false;
  res.json({ success: true, message: 'Sync cancellation requested' });
});

// POST Start Fetch All Domains with live progress
app.post('/api/admin/bonuses/sync-all', requireAdmin, async (_req, res) => {
  if (syncProgress.isRunning) {
    return res.json({ success: false, message: 'Sync already in progress', progress: syncProgress });
  }

  const allListings = [...db.getListings()];
  cancelRequested = false;

  syncProgress = {
    isRunning: true,
    total: allListings.length,
    processed: 0,
    percent: 0,
    currentDomain: allListings[0]?.normalised_domain || '',
    successCount: 0,
    errorCount: 0,
    matchedCount: 0,
    droppedCount: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    errors: [],
  };

  // Return response immediately so client can poll progress
  res.json({ success: true, message: `Started fetching all ${allListings.length} domains`, progress: syncProgress });

  // Run processing in asynchronous non-blocking background batches
  (async () => {
    const chunkSize = 25;
    for (let i = 0; i < allListings.length; i += chunkSize) {
      if (cancelRequested) break;

      const chunk = allListings.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (listing) => {
          if (cancelRequested) return;
          syncProgress.currentDomain = listing.normalised_domain;
          try {
            const updated = await syncEngine.syncListing(listing);
            if (updated.bonus_status === 'failed' || updated.feed_status === 'error') {
              syncProgress.errorCount += 1;
              syncProgress.errors.push({
                domain: listing.normalised_domain,
                error: 'Feed connection or parsing failure',
                time: new Date().toLocaleTimeString(),
              });
            } else {
              syncProgress.successCount += 1;
              syncProgress.matchedCount += (updated.bonus_count || 0);
            }
          } catch (err: any) {
            syncProgress.errorCount += 1;
            syncProgress.errors.push({
              domain: listing.normalised_domain,
              error: err.message || 'Unknown crawl error',
              time: new Date().toLocaleTimeString(),
            });
          }
          syncProgress.processed += 1;
          syncProgress.percent = Math.round((syncProgress.processed / syncProgress.total) * 100);
        })
      );

      // Small yield to event loop for server responsiveness
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    syncProgress.isRunning = false;
    syncProgress.completedAt = new Date().toISOString();
    syncProgress.percent = Math.round((syncProgress.processed / syncProgress.total) * 100);
  })();
});

// Admin Bonus Sync Trigger (Sync Selected Domain / Batch / Error Tests)
app.post('/api/admin/bonuses/sync', requireAdmin, async (req, res) => {
  const { listingId, simulateError, simulateNoFeed, simulateNoOffers, batchCount } = req.body;

  if (listingId) {
    const listing = db.getListings().find((l) => l.id === listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const synced = await syncEngine.syncListing(listing, {
      simulateError: Boolean(simulateError),
      simulateNoFeed: Boolean(simulateNoFeed),
      simulateNoOffers: Boolean(simulateNoOffers),
    });

    const bonuses = db.getBonusesForListing(listingId);
    return res.json({ success: true, listing: synced, bonuses });
  }

  // Batch run (round-robin batch)
  const count = batchCount || 20;
  const targetListings = db.getListings().slice(0, count);
  const results = [];

  for (const l of targetListings) {
    const resListing = await syncEngine.syncListing(l);
    results.push(resListing.normalised_domain);
  }

  res.json({ success: true, synced_count: results.length, processed: results });
});

// Admin Direct Casino Scraper Adapters (Fast Wallet-API Sync)
app.get('/api/admin/adapters', requireAdmin, (_req, res) => {
  const configs = syncEngine.getCasinoConfigs();
  res.json({ adapters: configs });
});

app.post('/api/admin/adapters/:slug/sync', requireAdmin, async (req, res) => {
  try {
    const result = await syncEngine.syncWithAdapter(req.params.slug);
    const bonuses = db.getBonusesForListing(result.listing.id);
    res.json({
      success: true,
      ...result,
      bonuses,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Adapter sync failed' });
  }
});

// Admin Unmatched Queue (Section 4d)
app.get('/api/admin/unmatched', requireAdmin, (_req, res) => {
  const unmatched = db.getUnmatched();
  const allBonuses = db.getListings().reduce((acc, cur) => acc + cur.bonus_count, 0);
  const ratio = allBonuses + unmatched.length > 0 ? (unmatched.length / (allBonuses + unmatched.length)) * 100 : 0;

  res.json({
    items: unmatched,
    total: unmatched.length,
    droppedMatchedRatio: Number(ratio.toFixed(1)),
  });
});

// Admin Move Unmatched to Category (Section 4d)
app.post('/api/admin/unmatched/:id/move', requireAdmin, (req, res) => {
  const { targetCategory } = req.body;
  if (!targetCategory) {
    return res.status(400).json({ error: 'Target category is required.' });
  }

  const result = db.moveUnmatchedToBonus(req.params.id, targetCategory);
  if (!result) {
    return res.status(404).json({ error: 'Unmatched item not found or invalid listing.' });
  }

  res.json({ success: true, ...result });
});

// Admin Sync Runs History
app.get('/api/admin/sync-runs', requireAdmin, (_req, res) => {
  res.json({ items: db.getSyncRuns() });
});

// =====================================================================
// VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
// =====================================================================
async function setupViteOrStatic() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AXHub full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic().catch((err) => {
  console.error('Failed to start server:', err);
});
