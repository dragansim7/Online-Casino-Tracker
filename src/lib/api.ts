/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStoredToken, getStoredUser } from './auth.ts';
import {
  BonusCategorySlug,
  Listing,
  PromoUnmatched,
  SortKey,
  SyncRun,
} from '../types/index.ts';

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const user = getStoredUser();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (user?.role) {
    headers['x-user-role'] = user.role;
  }
  return headers;
}

export async function fetchLiveCounts(): Promise<{
  domains: number;
  featured: number;
  verified: number;
}> {
  const res = await fetch('/api/counts');
  if (!res.ok) throw new Error('Failed to fetch counts');
  return res.json();
}

export interface DirectoryResponse {
  items: Listing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  selectedCategories: BonusCategorySlug[];
  availableSorts: { key: SortKey; label: string; isDisabled: boolean }[];
}

export async function fetchListings(params: {
  q?: string;
  cat?: BonusCategorySlug[];
  ver?: string;
  avail?: string;
  sort?: SortKey;
  page?: number;
  limit?: number;
}): Promise<DirectoryResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.cat && params.cat.length > 0) query.set('cat', params.cat.join(','));
  if (params.ver && params.ver !== 'all') query.set('ver', params.ver);
  if (params.avail && params.avail !== 'all') query.set('avail', params.avail);
  if (params.sort) query.set('sort', params.sort);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  const res = await fetch(`/api/listings?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch directory listings');
  return res.json();
}

export async function fetchListingDetail(id: string) {
  const res = await fetch(`/api/listings/${id}`);
  if (!res.ok) throw new Error('Failed to fetch listing detail');
  return res.json();
}

export async function recordListingClick(id: string) {
  return fetch(`/api/listings/${id}/click`, { method: 'POST' }).catch(() => {});
}

// Admin API calls
export async function fetchAdminOverview() {
  const res = await fetch('/api/admin/overview', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Unauthorized or failed to fetch admin overview');
  return res.json();
}

export async function fetchAdminListings(params: {
  filter?: string;
  page?: number;
  q?: string;
}) {
  const query = new URLSearchParams();
  if (params.filter) query.set('filter', params.filter);
  if (params.page) query.set('page', params.page.toString());
  if (params.q) query.set('q', params.q);

  const res = await fetch(`/api/admin/listings?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch admin listings');
  return res.json();
}

export async function saveAdminListing(listing: Partial<Listing>) {
  const res = await fetch('/api/admin/listings', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(listing),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to save listing');
  }
  return res.json();
}

export async function deleteAdminListing(id: string) {
  const res = await fetch(`/api/admin/listings/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete listing');
  return res.json();
}

export async function toggleFeaturedListing(id: string) {
  const res = await fetch(`/api/admin/listings/${id}/toggle-featured`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to toggle featured status');
  return res.json();
}

export async function updateAdminToggles(
  id: string,
  hidden_categories: BonusCategorySlug[],
  category_overrides: Record<string, BonusCategorySlug>
) {
  const res = await fetch(`/api/admin/listings/${id}/toggles`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ hidden_categories, category_overrides }),
  });
  if (!res.ok) throw new Error('Failed to update toggles');
  return res.json();
}

export async function bulkImportDomains(rawText: string, commit: boolean) {
  const res = await fetch('/api/admin/import', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ rawText, commit }),
  });
  if (!res.ok) throw new Error('Failed to process bulk import');
  return res.json();
}

export async function triggerBonusSync(options: {
  listingId?: string;
  simulateError?: boolean;
  simulateNoFeed?: boolean;
  simulateNoOffers?: boolean;
  batchCount?: number;
}) {
  const res = await fetch('/api/admin/bonuses/sync', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error('Failed to trigger bonus sync');
  return res.json();
}

export async function fetchAdminAdapters() {
  const res = await fetch('/api/admin/adapters', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch adapters');
  return res.json();
}

export async function triggerAdapterSync(slug: string) {
  const res = await fetch(`/api/admin/adapters/${slug}/sync`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Adapter sync failed');
  return res.json();
}

export async function fetchAdminUnmatched(): Promise<{
  items: PromoUnmatched[];
  total: number;
  droppedMatchedRatio: number;
}> {
  const res = await fetch('/api/admin/unmatched', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch unmatched promos');
  return res.json();
}

export async function moveUnmatchedToCategory(
  unmatchedId: string,
  targetCategory: BonusCategorySlug
) {
  const res = await fetch(`/api/admin/unmatched/${unmatchedId}/move`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetCategory }),
  });
  if (!res.ok) throw new Error('Failed to move unmatched promo');
  return res.json();
}

export async function fetchAdminSyncRuns(): Promise<{ items: SyncRun[] }> {
  const res = await fetch('/api/admin/sync-runs', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch sync runs');
  return res.json();
}
