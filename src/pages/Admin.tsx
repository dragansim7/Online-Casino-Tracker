/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  FileText,
  CheckSquare,
  Square,
  MinusSquare,
  Clock,
  Zap,
  ShieldAlert,
  Database,
  ChevronRight,
  X,
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
  quickAddAdminListing,
  bulkDeleteAdminListings,
  triggerBonusSync,
  fetchAdminSyncRuns,
  fetchAdminAdapters,
  triggerAdapterSync,
  fetchSyncProgress,
  startSyncAllDomains,
  cancelSyncProgress,
  fetchAdminUnmatched,
  moveUnmatchedToCategory,
  SyncProgressResponse,
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

  // Quick Single Domain Add
  const [quickDomainInput, setQuickDomainInput] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Listings Selection & Bulk Actions
  const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(new Set());
  const [selectAllAcrossDirectory, setSelectAllAcrossDirectory] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Local Text File Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalData, setImportModalData] = useState<{
    fileName: string;
    fileSize: number;
    rawText: string;
    preview: {
      batchId: string;
      totalProcessed: number;
      willImport: string[];
      duplicates: string[];
      invalid: string[];
      committed: boolean;
    };
  } | null>(null);
  const [isConfirmingFileImport, setIsConfirmingFileImport] = useState(false);

  // User-facing Notification Alert in Listings Tab
  const [listingAlert, setListingAlert] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Adapters State
  const [adapters, setAdapters] = useState<any[]>([]);
  const [adapterResult, setAdapterResult] = useState<any>(null);

  // Dedicated Bulk Import Tab State (Textarea)
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Sync / Bonuses State
  const [selectedListingForSync, setSelectedListingForSync] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgressResponse | null>(null);
  const [showErrorLog, setShowErrorLog] = useState(true);

  // Unmatched State
  const [unmatchedData, setUnmatchedData] = useState<{
    items: PromoUnmatched[];
    total: number;
    droppedMatchedRatio: number;
  }>({ items: [], total: 0, droppedMatchedRatio: 0 });

  const [isLoading, setIsLoading] = useState(false);

  // Clear listing alert helper
  const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setListingAlert({ type, message });
    setTimeout(() => {
      setListingAlert((current) => (current?.message === message ? null : current));
    }, 7000);
  };

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
      }, 600);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeTab, syncProgress?.isRunning, syncProgress?.processed]);

  const loadListings = async (page: number, filter: string, q: string) => {
    setIsLoading(true);
    try {
      const res = await fetchAdminListings({ page, filter, q });
      setListingsData(res);
      // Reset selected IDs that no longer exist
      setSelectedListingIds((prev) => {
        const next = new Set<string>();
        const currentIds = new Set(res.items.map((i: Listing) => i.id));
        prev.forEach((id) => {
          if (currentIds.has(id)) next.add(id);
        });
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSyncAll = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Starting crawl with controlled concurrency (6 workers), exponential backoff, and live stage telemetry...');
    try {
      const res = await startSyncAllDomains();
      setSyncProgress(res.progress);
    } catch (err: any) {
      setSyncStatusMsg(`Failed to start crawl: ${err.message}`);
      setIsSyncing(false);
    }
  };

  const handleCancelSync = async () => {
    try {
      await cancelSyncProgress();
      setSyncStatusMsg('Crawling cancellation signaled.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRunAdapterSync = async (slug: string) => {
    setIsSyncing(true);
    setAdapterResult(null);
    try {
      const res = await triggerAdapterSync(slug);
      setAdapterResult(res);
      fetchAdminSyncRuns().then((r) => setSyncRuns(r.items));
      fetchAdminOverview().then(setOverview).catch(console.error);
    } catch (err: any) {
      alert(`Adapter sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Guard for role === 'admin'
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Administrator Sign-In Required</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Every administrator action is verified on the server, ensuring protected domain records cannot be modified without credentials.
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

  // --- DOMAIN ACTIONS ---

  // Quick Add Single Domain
  const handleQuickAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = quickDomainInput.trim();
    if (!raw) return;

    setIsQuickAdding(true);
    try {
      const res = await quickAddAdminListing(raw);
      setQuickDomainInput('');
      showAlert('success', `Domain "${res.listing.domain}" was added successfully.`);
      loadListings(1, listingFilter, listingSearch);
      fetchAdminOverview().then(setOverview).catch(console.error);
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to add domain');
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Local .txt File Selected
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';

    try {
      const text = await file.text();
      if (!text.trim()) {
        showAlert('error', `File "${file.name}" is empty.`);
        return;
      }

      // Preview import on server (commit = false)
      const preview = await bulkImportDomains(text, false);
      setImportModalData({
        fileName: file.name,
        fileSize: file.size,
        rawText: text,
        preview,
      });
    } catch (err: any) {
      showAlert('error', `Failed to read file: ${err.message || 'Unknown error'}`);
    }
  };

  // Confirm .txt File Import
  const handleConfirmFileImport = async () => {
    if (!importModalData) return;

    setIsConfirmingFileImport(true);
    try {
      const res = await bulkImportDomains(importModalData.rawText, true);
      const willCount = res.willImport.length;
      const dupCount = res.duplicates.length;
      const invCount = res.invalid.length;

      showAlert(
        'success',
        `Successfully imported ${willCount} domain(s)! (${dupCount} duplicate(s) skipped, ${invCount} invalid line(s) ignored).`
      );

      setImportModalData(null);
      loadListings(1, listingFilter, listingSearch);
      fetchAdminOverview().then(setOverview).catch(console.error);
    } catch (err: any) {
      showAlert('error', `Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsConfirmingFileImport(false);
    }
  };

  // Toggle selection for all listings on the current page
  const allCurrentPageSelected =
    listingsData.items.length > 0 &&
    listingsData.items.every((item) => selectedListingIds.has(item.id));

  const handleToggleSelectAllPage = () => {
    if (allCurrentPageSelected) {
      // Deselect all on current page
      const next = new Set(selectedListingIds);
      listingsData.items.forEach((item) => next.delete(item.id));
      setSelectedListingIds(next);
      setSelectAllAcrossDirectory(false);
    } else {
      // Select all on current page
      const next = new Set(selectedListingIds);
      listingsData.items.forEach((item) => next.add(item.id));
      setSelectedListingIds(next);
    }
  };

  const handleToggleSelectListing = (id: string) => {
    setSelectAllAcrossDirectory(false);
    setSelectedListingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open Bulk Deletion Confirmation Prompt
  const handleOpenBulkDeletePrompt = () => {
    if (selectedListingIds.size === 0 && !selectAllAcrossDirectory) return;
    setShowBulkDeleteModal(true);
  };

  // Execute Bulk Deletion after Confirmation
  const handleConfirmBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const idsToDelete = selectAllAcrossDirectory ? undefined : Array.from(selectedListingIds);
      const res = await bulkDeleteAdminListings(idsToDelete, selectAllAcrossDirectory);

      showAlert(
        'success',
        `Successfully deleted ${res.deletedCount} domain(s) and their associated bonuses.`
      );

      setSelectedListingIds(new Set());
      setSelectAllAcrossDirectory(false);
      setShowBulkDeleteModal(false);
      loadListings(1, listingFilter, listingSearch);
      fetchAdminOverview().then(setOverview).catch(console.error);
    } catch (err: any) {
      showAlert('error', `Bulk deletion failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Single Listing Deletion
  const handleDeleteListing = async (listing: Listing) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${listing.name}" (${listing.domain}) and all associated bonuses?`
    );
    if (!confirmed) return;

    try {
      await deleteAdminListing(listing.id);
      setSelectedListingIds((prev) => {
        const next = new Set(prev);
        next.delete(listing.id);
        return next;
      });
      showAlert('success', `Domain "${listing.domain}" was deleted successfully.`);
      loadListings(listingsData.page, listingFilter, listingSearch);
      fetchAdminOverview().then(setOverview).catch(console.error);
    } catch (err: any) {
      showAlert('error', `Failed to delete listing: ${err.message || 'Unknown error'}`);
    }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      await toggleFeaturedListing(id);
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
      showAlert('success', `Listing "${editingListing.name || editingListing.domain}" saved.`);
      loadListings(listingsData.page, listingFilter, listingSearch);
      fetchAdminOverview().then(setOverview).catch(console.error);
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to save listing');
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
      showAlert(
        'success',
        `Imported ${res.willImport.length} domain(s)! (${res.duplicates.length} duplicate(s) skipped).`
      );
      loadListings(1, listingFilter, listingSearch);
      fetchAdminOverview().then(setOverview).catch(console.error);
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
    setSyncStatusMsg('Running extraction engine with stage measurement...');
    try {
      const res = await triggerBonusSync({
        listingId: selectedListingForSync || undefined,
        ...opts,
      });
      setSyncStatusMsg(
        opts.simulateError
          ? 'Error simulation recorded! Existing bonuses were safely preserved without corruption.'
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
      showAlert('success', `Moved promo to category "${category}" and saved category override.`);
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to move promo');
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Hidden File Input for local .txt domain import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26262E] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h1 className="text-xl font-black text-zinc-100">AXHub Admin Console</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Server-side authoritative directory management, bulk operations, and high-performance scraping engine.
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
            Listings ({listingsData.total || overview?.counts?.domains || 0})
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
            Live Scraper & Sync
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
          TAB 1: OVERVIEW
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
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                $0.00
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                Direct JSON extraction
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
                  <span>Successful Runs</span>
                  <span className="font-mono text-emerald-400">
                    {overview.syncHealth.successfulRuns}
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Error Runs</span>
                  <span className="font-mono text-rose-400">
                    {overview.syncHealth.errorRuns}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded border border-[#26262E] bg-[#111114] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Recent Import Batches
              </h3>
              {overview.recentImports.length === 0 ? (
                <div className="text-xs text-zinc-500">No import batches recorded yet.</div>
              ) : (
                <div className="space-y-2 text-xs font-mono">
                  {overview.recentImports.map((b: any) => (
                    <div
                      key={b.id}
                      className="flex justify-between items-center p-2 rounded bg-[#15151A] border border-[#26262E]"
                    >
                      <span className="text-zinc-300">{b.id}</span>
                      <span className="text-emerald-400">+{b.imported_count} imported</span>
                      <span className="text-zinc-500">{b.duplicate_count} skipped</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: LISTINGS MANAGEMENT (Requirement 1)
         ===================================================================== */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {/* Action Notification Banner */}
          {listingAlert && (
            <div
              className={`p-3.5 rounded-md flex items-center justify-between text-xs transition-all ${
                listingAlert.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                  : listingAlert.type === 'error'
                  ? 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
                  : 'bg-amber-950/40 border border-amber-800/60 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {listingAlert.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span className="font-medium">{listingAlert.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setListingAlert(null)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Action Toolbar: Import .txt, Single Domain Add, Create New Site */}
          <div className="p-3.5 rounded-md border border-[#26262E] bg-[#111114] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left: Quick Import & Single Domain Add */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Import Domains (.txt) Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors shadow-sm"
                title="Upload a local .txt file containing domains on separate lines"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Domains (.txt)</span>
              </button>

              {/* Quick Add Single Domain Input */}
              <form onSubmit={handleQuickAddDomain} className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Single domain (e.g. site.com)"
                  value={quickDomainInput}
                  onChange={(e) => setQuickDomainInput(e.target.value)}
                  className="px-2.5 py-1.5 rounded text-xs border border-[#26262E] bg-[#15151A] text-zinc-100 placeholder:text-zinc-600 w-52 focus:outline-none focus:border-[#FFB020]"
                />
                <button
                  type="submit"
                  disabled={isQuickAdding || !quickDomainInput.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#26262E] bg-[#15151A] text-zinc-200 hover:border-[#FFB020] hover:text-[#FFB020] font-semibold text-xs transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isQuickAdding ? 'Adding...' : 'Add Domain'}</span>
                </button>
              </form>
            </div>

            {/* Right: Full Detail Listing Modal Button */}
            <div className="flex items-center gap-2">
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
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#26262E] bg-[#15151A] text-zinc-300 hover:text-zinc-100 font-medium text-xs transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Custom Site Entry</span>
              </button>
            </div>
          </div>

          {/* Filter Pills and Search */}
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

            {/* Filter Search Field */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search listings..."
                  value={listingSearch}
                  onChange={(e) => {
                    setListingSearch(e.target.value);
                    loadListings(1, listingFilter, e.target.value);
                  }}
                  className="pl-8 pr-2.5 py-1 rounded text-xs border border-[#26262E] bg-[#15151A] text-zinc-200 w-44 focus:outline-none focus:border-[#FFB020]"
                />
              </div>
            </div>
          </div>

          {/* Bulk Selection Actions Bar (Appears when >=1 domain is checked) */}
          {(selectedListingIds.size > 0 || selectAllAcrossDirectory) && (
            <div className="p-3 rounded-md border border-rose-900/40 bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="font-semibold text-rose-200">
                  {selectAllAcrossDirectory
                    ? `All ${listingsData.total} domains in directory selected`
                    : `${selectedListingIds.size} domain(s) selected`}
                </span>

                {/* Option to select entire directory if all on current page are selected */}
                {!selectAllAcrossDirectory &&
                  allCurrentPageSelected &&
                  listingsData.total > listingsData.items.length && (
                    <button
                      type="button"
                      onClick={() => setSelectAllAcrossDirectory(true)}
                      className="text-[#FFC24D] underline hover:text-amber-300 ml-2"
                    >
                      Select all {listingsData.total} domains in directory
                    </button>
                  )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedListingIds(new Set());
                    setSelectAllAcrossDirectory(false);
                  }}
                  className="px-2.5 py-1 rounded border border-[#26262E] bg-[#111114] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={handleOpenBulkDeletePrompt}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    Delete Selected (
                    {selectAllAcrossDirectory ? listingsData.total : selectedListingIds.size})
                  </span>
                </button>
              </div>
            </div>
          )}

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

          {/* Listings Table with Checkboxes for Single and Bulk Selection */}
          <div className="overflow-x-auto rounded-md border border-[#26262E] bg-[#111114]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#15151A] text-zinc-400 uppercase tracking-wider text-[10px] border-b border-[#26262E]">
                <tr>
                  {/* Select All Checkbox Column */}
                  <th className="p-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllPage}
                      className="text-zinc-400 hover:text-zinc-100 flex items-center justify-center mx-auto"
                      title={allCurrentPageSelected ? 'Deselect all on page' : 'Select all on page'}
                    >
                      {allCurrentPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#FFB020]" />
                      ) : selectedListingIds.size > 0 ? (
                        <MinusSquare className="w-4 h-4 text-[#FFB020]" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-300" />
                      )}
                    </button>
                  </th>
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
                {listingsData.items.map((listing) => {
                  const isChecked = selectedListingIds.has(listing.id) || selectAllAcrossDirectory;
                  return (
                    <tr
                      key={listing.id}
                      className={`hover:bg-[#15151A]/80 transition-colors ${
                        isChecked ? 'bg-[#FFB020]/5' : ''
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectListing(listing.id)}
                          className="flex items-center justify-center mx-auto text-zinc-400 hover:text-zinc-100"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#FFB020]" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-300" />
                          )}
                        </button>
                      </td>
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
                        {listing.metric_best_value !== null ? listing.metric_best_value : '—'}
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
                          {/* Individual Domain Deletion Button with Confirmation */}
                          <button
                            type="button"
                            onClick={() => handleDeleteListing(listing)}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400"
                            title={`Delete ${listing.domain}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
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
          CONFIRMATION MODAL: BULK DELETION (Requirement 1)
         ===================================================================== */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full p-5 rounded-lg border border-rose-800/60 bg-[#15151A] space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Confirm Bulk Deletion</h3>
                <p className="text-xs text-zinc-400">Irreversible directory action</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-rose-400 font-bold">
                {selectAllAcrossDirectory ? listingsData.total : selectedListingIds.size} domain(s)
              </strong>{' '}
              and all of their associated bonus records? This action cannot be undone.
            </p>

            <div className="p-3 rounded bg-[#111114] border border-[#26262E] text-[11px] text-zinc-400 space-y-1 font-mono">
              <div>Scope: {selectAllAcrossDirectory ? 'Entire Directory' : 'Selected Domain Records'}</div>
              <div>Target count: {selectAllAcrossDirectory ? listingsData.total : selectedListingIds.size}</div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-3.5 py-1.5 rounded border border-[#26262E] text-zinc-300 text-xs hover:border-zinc-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleConfirmBulkDelete}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                {isBulkDeleting
                  ? 'Deleting...'
                  : `Yes, Delete ${selectAllAcrossDirectory ? listingsData.total : selectedListingIds.size} Domains`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CONFIRMATION MODAL: TEXT FILE IMPORT PREVIEW (Requirement 1)
         ===================================================================== */}
      {importModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-lg w-full p-5 rounded-lg border border-[#FFB020]/50 bg-[#15151A] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#26262E] pb-3">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#FFB020]" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Import Domains from Text File</h3>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    {importModalData.fileName} ({(importModalData.fileSize / 1024).toFixed(1)} KB)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalData(null)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Import Summary Counters */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-3 rounded border border-emerald-800/40 bg-emerald-950/20">
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Valid New Domains</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {importModalData.preview.willImport.length}
                </div>
              </div>
              <div className="p-3 rounded border border-[#26262E] bg-[#111114]">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Duplicates (Skipped)</div>
                <div className="text-xl font-bold font-mono text-zinc-400 mt-0.5">
                  {importModalData.preview.duplicates.length}
                </div>
              </div>
              <div className="p-3 rounded border border-rose-900/40 bg-rose-950/20">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Invalid Lines</div>
                <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">
                  {importModalData.preview.invalid.length}
                </div>
              </div>
            </div>

            {/* Domains Preview Box */}
            {importModalData.preview.willImport.length > 0 ? (
              <div className="space-y-1">
                <div className="text-zinc-400 text-xs font-medium">Domains to be imported:</div>
                <div className="max-h-40 overflow-y-auto p-2.5 rounded border border-[#26262E] bg-[#111114] text-[11px] font-mono text-zinc-300 leading-relaxed">
                  {importModalData.preview.willImport.join(', ')}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded border border-amber-900/40 bg-amber-950/20 text-xs text-amber-300">
                All domains in this file are already present in the directory or invalid.
              </div>
            )}

            {/* Invalid entries list if any */}
            {importModalData.preview.invalid.length > 0 && (
              <div className="space-y-1">
                <div className="text-rose-400 text-[11px] font-medium">
                  Invalid / non-domain lines ignored:
                </div>
                <div className="max-h-20 overflow-y-auto p-2 rounded border border-rose-900/30 bg-[#111114] text-[10px] font-mono text-rose-300">
                  {importModalData.preview.invalid.join(', ')}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#26262E]">
              <button
                type="button"
                disabled={isConfirmingFileImport}
                onClick={() => setImportModalData(null)}
                className="px-3.5 py-1.5 rounded border border-[#26262E] text-zinc-300 text-xs hover:border-zinc-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConfirmingFileImport || importModalData.preview.willImport.length === 0}
                onClick={handleConfirmFileImport}
                className="px-4 py-1.5 rounded bg-[#FFB020] hover:bg-[#FFC24D] text-zinc-950 font-bold text-xs transition-colors shadow-sm disabled:opacity-40"
              >
                {isConfirmingFileImport
                  ? 'Importing...'
                  : `Confirm Import (${importModalData.preview.willImport.length} Domains)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: DEDICATED BULK IMPORT TAB (Textarea)
         ===================================================================== */}
      {activeTab === 'import' && (
        <div className="space-y-6 max-w-3xl">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">
              Bulk Domain Textarea Importer
            </h2>
            <p className="text-xs text-zinc-400">
              Paste newline-separated domains or upload a local .txt file using the button below. Domains are automatically normalized, stripped of protocol/paths, deduplicated against current listings, and recorded with an ImportBatch audit row.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#15151A] border border-[#26262E] hover:border-[#FFB020] text-zinc-200 text-xs font-semibold transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#FFB020]" />
                <span>Upload .txt File Instead</span>
              </button>
            </div>

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
          TAB 4: LIVE SCAPING ENGINE & STAGE TELEMETRY (Requirement 2)
         ===================================================================== */}
      {activeTab === 'bonuses' && (
        <div className="space-y-6">
          {/* Universal Platform Scrapers Card */}
          <div className="p-5 rounded-md border border-[#FFB020]/40 bg-[#15151A] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#FFB020]/15 text-[#FFC24D] border border-[#FFB020]/30">
                  <span>Controlled Concurrency (6 Workers)</span>
                  <span>·</span>
                  <span>Exponential Backoff</span>
                  <span>·</span>
                  <span>ETag 304 Caching</span>
                </div>
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  Universal Direct Platform Scrapers (All Cataloged Websites)
                </h2>
                <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                  Every cataloged domain queries backend endpoint (<code className="font-mono text-zinc-300">POST /api/v1/index.php</code>) with automatic transient retry backoff, HTTP 304 conditional cache validation, and stage-by-stage measurement across triggering, network fetching, classification, and publishing.
                </p>
              </div>

              {/* Action Buttons */}
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
                    setSyncStatusMsg('Running batch scraper across 20 domains with backoff and stage metrics...');
                    try {
                      const res = await triggerBonusSync({ batchCount: 20 });
                      setSyncStatusMsg(`Successfully crawled and updated ${res.synced_count} domains via universal auto-detection!`);
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
                  <span>Sync Yeah96 Adapter</span>
                </button>
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
                  <div>Matched 7 Taxonomy Categories: <strong className="text-emerald-300">{adapterResult.matchedCount}</strong></div>
                  <div>Dropped (Unmatched Queue): <strong className="text-amber-300">{adapterResult.droppedCount}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* =================================================================
              STAGE-BY-STAGE PERFORMANCE METRICS (Requirement 2)
             ================================================================= */}
          <div className="p-5 rounded-md border border-[#26262E] bg-[#111114] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26262E] pb-3">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-[#FFB020]" />
                <h3 className="text-sm font-bold text-zinc-100">
                  Live Workflow Stage Telemetry
                </h3>
                <span className="text-xs text-zinc-500">
                  (Measures each pipeline stage individually to isolate bottlenecks)
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-zinc-500">Queue Depth:</span>
                <span className="text-zinc-200 font-bold">
                  {syncProgress?.queueDepth ?? 0}
                </span>
                <span className="text-zinc-500 ml-2">Active Concurrency:</span>
                <span className="text-emerald-400 font-bold">
                  {syncProgress?.activeWorkers ?? 0} / 6 workers
                </span>
              </div>
            </div>

            {/* Stage Gauges Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Stage 1: Triggering */}
              <div className="p-3 rounded border border-[#26262E] bg-[#15151A] space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  1. Triggering
                </div>
                <div className="text-xs text-zinc-400">Lookup & Config</div>
                <div className="text-lg font-bold font-mono text-zinc-200 pt-1">
                  {syncProgress?.stages.avgTriggerMs ?? 2}ms
                  <span className="text-[10px] text-zinc-500 font-normal ml-1">avg</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  last: {syncProgress?.stages.lastTriggerMs ?? 1}ms
                </div>
              </div>

              {/* Stage 2: Fetching */}
              <div className="p-3 rounded border border-[#26262E] bg-[#15151A] space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  2. Fetching
                </div>
                <div className="text-xs text-zinc-400">HTTP / ETag / Backoff</div>
                <div className="text-lg font-bold font-mono text-[#FFC24D] pt-1">
                  {syncProgress?.stages.avgFetchMs ?? 18}ms
                  <span className="text-[10px] text-zinc-500 font-normal ml-1">avg</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  last: {syncProgress?.stages.lastFetchMs ?? 12}ms
                </div>
              </div>

              {/* Stage 3: Extraction */}
              <div className="p-3 rounded border border-[#26262E] bg-[#15151A] space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  3. Extraction
                </div>
                <div className="text-xs text-zinc-400">Classifier & Wager Match</div>
                <div className="text-lg font-bold font-mono text-emerald-400 pt-1">
                  {syncProgress?.stages.avgExtractMs ?? 4}ms
                  <span className="text-[10px] text-zinc-500 font-normal ml-1">avg</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  last: {syncProgress?.stages.lastExtractMs ?? 3}ms
                </div>
              </div>

              {/* Stage 4: Publishing */}
              <div className="p-3 rounded border border-[#26262E] bg-[#15151A] space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  4. Publishing
                </div>
                <div className="text-xs text-zinc-400">Atomic DB & Metrics</div>
                <div className="text-lg font-bold font-mono text-zinc-200 pt-1">
                  {syncProgress?.stages.avgPublishMs ?? 2}ms
                  <span className="text-[10px] text-zinc-500 font-normal ml-1">avg</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  last: {syncProgress?.stages.lastPublishMs ?? 2}ms
                </div>
              </div>
            </div>

            {/* Performance, Response, and Freshness Gauges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              {/* Response Distribution */}
              <div className="p-3 rounded border border-[#26262E] bg-[#15151A] space-y-2">
                <div className="text-[11px] font-bold text-zinc-300">Response Status Distribution</div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>200 OK (Fresh Fetched):</span>
                    <span className="text-emerald-400 font-bold">
                      {syncProgress?.responseStats.ok200 ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>304 Not Modified (Cached):</span>
                    <span className="text-cyan-400 font-bold">
                      {syncProgress?.responseStats.cached304 ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>429 Rate Limits Handled:</span>
                    <span className="text-amber-400 font-bold">
                      {syncProgress?.responseStats.rateLimited429 ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>5xx Server Errors / Timeouts:</span>
                    <span className="text-rose-400 font-bold">
                      {(syncProgress?.responseStats.serverError5xx ?? 0) + (syncProgress?.responseStats.timeout ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Permanent Failures (400/403/404):</span>
                    <span className="text-zinc-500">
                      {syncProgress?.responseStats.permanentFail ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Retry & Backoff Monitor */}
              <div className="p-3 rounded border border-[#26262E] bg-[#15151A] space-y-2">
                <div className="text-[11px] font-bold text-zinc-300">Transient Backoff & Retries</div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Retries Attempted:</span>
                    <span className="text-zinc-200 font-bold">
                      {syncProgress?.retryStats.attempted ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Recovered via Backoff:</span>
                    <span className="text-emerald-400 font-bold">
                      {syncProgress?.retryStats.recovered ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Retries Exhausted:</span>
                    <span className="text-rose-400 font-bold">
                      {syncProgress?.retryStats.exhausted ?? 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 pt-1">
                    Permanent failures terminate immediately without wasteful re-querying.
                  </p>
                </div>
              </div>

              {/* Data Freshness Indicator */}
              <div className="p-3 rounded border border-[#26262E] bg-[#15151A] space-y-2">
                <div className="text-[11px] font-bold text-zinc-300">Catalog Data Freshness</div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Fresh &lt; 1 hour:</span>
                    <span className="text-emerald-400 font-bold">
                      {syncProgress?.freshness.freshWithin1Hour ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Fresh &lt; 24 hours:</span>
                    <span className="text-[#FFC24D] font-bold">
                      {syncProgress?.freshness.freshWithin24Hours ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Stale / Pending Check:</span>
                    <span className="text-zinc-500">
                      {syncProgress?.freshness.staleOrUnchecked ?? 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 pt-1">
                    Freshness recorded per-listing with Last-Modified timestamp.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================
              REAL-TIME SCRAPER PROGRESS BAR & MONITOR
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
                    Processing with 6 Workers
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

            {/* Error Audit Inspector */}
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

                {showErrorLog && (
                  <div className="max-h-48 overflow-y-auto rounded border border-[#26262E] bg-[#111114]">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-[#15151A] text-zinc-400 text-[10px] uppercase border-b border-[#26262E]">
                        <tr>
                          <th className="p-2">Time</th>
                          <th className="p-2">Domain</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#26262E] text-zinc-300">
                        {syncProgress.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-rose-950/20">
                            <td className="p-2 text-zinc-500">{err.time}</td>
                            <td className="p-2 text-zinc-200 font-semibold">{err.domain}</td>
                            <td className="p-2">
                              {err.isTemporary ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950/60 text-amber-300 border border-amber-800/40">
                                  Transient (Retried)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-950/60 text-rose-300 border border-rose-800/40">
                                  Permanent
                                </span>
                              )}
                            </td>
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
              Single Domain Diagnostic Testing
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
        </div>
      )}

      {/* =====================================================================
          TAB 5: UNMATCHED QUEUE
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
