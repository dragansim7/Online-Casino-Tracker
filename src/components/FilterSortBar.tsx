/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ArrowUpDown, Filter } from 'lucide-react';
import { BONUS_CATEGORIES, CATEGORY_MAP } from '../constants/taxonomy.ts';
import { BonusCategorySlug, SortKey } from '../types/index.ts';
import { getNaturalSortForCategory } from '../lib/sortResolver.ts';

interface FilterSortBarProps {
  selectedCategories: BonusCategorySlug[];
  verification: string;
  availability: string;
  currentSort: SortKey;
  availableSorts: { key: SortKey; label: string; isDisabled: boolean }[];
  resultCount: number;
  onSelectCategory: (categories: BonusCategorySlug[], newDefaultSort?: SortKey) => void;
  onSelectVerification: (ver: string) => void;
  onSelectAvailability: (avail: string) => void;
  onSelectSort: (sort: SortKey) => void;
  onClearFilters: () => void;
  onHoverCategory?: (slug: BonusCategorySlug) => void;
}

export const FilterSortBar: React.FC<FilterSortBarProps> = ({
  selectedCategories,
  verification,
  availability,
  currentSort,
  availableSorts,
  resultCount,
  onSelectCategory,
  onSelectVerification,
  onSelectAvailability,
  onSelectSort,
  onClearFilters,
  onHoverCategory,
}) => {
  const hasActiveFilters =
    selectedCategories.length > 0 || verification !== 'all' || availability !== 'all';

  // Toggle category chip
  const handleToggleCategory = (slug: BonusCategorySlug) => {
    let next: BonusCategorySlug[];
    let naturalSort: SortKey | undefined = undefined;

    if (selectedCategories.includes(slug)) {
      next = selectedCategories.filter((c) => c !== slug);
      if (next.length === 1) {
        naturalSort = getNaturalSortForCategory(next[0]);
      } else if (next.length === 0) {
        naturalSort = 'domain_az'; // Clearing restores domain_az (Section 6c)
      }
    } else {
      next = [...selectedCategories, slug];
      // Section 6b: On filter select — auto-set the sort to that filter's natural default
      if (next.length === 1) {
        naturalSort = getNaturalSortForCategory(slug);
      }
    }

    onSelectCategory(next, naturalSort);
  };

  return (
    <div className="space-y-3 mb-6 bg-[#111114] border border-[#26262E] rounded-md p-4">
      {/* Row 1: Category Filter Chips (Section 4 order & chip labels) */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
          Bonus Category Filter
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {BONUS_CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.includes(cat.slug);
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => handleToggleCategory(cat.slug)}
                onMouseEnter={() => onHoverCategory?.(cat.slug)}
                onFocus={() => onHoverCategory?.(cat.slug)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                  isSelected
                    ? 'bg-[#FFB020] text-zinc-950 border-[#FFB020] shadow-sm font-semibold'
                    : 'bg-[#15151A] text-zinc-300 border-[#26262E] hover:border-[#FFB020]/40'
                }`}
              >
                {cat.chipLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Secondary Filters (Verification & Availability) + Sort Dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#26262E]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Verification Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500">Verification:</span>
            <select
              value={verification}
              onChange={(e) => onSelectVerification(e.target.value)}
              className="bg-[#15151A] border border-[#26262E] text-zinc-200 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-[#FFB020]"
            >
              <option value="all">All listings</option>
              <option value="verified">Verified only</option>
              <option value="unverified">Unverified</option>
              <option value="review_required">Review required</option>
            </select>
          </div>

          {/* Availability Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500">Availability:</span>
            <select
              value={availability}
              onChange={(e) => onSelectAvailability(e.target.value)}
              className="bg-[#15151A] border border-[#26262E] text-zinc-200 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-[#FFB020]"
            >
              <option value="all">All (Online & Testing)</option>
              <option value="offline">Offline domains</option>
            </select>
          </div>
        </div>

        {/* Sort Selector with Contextual Labels */}
        <div className="flex items-center gap-2 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-500 shrink-0">Sort by:</span>
          <select
            value={currentSort}
            onChange={(e) => onSelectSort(e.target.value as SortKey)}
            className="flex-1 sm:flex-none bg-[#15151A] border border-[#26262E] text-zinc-100 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-[#FFB020] font-medium"
          >
            {availableSorts.map((sortOpt) => (
              <option
                key={sortOpt.key}
                value={sortOpt.key}
                disabled={sortOpt.isDisabled}
                className={sortOpt.isDisabled ? 'text-zinc-600' : 'text-zinc-100'}
              >
                {sortOpt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Active-filter summary line with "Clear filters" action (Section 5) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#26262E]/50 text-xs">
        <div className="text-zinc-400">
          Showing <span className="font-mono text-zinc-200 font-semibold">{resultCount}</span> {resultCount === 1 ? 'domain' : 'domains'}
          {hasActiveFilters && (
            <span className="text-zinc-500 ml-1">
              (filtered by:{' '}
              {[
                ...selectedCategories.map((c) => CATEGORY_MAP.get(c)?.chipLabel || c),
                verification !== 'all' ? `verification: ${verification}` : null,
                availability !== 'all' ? `availability: ${availability}` : null,
              ]
                .filter(Boolean)
                .join(', ')}
              )
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 text-[#FFB020] hover:text-[#FFC24D] font-medium transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear filters</span>
          </button>
        )}
      </div>
    </div>
  );
};
