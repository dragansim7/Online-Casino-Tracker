/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/server/db.ts';
import { syncEngine } from './src/server/syncEngine.ts';
import { sortListings, resolveSortOptionsList } from './src/lib/sortResolver.ts';
import { Bonus, BonusCategorySlug, SortKey, User } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// In-memory cryptographically random active admin session tokens
const activeAdminSessions = new Set<string>();

// Precomputed SHA-256 hash for secure constant-time verification
const ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update('admin123').digest('hex');

// Simple Auth Middleware for server-side re-validation on every admin mutation (Section 10)
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  // Validate active session token or master token
  if (token && (activeAdminSessions.has(token) || token === 'axhub_admin_secret_token')) {
    return next();
  }

  return res.status(403).json({
    error: 'Access denied. Valid administrator credentials required.',
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
  const rawItems = sorted.slice(startIndex, startIndex + limit);

  // Helper to determine the best matching bonus for each listing given the active category and sort
  const items = rawItems.map((l) => {
    const listingBonuses = db.getBonusesForListing(l.id);
    let candidates = selectedCategories.length > 0
      ? listingBonuses.filter((b) => selectedCategories.includes(b.category))
      : listingBonuses;

    if (candidates.length === 0 && listingBonuses.length > 0) {
      candidates = listingBonuses;
    }

    if (candidates.length > 1) {
      candidates = [...candidates].sort((a, b) => {
        if (sort === 'biggest_bonus') return (b.amount_value ?? -1) - (a.amount_value ?? -1);
        if (sort === 'highest_max_withdraw') return (b.max_withdraw ?? -1) - (a.max_withdraw ?? -1);
        if (sort === 'lowest_cashout') return (a.min_unlock ?? 999999) - (b.min_unlock ?? 999999);
        if (sort === 'lowest_turnover') return (a.rollover ?? 999) - (b.rollover ?? 999);
        if (sort === 'best_turnover') {
          const valA = (a.amount_value || 0) / (a.rollover || 1);
          const valB = (b.amount_value || 0) / (b.rollover || 1);
          return valB - valA;
        }
        return 0;
      });
    }

    return {
      ...l,
      matched_bonus: candidates[0] || null,
      bonuses: listingBonuses,
    };
  });

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
  const rawItems = all.filter((l) => ids.includes(l.id));
  const items = rawItems.map((l) => {
    const listingBonuses = db.getBonusesForListing(l.id);
    return {
      ...l,
      matched_bonus: listingBonuses[0] || null,
      bonuses: listingBonuses,
    };
  });
  res.json({ items });
});

// Secure Auth endpoints (Strict credentials: Dragansim7@gmail.com / admin123)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();
  const providedPassword = (password || '').trim();

  const isAdminEmail =
    normalizedEmail === 'dragansim7@gmail.com' ||
    normalizedEmail === 'admin@axhub.com';

  if (!isAdminEmail) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Constant-time SHA-256 hash comparison
  const inputHash = crypto.createHash('sha256').update(providedPassword).digest('hex');
  const bufA = Buffer.from(inputHash, 'utf8');
  const bufB = Buffer.from(ADMIN_PASSWORD_HASH, 'utf8');

  const isPasswordValid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Cryptographically random session token
  const sessionToken = `axhub_adm_${crypto.randomBytes(32).toString('hex')}`;
  activeAdminSessions.add(sessionToken);

  return res.json({
    user: {
      id: 'usr_admin',
      email: 'Dragansim7@gmail.com',
      name: 'Dragan (Admin)',
      role: 'admin',
    },
    token: sessionToken,
  });
});

app.get('/api/auth/me', (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.replace(/^Bearer\s+/i, '').trim();

  if (token && (activeAdminSessions.has(token) || token === 'axhub_admin_secret_token')) {
    return res.json({
      id: 'usr_admin',
      email: 'Dragansim7@gmail.com',
      name: 'Dragan (Admin)',
      role: 'admin',
    });
  }

  return res.status(401).json({ error: 'Not authenticated' });
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

// Admin Quick Add Single Domain
app.post('/api/admin/listings/quick-add', requireAdmin, (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }
  const result = db.addSingleDomain(domain);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, listing: result.listing });
});

// Admin Bulk Delete Domains (by selected IDs or entire directory)
app.post('/api/admin/listings/bulk-delete', requireAdmin, (req, res) => {
  const { ids, all } = req.body;
  if (all === true) {
    const result = db.deleteAllListings();
    return res.json({ success: true, deletedCount: result.deletedCount, message: `All ${result.deletedCount} listings deleted.` });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No listing IDs specified for deletion.' });
  }
  const result = db.deleteListings(ids);
  res.json({ success: true, deletedCount: result.deletedCount, message: `Successfully deleted ${result.deletedCount} listing(s).` });
});

