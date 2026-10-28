/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, RefreshCw, Zap } from 'lucide-react';
import {
  fetchListings,
  getCachedListings,
  prefetchListings,
  DirectoryResponse,
} from '../lib/api.ts';
import { BonusCategorySlug, SortKey } from '../types/index.ts';
import { ListingCard } from '../components/ListingCard.tsx';
import { ListingCardSkeleton } from '../components/ListingCardSkeleton.tsx';
import { FilterSortBar } from '../components/FilterSortBar.tsx';
import { CATEGORY_MAP } from '../constants/taxonomy.ts';
import { getNaturalSortForCategory } from '../lib/sortResolver.ts';

export const Directory: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query params
  const qParam = searchParams.get('q') || '';
  const catParam = searchParams.get('cat') || '';
  const verParam = searchParams.get('ver') || 'all';
  const availParam = searchParams.get('avail') || 'all';
  const sortParam = (searchParams.get('sort') as SortKey) || 'domain_az';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const selectedCategories: BonusCategorySlug[] = catParam
    ? (catParam.split(',').filter(Boolean) as BonusCategorySlug[])
    : [];

  const [searchInput, setSearchInput] = useState(qParam);

  // Initial synchronous check against in-memory query cache
  const currentParams = {
    q: qParam,
    cat: selectedCategories,
    ver: verParam,
    avail: availParam,
    sort: sortParam,
    page: pageParam,
    limit: 24,
  };

  const [data, setData] = useState<DirectoryResponse | null>(() => getCachedListings(currentParams));
  const [isFetching, setIsFetching] = useState<boolean>(() => !getCachedListings(currentParams));

  // Sync search input if URL changes externally
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  // Fetch directory listings with AbortController for instant network cancellation
  useEffect(() => {
    const controller = new AbortController();
    setIsFetching(true);

    fetchListings({
      ...currentParams,
      signal: controller.signal,
    })
      .then((res) => {
        setData(res);
        setIsFetching(false);
      })
      .catch((err: any) => {
        // Ignore aborted requests from rapid user filter clicks
        if (err?.name !== 'AbortError') {
          console.error('Failed to fetch listings:', err);
          setIsFetching(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [qParam, catParam, verParam, availParam, sortParam, pageParam]);

  // Update URL helper
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === undefined || val === '' || val === 'all') {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }
    setSearchParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ q: searchInput.trim(), page: '1' });
  };

  const handleCategoryChange = (cats: BonusCategorySlug[], newDefaultSort?: SortKey) => {
    updateUrlParams({
      cat: cats.length > 0 ? cats.join(',') : null,
      sort: newDefaultSort || sortParam,
      page: '1',
    });
  };

  const handleVerificationChange = (ver: string) => {
    updateUrlParams({ ver, page: '1' });
  };

  const handleAvailabilityChange = (avail: string) => {
    updateUrlParams({ avail, page: '1' });
  };

  const handleSortChange = (sort: SortKey) => {
    updateUrlParams({ sort, page: '1' });
  };

  const handleClearFilters = () => {
    updateUrlParams({
      q: null,
      cat: null,
      ver: null,
      avail: null,
      sort: 'domain_az',
      page: '1',
    });
    setSearchInput('');
  };

  const handlePageChange = (newPage: number) => {
    updateUrlParams({ page: newPage.toString() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Prefetch adjacent pagination on hover / focus
  const handlePrefetchPage = (p: number) => {
    if (p < 1 || (data && p > data.totalPages)) return;
    prefetchListings({
      ...currentParams,
      page: p,
    });
  };

  // Prefetch category on hover
  const handleHoverCategory = (slug: BonusCategorySlug) => {
    let next: BonusCategorySlug[];
    let naturalSort = sortParam;
    if (selectedCategories.includes(slug)) {
      next = selectedCategories.filter((c) => c !== slug);
      if (next.length === 1) {
        naturalSort = getNaturalSortForCategory(next[0]) || sortParam;
      } else if (next.length === 0) {
        naturalSort = 'domain_az';
      }
    } else {
      next = [...selectedCategories, slug];
      if (next.length === 1) {
        naturalSort = getNaturalSortForCategory(slug) || sortParam;
      }
    }
    prefetchListings({
      q: qParam,
      cat: next,
      ver: verParam,
      avail: availParam,
      sort: naturalSort,
      page: 1,
      limit: 24,
    });
  };

  // Human-readable summary of active filter for empty state
  const activeFiltersDescription = [
    selectedCategories.length > 0
      ? `categories [${selectedCategories.map((c) => CATEGORY_MAP.get(c)?.chipLabel || c).join(', ')}]`
      : null,
    verParam !== 'all' ? `verification "${verParam}"` : null,
    availParam !== 'all' ? `availability "${availParam}"` : null,
    qParam ? `search query "${qParam}"` : null,
  ]
    .filter(Boolean)
    .join(' and ');

  return (
    <div className="space-y-6 py-4">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">
            Domain Directory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Searchable directory with verified bonus metrics and filter-aware sorting.
          </p>
        </div>

        {/* Directory Search Form */}
        <form
          role="search"
          onSubmit={handleSearchSubmit}
          className="relative w-full md:w-80"
        >
          <Search className="absolute left-3 w-4 h-4 text-zinc-500 pointer-events-none top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search domain or casino name..."
            className="w-full pl-9 pr-16 py-2 rounded-md border border-[#26262E] bg-[#15151A] text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-[#FFB020]"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded bg-[#FFB020] text-zinc-950 font-semibold text-[11px] hover:bg-[#FFC24D]"
          >
            Find
          </button>
        </form>
      </div>

      {/* Filter and Sort Controls */}
      <FilterSortBar
        selectedCategories={selectedCategories}
        verification={verParam}
        availability={availParam}
        currentSort={sortParam}
        availableSorts={data?.availableSorts || []}
        resultCount={data?.total ?? 0}
        onSelectCategory={handleCategoryChange}
        onSelectVerification={handleVerificationChange}
        onSelectAvailability={handleAvailabilityChange}
        onSelectSort={handleSortChange}
        onClearFilters={handleClearFilters}
        onHoverCategory={handleHoverCategory}
      />

      {/* Zero-Flicker Synchronisation Progress Line */}
      <div className="h-0.5 w-full bg-[#1A1A22] overflow-hidden rounded-full transition-opacity duration-300">
        {isFetching && (
          <div className="h-full bg-gradient-to-r from-transparent via-[#FFB020] to-transparent w-full animate-pulse" />
        )}
      </div>

      {/* Listing Cards Grid / Skeletons / Empty State */}
      {!data && isFetching ? (
        /* Cold Load: Render exact-match skeletons to eliminate Cumulative Layout Shift */
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <Zap className="w-3.5 h-3.5 text-[#FFB020] animate-pulse" />
            <span>Syncing verified domain bonuses...</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : data?.items && data.items.length > 0 ? (
        /* Retain Previous Cards during background revalidation (Zero Flicker) */
        <div className="space-y-6">
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-150 ${
              isFetching ? 'opacity-80 pointer-events-none' : 'opacity-100'
            }`}
          >
            {data.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {/* Pagination Controls */}
          {data.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#26262E]">
              <div className="text-xs text-zinc-500 font-mono flex items-center gap-2">
                <span>
                  Page {data.page} of {data.totalPages} ({data.total} total listings)
                </span>
                {isFetching && (
                  <span className="text-[10px] text-[#FFB020] font-sans">
                    Updating...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={data.page <= 1}
                  onClick={() => handlePageChange(data.page - 1)}
                  onMouseEnter={() => handlePrefetchPage(data.page - 1)}
                  onFocus={() => handlePrefetchPage(data.page - 1)}
                  className="px-3 py-1.5 rounded text-xs font-medium border border-[#26262E] bg-[#15151A] text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#FFB020]/40 transition-colors"
                >
                  Previous
                </button>

                {/* Page Jump Numbers */}
                {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (data.totalPages > 5 && data.page > 3) {
                    pNum = data.page - 3 + i;
                    if (pNum > data.totalPages) pNum = data.totalPages - (4 - i);
                  }
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => handlePageChange(pNum)}
                      onMouseEnter={() => handlePrefetchPage(pNum)}
                      onFocus={() => handlePrefetchPage(pNum)}
                      className={`w-8 h-8 rounded text-xs font-mono font-medium border transition-colors ${
                        data.page === pNum
                          ? 'border-[#FFB020] bg-[#FFB020] text-zinc-950 font-bold'
                          : 'border-[#26262E] bg-[#15151A] text-zinc-300 hover:border-[#FFB020]/40'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={data.page >= data.totalPages}
                  onClick={() => handlePageChange(data.page + 1)}
                  onMouseEnter={() => handlePrefetchPage(data.page + 1)}
                  onFocus={() => handlePrefetchPage(data.page + 1)}
                  className="px-3 py-1.5 rounded text-xs font-medium border border-[#26262E] bg-[#15151A] text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#FFB020]/40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center rounded-md border border-[#26262E] bg-[#111114] space-y-4">
          <div className="text-zinc-300 font-semibold text-base">
            No listings matched your criteria
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Zero domains found matching{' '}
            <strong className="text-zinc-200">
              {activeFiltersDescription || 'all applied filters'}
            </strong>
            .
          </p>
          <div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FFB020] text-zinc-950 font-semibold text-xs hover:bg-[#FFC24D] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Clear filters</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
