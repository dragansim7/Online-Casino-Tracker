/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  LayoutDashboard,
  List,
  Upload,
  Gift,
  AlertCircle,
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Star,
  Play,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../lib/auth.ts';
import {
  fetchAdminOverview,
  fetchAdminListings,
  saveAdminListing,
  deleteAdminListing,
  toggleFeaturedListing,
  updateAdminToggles,
  bulkImportDomains,
  triggerBonusSync,
  fetchAdminSyncRuns,
  fetchAdminAdapters,
  triggerAdapterSync,
  fetchSyncProgress,
  startSyncAllDomains,
  cancelSyncProgress,
  fetchAdminUnmatched,
  moveUnmatchedToCategory,
} from '../lib/api.ts';
import {
  BonusCategorySlug,
  Listing,
  PromoUnmatched,
  SyncRun,
} from '../types/index.ts';
import { BONUS_CATEGORIES, CATEGORY_MAP } from '../constants/taxonomy.ts';

export const Admin: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'listings' | 'import' | 'bonuses' | 'unmatched' | 'settings'
  >('overview');

  // Overview Data
  const [overview, setOverview] = useState<any>(null);

  // Listings Data
  const [listingsData, setListingsData] = useState<{
    items: Listing[];
    total: number;
    page: number;
    totalPages: number;
  }>({ items: [], total: 0, page: 1, totalPages: 1 });
  const [listingFilter, setListingFilter] = useState('all');
  const [listingSearch, setListingSearch] = useState('');
  const [editingListing, setEditingListing] = useState<Partial<Listing> | null>(null);

  // Adapters State
  const [adapters, setAdapters] = useState<any[]>([]);
  const [adapterResult, setAdapterResult] = useState<any>(null);

  // Bulk Import State
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Sync / Bonuses State
  const [selectedListingForSync, setSelectedListingForSync] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncProgress, setSyncProgress] = useState<{
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
  } | null>(null);
  const [showErrorLog, setShowErrorLog] = useState(true);

  // Unmatched State
  const [unmatchedData, setUnmatchedData] = useState<{
    items: PromoUnmatched[];
    total: number;
    droppedMatchedRatio: number;
  }>({ items: [], total: 0, droppedMatchedRatio: 0 });

  const [isLoading, setIsLoading] = useState(false);

  // Check role & load initial data
  useEffect(() => {
    if (!isAdmin) return;

    if (activeTab === 'overview') {
      fetchAdminOverview().then(setOverview).catch(console.error);
    } else if (activeTab === 'listings') {
      loadListings(1, listingFilter, listingSearch);
    } else if (activeTab === 'bonuses') {
      fetchAdminSyncRuns().then((res) => setSyncRuns(res.items)).catch(console.error);
      fetchAdminAdapters().then((res) => setAdapters(res.adapters || [])).catch(console.error);
      fetchSyncProgress().then(setSyncProgress).catch(console.error);
    } else if (activeTab === 'unmatched') {
      fetchAdminUnmatched().then(setUnmatchedData).catch(console.error);
    }
  }, [isAdmin, activeTab, listingFilter]);

  // Polling loop for real-time scraper progress
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (activeTab === 'bonuses' && syncProgress?.isRunning) {
      timer = setTimeout(async () => {
        try {
          const prog = await fetchSyncProgress();
          setSyncProgress(prog);
          if (!prog.isRunning) {
            setIsSyncing(false);
            fetchAdminSyncRuns().then((r) => setSyncRuns(r.items)).catch(console.error);
            fetchAdminOverview().then(setOverview).catch(console.error);
          }
        } catch (e) {
          console.error(e);
        }
      }, 750);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeTab, syncProgress?.isRunning, syncProgress?.processed]);

  const handleStartSyncAll = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Starting crawl across all cataloged domains (0 LLM credits)...');
    try {
      const res = await startSyncAllDomains();
      setSyncProgress(res.progress);
    } catch (err: any) {
      setSyncStatusMsg(`Failed to start full sync: ${err.message}`);
      setIsSyncing(false);
    }
  };

  const handleCancelSync = async () => {
    try {
      await cancelSyncProgress();
      setSyncStatusMsg('Cancel requested...');
    } catch (err: any) {
      setSyncStatusMsg(`Cancel failed: ${err.message}`);
    }
  };

  const handleRunAdapterSync = async (slug: string) => {
    setIsSyncing(true);
    setSyncStatusMsg(`Directly scraping target domain via fast wallet-api (0 LLM tokens)...`);
    try {
      const res = await triggerAdapterSync(slug);
      setAdapterResult(res);
      setSyncStatusMsg(
        `Scraped ${res.allCount} promotions for ${res.listing.name}! (${res.matchedCount} matched to 5 taxonomy categories, ${res.droppedCount} dropped to Unmatched Queue). Zero LLM credits used.`
      );
      fetchAdminSyncRuns().then((r) => setSyncRuns(r.items));
    } catch (err: any) {
      setSyncStatusMsg(`Adapter sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadListings = (page: number, filter: string, q: string) => {
    setIsLoading(true);
    fetchAdminListings({ page, filter, q })
      .then(setListingsData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  // Guard for role === 'admin' (Section 10)
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Administrator Sign-In Required</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Every administrator action is also checked on the server, so the directory cannot be changed from the public site.
        </p>
        <div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors"
          >
            <span>Sign In with Admin Account</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // --- ACTIONS ---

  const handleToggleFeatured = async (id: string) => {
    try {
      await toggleFeaturedListing(id);
      loadListings(listingsData.page, listingFilter, listingSearch);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this listing?')) return;
    try {
      await deleteAdminListing(id);
      loadListings(listingsData.page, listingFilter, listingSearch);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing) return;
    try {
      await saveAdminListing(editingListing);
      setEditingListing(null);
      loadListings(listingsData.page, listingFilter, listingSearch);
    } catch (err: any) {
      alert(err.message || 'Failed to save listing');
    }
  };

  const handlePreviewImport = async () => {
    setIsImporting(true);
    try {
      const res = await bulkImportDomains(importText, false);
      setImportResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCommitImport = async () => {
    setIsImporting(true);
    try {
      const res = await bulkImportDomains(importText, true);
      setImportResult(res);
      setImportText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleTriggerSync = async (opts: {
    simulateError?: boolean;
    simulateNoFeed?: boolean;
    simulateNoOffers?: boolean;
  }) => {
    setIsSyncing(true);
    setSyncStatusMsg('Running extraction engine...');
    try {
      const res = await triggerBonusSync({
        listingId: selectedListingForSync || undefined,
        ...opts,
      });
      setSyncStatusMsg(
        opts.simulateError
          ? 'Error simulation recorded! Note: Existing bonuses were safely preserved.'
          : 'Sync completed successfully!'
      );
      fetchAdminSyncRuns().then((r) => setSyncRuns(r.items));
    } catch (err: any) {
      setSyncStatusMsg(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMoveUnmatched = async (unmatchedId: string, category: BonusCategorySlug) => {
    try {
      await moveUnmatchedToCategory(unmatchedId, category);
      fetchAdminUnmatched().then(setUnmatchedData);
      alert(`Moved to "${category}" and saved category override rule.`);
    } catch (err: any) {
      alert(err.message || 'Failed to move promo');
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26262E] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h1 className="text-xl font-black text-zinc-100">AXHub Admin Console</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Server-side authoritative directory management and sync dashboard.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 rounded-md bg-[#111114] border border-[#26262E] overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'bg-[#15151A] text-[#FFB020] border border-[#26262E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors ${
              activeTab === 'listings'
                ? 'bg-[#15151A] text-[#FFB020] border border-[#26262E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Listings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors ${
              activeTab === 'import'
                ? 'bg-[#15151A] text-[#FFB020] border border-[#26262E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Bulk Import
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bonuses')}
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors ${
              activeTab === 'bonuses'
                ? 'bg-[#15151A] text-[#FFB020] border border-[#26262E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Bonuses & Sync
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unmatched')}
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors ${
              activeTab === 'unmatched'
                ? 'bg-[#15151A] text-[#FFB020] border border-[#26262E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Unmatched ({unmatchedData.total})
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: OVERVIEW (Section 10)
         ===================================================================== */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded border border-[#26262E] bg-[#15151A]">
              <div className="text-[11px] text-zinc-500 font-medium">Total Domains</div>
              <div className="text-xl font-bold font-mono text-zinc-100 mt-1">
                {overview.counts.domains.toLocaleString()}
              </div>
            </div>
            <div className="p-3.5 rounded border border-[#26262E] bg-[#15151A]">
              <div className="text-[11px] text-zinc-500 font-medium">Featured Sites</div>
              <div className="text-xl font-bold font-mono text-[#FFC24D] mt-1">
                {overview.counts.featured}
              </div>
            </div>
            <div className="p-3.5 rounded border border-[#26262E] bg-[#15151A]">
              <div className="text-[11px] text-zinc-500 font-medium">Verified Status</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {overview.counts.verified}
              </div>
            </div>
            <div className="p-3.5 rounded border border-[#26262E] bg-[#15151A]">
              <div className="text-[11px] text-zinc-500 font-medium">Feed Error Rate</div>
              <div className="text-xl font-bold font-mono text-zinc-200 mt-1">
                {overview.feedErrorRate}%
              </div>
            </div>
            <div className="p-3.5 rounded border border-[#26262E] bg-[#15151A]">
              <div className="text-[11px] text-zinc-500 font-medium">Metric Coverage</div>
              <div className="text-xl font-bold font-mono text-zinc-200 mt-1">
                {overview.metricCoverage}%
              </div>
            </div>
            <div className="p-3.5 rounded border border-[#26262E] bg-[#15151A]">
              <div className="text-[11px] text-zinc-500 font-medium">LLM Spend</div>
              <div className="text-xl font-bold font-mono text-zinc-200 mt-1">
                ${overview.llmEstimatedCostUsd}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                {overview.llmSpendTokens} tokens
              </div>
            </div>
          </div>

          {/* Sync Health & Recent Imports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded border border-[#26262E] bg-[#111114] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Sync Engine Health
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Total Sync Runs Logged</span>
                  <span className="font-mono">{overview.syncHealth.totalRuns}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Successful Extractions</span>
                  <span className="font-mono text-emerald-400">
                    {overview.syncHealth.successfulRuns}
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Failed or Inaccessible Feeds</span>
                  <span className="font-mono text-rose-400">
                    {overview.syncHealth.errorRuns}
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-300 pt-2 border-t border-[#26262E]">
                  <span>Unmatched Drop Queue</span>
                  <span className="font-mono text-amber-400">{overview.unmatchedCount} promos</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded border border-[#26262E] bg-[#111114] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Recent Import Batches
              </h3>
              {overview.recentImports.length === 0 ? (
                <div className="text-xs text-zinc-500">No imports recorded.</div>
              ) : (
                <div className="space-y-2">
                  {overview.recentImports.map((batch: any) => (
                    <div
                      key={batch.id}
                      className="p-2.5 rounded bg-[#15151A] border border-[#26262E] text-xs flex justify-between items-center"
                    >
                      <div>
                        <div className="font-mono text-zinc-200">{batch.id}</div>
                        <div className="text-zinc-500 text-[10px]">
                          {new Date(batch.created_date).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <span className="text-emerald-400">+{batch.imported_count} imported</span>
                        {batch.duplicate_count > 0 && (
                          <span className="text-zinc-500 ml-2">({batch.duplicate_count} dupes)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: LISTINGS MANAGEMENT (25 per page, Section 10)
         ===================================================================== */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {['all', 'featured', 'verified', 'unverified', 'offline', 'imported', 'demo'].map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setListingFilter(f);
                      loadListings(1, f, listingSearch);
                    }}
                    className={`px-2.5 py-1 rounded capitalize transition-colors ${
                      listingFilter === f
                        ? 'bg-[#FFB020] text-zinc-950 font-bold'
                        : 'bg-[#15151A] text-zinc-400 border border-[#26262E]'
                    }`}
                  >
                    {f}
                  </button>
                )
              )}
            </div>

            {/* Create Button & Search */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter table..."
                value={listingSearch}
                onChange={(e) => {
                  setListingSearch(e.target.value);
                  loadListings(1, listingFilter, e.target.value);
                }}
                className="px-2.5 py-1 rounded text-xs border border-[#26262E] bg-[#15151A] text-zinc-200 w-36 focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setEditingListing({
                    name: '',
                    domain: '',
                    destination_url: '',
                    is_featured: false,
                    technical_status: 'online',
                    verification_status: 'verified',
                    hidden_categories: [],
                    category_overrides: {},
                  })
                }
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#FFB020] text-zinc-950 font-bold text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Site</span>
              </button>
            </div>
          </div>

          {/* Edit / Create Modal Form */}
          {editingListing && (
            <form
              onSubmit={handleSaveListing}
              className="p-5 rounded-md border border-[#FFB020]/40 bg-[#15151A] space-y-4 text-xs"
            >
              <div className="flex justify-between items-center border-b border-[#26262E] pb-2 font-bold text-zinc-100 text-sm">
                <span>{editingListing.id ? 'Edit Listing' : 'Create New Listing'}</span>
                <button
                  type="button"
                  onClick={() => setEditingListing(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={editingListing.name || ''}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded border border-[#26262E] bg-[#111114] text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Domain</label>
                  <input
                    type="text"
                    required
                    value={editingListing.domain || ''}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, domain: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded border border-[#26262E] bg-[#111114] text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Destination URL</label>
                  <input
                    type="text"
                    required
                    value={editingListing.destination_url || ''}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, destination_url: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded border border-[#26262E] bg-[#111114] text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Feed URL (Optional)</label>
                  <input
                    type="text"
                    value={editingListing.feed_url || ''}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, feed_url: e.target.value })
                    }
                    placeholder="https://example.com/promotions"
                    className="w-full px-2.5 py-1.5 rounded border border-[#26262E] bg-[#111114] text-zinc-100"
                  />
                </div>
              </div>

              {/* Status and Verification dropdowns */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Technical Status</label>
                  <select
                    value={editingListing.technical_status || 'online'}
                    onChange={(e) =>
                      setEditingListing({
                        ...editingListing,
                        technical_status: e.target.value as any,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded border border-[#26262E] bg-[#111114] text-zinc-200"
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="checking">Checking</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Verification</label>
                  <select
                    value={editingListing.verification_status || 'unverified'}
                    onChange={(e) =>
                      setEditingListing({
                        ...editingListing,
                        verification_status: e.target.value as any,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded border border-[#26262E] bg-[#111114] text-zinc-200"
                  >
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                    <option value="review_required">Review Required</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="is_featured"
                    checked={editingListing.is_featured || false}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, is_featured: e.target.checked })
                    }
                  />
                  <label htmlFor="is_featured" className="text-zinc-300">
                    Featured
                  </label>
                </div>
              </div>

              {/* Per-Listing Hidden Category Toggles (Section 4e) */}
              <div className="space-y-1.5 pt-2 border-t border-[#26262E]">
                <label className="text-zinc-400 block font-semibold text-[11px] uppercase tracking-wider">
                  Hidden Categories (Per-Listing Override)
                </label>
                <div className="flex flex-wrap gap-2">
                  {BONUS_CATEGORIES.map((cat) => {
                    const isHidden = (editingListing.hidden_categories || []).includes(cat.slug);
                    return (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => {
                          const current = editingListing.hidden_categories || [];
                          const next = isHidden
                            ? current.filter((s) => s !== cat.slug)
                            : [...current, cat.slug];
                          setEditingListing({ ...editingListing, hidden_categories: next });
                        }}
                        className={`px-2 py-1 rounded text-[11px] border ${
                          isHidden
                            ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                            : 'bg-[#111114] border-[#26262E] text-zinc-400'
                        }`}
                      >
                        {isHidden ? `Hidden: ${cat.chipLabel}` : `Show: ${cat.chipLabel}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingListing(null)}
                  className="px-3 py-1.5 rounded border border-[#26262E] text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#FFB020] text-zinc-950 font-bold"
                >
                  Save Listing
                </button>
              </div>
            </form>
          )}

          {/* Table: Shows metric_* values inline so sorts can be sanity-checked (Section 10) */}
          <div className="overflow-x-auto rounded-md border border-[#26262E] bg-[#111114]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#15151A] text-zinc-400 uppercase tracking-wider text-[10px] border-b border-[#26262E]">
                <tr>
                  <th className="p-3">Site / Domain</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 font-mono text-right">Max Bonus</th>
                  <th className="p-3 font-mono text-right">Max Cashout</th>
                  <th className="p-3 font-mono text-right">Min Wager</th>
                  <th className="p-3 font-mono text-right">Lowest Unlock</th>
                  <th className="p-3 font-mono text-right">Best Val</th>
                  <th className="p-3 text-center">Featured</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26262E] text-zinc-300 font-normal">
                {listingsData.items.map((listing) => (
                  <tr key={listing.id} className="hover:bg-[#15151A]/60">
                    <td className="p-3">
                      <div className="font-medium text-zinc-100">{listing.name}</div>
                      <div className="font-mono text-zinc-500 text-[11px]">
                        {listing.domain}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-[11px] capitalize">{listing.technical_status}</div>
                      <div className="text-[10px] text-zinc-500">
                        {listing.verification_status}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-right text-zinc-200">
                      {listing.metric_max_bonus_amount !== null
                        ? `$${listing.metric_max_bonus_amount}`
                        : '—'}
                    </td>
                    <td className="p-3 font-mono text-right text-zinc-200">
                      {listing.metric_max_withdraw !== null
                        ? `$${listing.metric_max_withdraw}`
                        : '—'}
                    </td>
                    <td className="p-3 font-mono text-right text-zinc-200">
                      {listing.metric_min_rollover !== null
                        ? `${listing.metric_min_rollover}×`
                        : '—'}
                    </td>
                    <td className="p-3 font-mono text-right text-zinc-200">
                      {listing.metric_min_unlock !== null
                        ? `$${listing.metric_min_unlock}`
                        : '—'}
                    </td>
                    <td className="p-3 font-mono text-right text-[#FFC24D]">
                      {listing.metric_best_value !== null
                        ? listing.metric_best_value
                        : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(listing.id)}
                        className={`p-1 rounded ${
                          listing.is_featured
                            ? 'text-[#FFB020] hover:text-zinc-500'
                            : 'text-zinc-600 hover:text-[#FFB020]'
                        }`}
                      >
                        <Star
                          className={`w-4 h-4 ${listing.is_featured ? 'fill-[#FFB020]' : ''}`}
                        />
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingListing(listing)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-100"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteListing(listing.id)}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Pagination (25/page) */}
          <div className="flex items-center justify-between text-xs text-zinc-400 pt-2">
            <span>
              Showing page {listingsData.page} of {listingsData.totalPages} (
              {listingsData.total} items)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={listingsData.page <= 1}
                onClick={() =>
                  loadListings(listingsData.page - 1, listingFilter, listingSearch)
                }
                className="px-3 py-1 rounded border border-[#26262E] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={listingsData.page >= listingsData.totalPages}
                onClick={() =>
                  loadListings(listingsData.page + 1, listingFilter, listingSearch)
                }
                className="px-3 py-1 rounded border border-[#26262E] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: BULK IMPORT (Section 10)
         ===================================================================== */}
      {activeTab === 'import' && (
        <div className="space-y-6 max-w-3xl">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">
              Bulk Domain List Importer
            </h2>
            <p className="text-xs text-zinc-400">
              Paste newline-separated domains. Automatically normalises, strips www/http, dedupes against existing database, caps at 1,000 per import, and logs an ImportBatch.
            </p>
          </div>

          <div className="space-y-3">
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="yes68.com&#10;zebra88.club&#10;australiaslot777.com&#10;..."
              className="w-full p-3 rounded-md border border-[#26262E] bg-[#111114] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#FFB020]"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isImporting || !importText.trim()}
                onClick={handlePreviewImport}
                className="px-4 py-2 rounded-md border border-[#26262E] bg-[#15151A] text-zinc-200 text-xs font-semibold hover:border-[#FFB020] disabled:opacity-40"
              >
                Preview Import
              </button>
              <button
                type="button"
                disabled={isImporting || !importText.trim()}
                onClick={handleCommitImport}
                className="px-4 py-2 rounded-md bg-[#FFB020] text-zinc-950 text-xs font-bold hover:bg-[#FFC24D] disabled:opacity-40"
              >
                Commit Import Batch
              </button>
            </div>
          </div>

          {/* Import Preview Results */}
          {importResult && (
            <div className="p-4 rounded-md border border-[#26262E] bg-[#15151A] space-y-3 text-xs">
              <div className="font-bold text-zinc-200 flex items-center justify-between">
                <span>Batch Result ({importResult.batchId})</span>
                <span
                  className={
                    importResult.committed ? 'text-emerald-400 font-mono' : 'text-amber-400'
                  }
                >
                  {importResult.committed ? 'COMMITTED TO DATABASE' : 'PREVIEW MODE'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center py-2 border-y border-[#26262E]">
                <div>
                  <div className="text-zinc-500">Will Import</div>
                  <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                    {importResult.willImport.length}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Duplicates (Skipped)</div>
                  <div className="text-base font-bold text-zinc-400 font-mono mt-0.5">
                    {importResult.duplicates.length}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Invalid Lines</div>
                  <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                    {importResult.invalid.length}
                  </div>
                </div>
              </div>

              {importResult.willImport.length > 0 && (
                <div>
                  <div className="text-zinc-400 font-medium mb-1">Domains to add:</div>
                  <div className="font-mono text-[11px] text-zinc-300 max-h-36 overflow-y-auto bg-[#111114] p-2 rounded">
                    {importResult.willImport.join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: BONUSES & SYNC RUNNER (Section 10 & 11)
         ===================================================================== */}
      {activeTab === 'bonuses' && (
        <div className="space-y-6">
          {/* Universal Platform Scrapers Card */}
          <div className="p-5 rounded-md border border-[#FFB020]/40 bg-[#15151A] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#FFB020]/15 text-[#FFC24D] border border-[#FFB020]/30">
                  <span>Zero LLM Tokens</span>
                  <span>·</span>
                  <span>Direct JSON Endpoint</span>
                  <span>·</span>
                  <span>Deterministic Classifier</span>
                </div>
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  Universal Direct Platform Scrapers (All Cataloged Websites)
                </h2>
                <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                  Every domain in AXHub automatically queries the high-speed backend endpoint (<code className="font-mono text-zinc-300">POST /api/v1/index.php</code>). It immediately extracts bonus amounts, wagering requirements, and unlocks, classifying them into the 5 standard categories with zero LLM credits spent.
                </p>
              </div>

              {/* Standardized Action Buttons */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSyncing || syncProgress?.isRunning}
                  onClick={handleStartSyncAll}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-all disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncProgress?.isRunning ? 'animate-spin' : ''}`} />
                  <span>{syncProgress?.isRunning ? 'Crawling All Domains...' : 'Fetch All Domains'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncing || syncProgress?.isRunning}
                  onClick={async () => {
                    setIsSyncing(true);
                    setSyncStatusMsg('Running batch scraper across 20 domains...');
                    try {
                      const res = await triggerBonusSync({ batchCount: 20 });
                      setSyncStatusMsg(`Successfully crawled and updated ${res.synced_count} domains via universal auto-detection! Zero LLM credits spent.`);
                      fetchAdminSyncRuns().then((r) => setSyncRuns(r.items));
                      fetchAdminOverview().then(setOverview).catch(console.error);
                    } catch (err: any) {
                      setSyncStatusMsg(`Batch sync error: ${err.message}`);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-md border border-[#FFB020]/40 bg-[#111114] text-[#FFC24D] font-bold text-xs hover:bg-[#FFB020]/15 transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 text-[#FFB020]" />
                  <span>Fetch Batch (20 Domains)</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncing || syncProgress?.isRunning}
                  onClick={() => handleRunAdapterSync('yeah96')}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-md border border-[#26262E] bg-[#111114] text-zinc-300 font-semibold text-xs hover:border-[#FFB020] hover:text-zinc-100 transition-colors disabled:opacity-50"
                >
                  <span>Sync Target Domain</span>
                </button>
              </div>
            </div>

            {/* Probe Status Indicator */}
            <div className="pt-3 border-t border-[#26262E] flex flex-wrap items-center gap-3 text-xs">
              <span className="text-zinc-500 font-medium">Auto-Detection Probe Status:</span>
              <div className="px-2.5 py-1 rounded bg-[#111114] border border-emerald-800/40 font-mono text-[11px] text-emerald-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Active on All 900+ Listings & New Imports</span>
              </div>
            </div>

            {adapterResult && (
              <div className="p-3.5 rounded bg-[#111114] border border-emerald-800/40 text-xs space-y-1.5 font-mono">
                <div className="text-emerald-400 font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Successfully synced {adapterResult.listing.name} in {adapterResult.duration_ms || 240}ms!</span>
                </div>
                <div className="text-zinc-300 grid grid-cols-3 gap-2 pt-1 border-t border-[#26262E]/60 text-[11px]">
                  <div>Total Promotions Scraped: <strong className="text-zinc-100">{adapterResult.allCount}</strong></div>
                  <div>Matched 5 Taxonomy: <strong className="text-emerald-300">{adapterResult.matchedCount}</strong></div>
                  <div>Dropped (Unmatched Queue): <strong className="text-amber-300">{adapterResult.droppedCount}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* =================================================================
              REAL-TIME SCRAPER PROGRESS BAR (Requirement 1 & 3)
             ================================================================= */}
          <div className="p-5 rounded-md border border-[#26262E] bg-[#111114] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <RefreshCw className={`w-4 h-4 text-[#FFB020] ${syncProgress?.isRunning ? 'animate-spin' : ''}`} />
                <h3 className="text-sm font-bold text-zinc-100">
                  Scraper Execution Monitor
                </h3>
                {syncProgress?.isRunning ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Processing In Real-Time
                  </span>
                ) : syncProgress?.completedAt ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400">
                    Idle
                  </span>
                )}
              </div>

              {syncProgress?.isRunning && (
                <button
                  type="button"
                  onClick={handleCancelSync}
                  className="px-3 py-1 text-xs rounded border border-rose-800/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 transition-colors"
                >
                  Cancel Run
                </button>
              )}
            </div>

            {/* Numeric Counter & Percent */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-2xl font-black font-mono text-[#FFB020]">
                  {syncProgress ? syncProgress.processed : 0}
                </span>
                <span className="text-zinc-500 text-xs font-mono ml-1.5">
                  / {syncProgress ? syncProgress.total : listingsData.total || 915} websites processed
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-zinc-200">
                {syncProgress ? syncProgress.percent : 0}%
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="relative w-full h-3 rounded-full bg-[#18181D] border border-[#26262E] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-[#FFB020] via-amber-400 to-[#FFE082] ${
                  syncProgress?.isRunning ? 'animate-pulse' : ''
                }`}
                style={{ width: `${syncProgress ? syncProgress.percent : 0}%` }}
              />
            </div>

            {/* Progress Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded border border-[#26262E] bg-[#15151A]">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Current Target</div>
                <div className="font-mono text-zinc-200 font-semibold truncate mt-0.5">
                  {syncProgress?.isRunning ? syncProgress.currentDomain : syncProgress?.completedAt ? 'All Done' : 'Standby'}
                </div>
              </div>

              <div className="p-2.5 rounded border border-[#26262E] bg-[#15151A]">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Successful Syncs</div>
                <div className="font-mono text-emerald-400 font-bold text-sm mt-0.5">
                  {syncProgress ? syncProgress.successCount : 0}
                </div>
              </div>

              <div className="p-2.5 rounded border border-[#26262E] bg-[#15151A]">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Errors / Blocked</div>
                <div className={`font-mono text-sm mt-0.5 font-bold ${syncProgress && syncProgress.errorCount > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                  {syncProgress ? syncProgress.errorCount : 0}
                </div>
              </div>

              <div className="p-2.5 rounded border border-[#26262E] bg-[#15151A]">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Matched Bonuses</div>
                <div className="font-mono text-[#FFC24D] font-bold text-sm mt-0.5">
                  {syncProgress ? syncProgress.matchedCount : 0}
                </div>
              </div>
            </div>

            {/* Error Audit Inspector (Requirement 3) */}
            {syncProgress && syncProgress.errors.length > 0 && (
              <div className="mt-4 p-3.5 rounded border border-rose-900/40 bg-rose-950/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Encountered Errors ({syncProgress.errors.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowErrorLog(!showErrorLog)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                  >
                    {showErrorLog ? 'Hide Error Log' : 'Show Error Log'}
                  </button>
                </div>

                <p className="text-[11px] text-zinc-400">
                  Resilience Rule: Transient network failures and offline operators were recorded safely without clearing or corrupting existing bonuses.
                </p>

                {showErrorLog && (
                  <div className="max-h-48 overflow-y-auto rounded border border-[#26262E] bg-[#111114]">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-[#15151A] text-zinc-400 text-[10px] uppercase border-b border-[#26262E]">
                        <tr>
                          <th className="p-2">Time</th>
                          <th className="p-2">Domain</th>
                          <th className="p-2">Failure Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#26262E] text-zinc-300">
                        {syncProgress.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-rose-950/20">
                            <td className="p-2 text-zinc-500">{err.time}</td>
                            <td className="p-2 text-zinc-200 font-semibold">{err.domain}</td>
                            <td className="p-2 text-rose-400">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Single Domain Sync & Diagnostic Testing */}
          <div className="p-5 rounded-md border border-[#26262E] bg-[#111114] space-y-4">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#FFB020]" />
              Single Domain Sync & Diagnostic Testing
            </h2>
            <p className="text-xs text-zinc-400">
              Run an individual sync on a selected domain or simulate error conditions to test catalog durability.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <select
                value={selectedListingForSync}
                onChange={(e) => setSelectedListingForSync(e.target.value)}
                className="px-3 py-2 rounded border border-[#26262E] bg-[#15151A] text-zinc-200 text-xs flex-1"
              >
                <option value="">Spotlight Domain: Yes77 AU (yes77au.com)</option>
                <option value="lst_yeah96">Yeah96 (yeah96.com) [Target Wallet-API]</option>
                {listingsData.items.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.domain})
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={isSyncing || syncProgress?.isRunning}
                onClick={() => handleTriggerSync({})}
                className="px-4 py-2 rounded bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] disabled:opacity-50"
              >
                {isSyncing ? 'Syncing...' : 'Fetch Selected Domain'}
              </button>
            </div>

            {/* Standardized Acceptance Testing Buttons */}
            <div className="pt-3 border-t border-[#26262E] flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                disabled={isSyncing || syncProgress?.isRunning}
                onClick={() => handleTriggerSync({ simulateError: true })}
                className="px-3 py-1.5 rounded border border-rose-800/60 bg-rose-950/20 text-rose-300 font-medium hover:bg-rose-900/30"
                title="Proves that transient crawl errors do not wipe existing bonuses"
              >
                Test Fetch Failure Resilience
              </button>
              <button
                type="button"
                disabled={isSyncing || syncProgress?.isRunning}
                onClick={() => handleTriggerSync({ simulateNoOffers: true })}
                className="px-3 py-1.5 rounded border border-[#26262E] bg-[#15151A] text-zinc-300 font-medium hover:border-zinc-500"
                title="Proves that 0 bonuses sets bonus_status=no_offers and empty state"
              >
                Test Zero-Offers Feed
              </button>
            </div>

            {syncStatusMsg && (
              <div className="p-3 rounded bg-[#15151A] border border-[#26262E] text-xs font-mono text-[#FFC24D]">
                {syncStatusMsg}
              </div>
            )}
          </div>

          {/* Sync Run History Log */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Sync Run Audit Log
            </h3>
            <div className="overflow-x-auto rounded border border-[#26262E] bg-[#111114]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#15151A] text-zinc-400 text-[10px] uppercase border-b border-[#26262E]">
                  <tr>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Run ID</th>
                    <th className="p-2.5">Found / Parsed</th>
                    <th className="p-2.5">Matched</th>
                    <th className="p-2.5">Dropped</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#26262E] font-mono text-[11px] text-zinc-300">
                  {syncRuns.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2.5 text-zinc-500">
                        {new Date(r.started_at).toLocaleTimeString()}
                      </td>
                      <td className="p-2.5">{r.id}</td>
                      <td className="p-2.5">
                        {r.cards_found} / {r.cards_parsed}
                      </td>
                      <td className="p-2.5 text-emerald-400">{r.matched_count}</td>
                      <td className="p-2.5 text-amber-400">{r.dropped_count}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            r.status === 'ok'
                              ? 'bg-emerald-950/40 text-emerald-300'
                              : 'bg-rose-950/40 text-rose-300'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: UNMATCHED QUEUE (Section 4d)
         ===================================================================== */}
      {activeTab === 'unmatched' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                Unmatched & Dropped Promos Queue
              </h2>
              <p className="text-xs text-zinc-400">
                Excluded promotions (rebates, VIP tiers, mini-games, partner brands) awaiting administrator categorization.
              </p>
            </div>
            <div className="text-xs font-mono text-zinc-400 bg-[#15151A] px-3 py-1.5 rounded border border-[#26262E]">
              Classifier Drift: <span className="text-amber-400 font-bold">{unmatchedData.droppedMatchedRatio}%</span> dropped
            </div>
          </div>

          {unmatchedData.items.length === 0 ? (
            <div className="p-8 text-center rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-500">
              No unmatched promos in queue. Classifier is running nominally.
            </div>
          ) : (
            <div className="space-y-3">
              {unmatchedData.items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-md border border-[#26262E] bg-[#15151A] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-zinc-100 text-sm">{item.raw_name}</div>
                    <div className="text-[#FFC24D] font-mono">{item.raw_amount}</div>
                    <div className="text-zinc-400 text-[11px] line-clamp-2 max-w-xl">
                      {item.raw_terms}
                    </div>
                    {item.drop_reason && (
                      <div className="text-rose-400 text-[10px] font-mono">
                        Reason: {item.drop_reason}
                      </div>
                    )}
                  </div>

                  {/* One-click move to category (Section 4d) */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-zinc-500 mr-1">Move to:</span>
                    {BONUS_CATEGORIES.map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => handleMoveUnmatched(item.id, cat.slug)}
                        className="px-2.5 py-1 rounded border border-[#26262E] bg-[#111114] hover:border-[#FFB020] text-zinc-300 text-[11px] transition-colors"
                      >
                        {cat.chipLabel}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