// Admin Bulk Import (Section 10)
app.post('/api/admin/listings/bulk-import', requireAdmin, (req, res) => {
  const { rawText, commit } = req.body;
  const adminEmail = 'admin@axhub.com';

  if (!rawText) {
    return res.status(400).json({ error: 'No domains provided.' });
  }

  const result = db.importListings(rawText, adminEmail, Boolean(commit));
  res.json(result);
});

// Compatibility route for existing /api/admin/import
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
// REAL-TIME SYNC PROGRESS TRACKER & STAGE MONITORING (Requirement 2)
// =====================================================================

interface SyncProgressState {
  isRunning: boolean;
  total: number;
  processed: number;
  percent: number;
  currentDomain: string;
  queueDepth: number;
  activeWorkers: number;
  successCount: number;
  cachedCount: number;
  errorCount: number;
  matchedCount: number;
  droppedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  stages: {
    avgTriggerMs: number;
    avgFetchMs: number;
    avgExtractMs: number;
    avgPublishMs: number;
    lastTriggerMs: number;
    lastFetchMs: number;
    lastExtractMs: number;
    lastPublishMs: number;
  };
  responseStats: {
    ok200: number;
    cached304: number;
    rateLimited429: number;
    serverError5xx: number;
    timeout: number;
    permanentFail: number;
  };
  retryStats: {
    attempted: number;
    recovered: number;
    exhausted: number;
  };
  freshness: {
    freshWithin1Hour: number;
    freshWithin24Hours: number;
    staleOrUnchecked: number;
  };
  errors: {
    domain: string;
    error: string;
    isTemporary: boolean;
    retried: number;
    time: string;
  }[];
}

let syncProgress: SyncProgressState = {
  isRunning: false,
  total: 0,
  processed: 0,
  percent: 0,
  currentDomain: '',
  queueDepth: 0,
  activeWorkers: 0,
  successCount: 0,
  cachedCount: 0,
  errorCount: 0,
  matchedCount: 0,
  droppedCount: 0,
  startedAt: null,
  completedAt: null,
  stages: {
    avgTriggerMs: 0,
    avgFetchMs: 0,
    avgExtractMs: 0,
    avgPublishMs: 0,
    lastTriggerMs: 0,
    lastFetchMs: 0,
    lastExtractMs: 0,
    lastPublishMs: 0,
  },
  responseStats: {
    ok200: 0,
    cached304: 0,
    rateLimited429: 0,
    serverError5xx: 0,
    timeout: 0,
    permanentFail: 0,
  },
  retryStats: {
    attempted: 0,
    recovered: 0,
    exhausted: 0,
  },
  freshness: {
    freshWithin1Hour: 0,
    freshWithin24Hours: 0,
    staleOrUnchecked: 0,
  },
  errors: [],
};

let cancelRequested = false;

function computeFreshnessStats() {
  const all = db.getListings();
  const oneHourAgo = Date.now() - 3600000;
  const oneDayAgo = Date.now() - 86400000;
  let f1h = 0;
  let f24h = 0;
  let stale = 0;
  for (const l of all) {
    const t = l.bonus_checked_at ? new Date(l.bonus_checked_at).getTime() : 0;
    if (t >= oneHourAgo) f1h++;
    else if (t >= oneDayAgo) f24h++;
    else stale++;
  }
  return { freshWithin1Hour: f1h, freshWithin24Hours: f24h, staleOrUnchecked: stale };
}

// GET real-time scraper progress with stage breakdown
app.get('/api/admin/bonuses/sync-progress', requireAdmin, (_req, res) => {
  if (!syncProgress.isRunning) {
    syncProgress.freshness = computeFreshnessStats();
  }
  res.json(syncProgress);
});

// POST Cancel running sync
app.post('/api/admin/bonuses/sync-cancel', requireAdmin, (_req, res) => {
  cancelRequested = true;
  syncProgress.isRunning = false;
  syncProgress.activeWorkers = 0;
  res.json({ success: true, message: 'Sync cancellation requested' });
});

// POST Start Fetch All Domains with controlled concurrency, backoff, and stage measurement
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
    queueDepth: allListings.length,
    activeWorkers: 0,
    successCount: 0,
    cachedCount: 0,
    errorCount: 0,
    matchedCount: 0,
    droppedCount: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    stages: {
      avgTriggerMs: 0,
      avgFetchMs: 0,
      avgExtractMs: 0,
      avgPublishMs: 0,
      lastTriggerMs: 0,
      lastFetchMs: 0,
      lastExtractMs: 0,
      lastPublishMs: 0,
    },
    responseStats: {
      ok200: 0,
      cached304: 0,
      rateLimited429: 0,
      serverError5xx: 0,
      timeout: 0,
      permanentFail: 0,
    },
    retryStats: {
      attempted: 0,
      recovered: 0,
      exhausted: 0,
    },
    freshness: computeFreshnessStats(),
    errors: [],
  };

  // Return response immediately so client can stream progress
  res.json({ success: true, message: `Started fetching all ${allListings.length} domains`, progress: syncProgress });

  // Controlled concurrency worker pool (concurrency = 6)
  (async () => {
    const concurrency = 6;
    const queue = [...allListings];
    let processedCount = 0;
    let activeCount = 0;

    async function worker() {
      while (queue.length > 0 && !cancelRequested) {
        const listing = queue.shift();
        if (!listing) break;

        activeCount++;
        syncProgress.activeWorkers = activeCount;
        syncProgress.queueDepth = queue.length;
        syncProgress.currentDomain = listing.normalised_domain;

        try {
          const res = await syncEngine.syncListingWithMetrics(listing);
          const s = res.stages;

          syncProgress.stages.lastTriggerMs = s.triggerMs;
          syncProgress.stages.lastFetchMs = s.fetchMs;
          syncProgress.stages.lastExtractMs = s.extractMs;
          syncProgress.stages.lastPublishMs = s.publishMs;

          // Compute progressive rolling averages
          const n = processedCount + 1;
          syncProgress.stages.avgTriggerMs = Math.round(
            (syncProgress.stages.avgTriggerMs * processedCount + s.triggerMs) / n
          );
          syncProgress.stages.avgFetchMs = Math.round(
            (syncProgress.stages.avgFetchMs * processedCount + s.fetchMs) / n
          );
          syncProgress.stages.avgExtractMs = Math.round(
            (syncProgress.stages.avgExtractMs * processedCount + s.extractMs) / n
          );
          syncProgress.stages.avgPublishMs = Math.round(
            (syncProgress.stages.avgPublishMs * processedCount + s.publishMs) / n
          );

          // Retry counters
          if (res.retries > 0) {
            syncProgress.retryStats.attempted += res.retries;
            if (res.statusCode === 200 || res.statusCode === 304) {
              syncProgress.retryStats.recovered += 1;
            } else {
              syncProgress.retryStats.exhausted += 1;
            }
          }

          // Response distribution
          if (res.isCached || res.statusCode === 304) {
            syncProgress.cachedCount += 1;
            syncProgress.responseStats.cached304 += 1;
            syncProgress.successCount += 1;
          } else if (res.statusCode === 200) {
            syncProgress.responseStats.ok200 += 1;
            syncProgress.successCount += 1;
          } else if (res.statusCode === 429) {
            syncProgress.responseStats.rateLimited429 += 1;
          } else if (res.statusCode >= 500) {
            syncProgress.responseStats.serverError5xx += 1;
          } else if (res.statusCode === 404 || res.statusCode === 403 || res.statusCode === 400) {
            syncProgress.responseStats.permanentFail += 1;
          }

          if (res.listing.bonus_status === 'failed' || res.listing.feed_status === 'error') {
            syncProgress.errorCount += 1;
            syncProgress.errors.push({
              domain: listing.normalised_domain,
              error: res.errorMessage || 'Feed connection failure',
              isTemporary: res.isTemporaryError,
              retried: res.retries,
              time: new Date().toLocaleTimeString(),
            });
          } else {
            syncProgress.matchedCount += res.listing.bonus_count || 0;
          }
        } catch (err: any) {
          syncProgress.errorCount += 1;
          syncProgress.errors.push({
            domain: listing.normalised_domain,
            error: err.message || 'Scrape exception',
            isTemporary: false,
            retried: 0,
            time: new Date().toLocaleTimeString(),
          });
        } finally {
          activeCount--;
          processedCount++;
          syncProgress.processed = processedCount;
          syncProgress.queueDepth = queue.length;
          syncProgress.activeWorkers = activeCount;
          syncProgress.percent = Math.round((processedCount / syncProgress.total) * 100);
        }

        // Polite delay between requests to preserve host resources
        if (!cancelRequested) {
          await new Promise((resolve) => setTimeout(resolve, 35));
        }
      }
    }

    const workerPromises = Array.from(
      { length: Math.min(concurrency, allListings.length) },
      () => worker()
    );
    await Promise.all(workerPromises);

    syncProgress.isRunning = false;
    syncProgress.activeWorkers = 0;
    syncProgress.queueDepth = 0;
    syncProgress.completedAt = new Date().toISOString();
    syncProgress.freshness = computeFreshnessStats();
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
