/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BONUS_CATEGORIES,
  CATEGORY_DEFAULT_SORT,
  CATEGORY_MAP,
  SORT_OPTIONS,
} from '../constants/taxonomy.ts';
import {
  BonusCategorySlug,
  Listing,
  SortKey,
  SortOptionDefinition,
} from '../types/index.ts';

export interface FormattedSortOption {
  key: SortKey;
  label: string;
  isDisabled: boolean;
}

/**
 * Generates the contextual labels for sort options based on active category filters (Section 6b).
 * Label template:
 * replace the bare noun with "{Chip label} {noun}";
 * "Lowest cash-out" -> "Lowest {Chip label} cash-out";
 * "Best turnover" -> "Best {Chip label} turnover".
 */
export function getContextualSortLabel(
  def: SortOptionDefinition,
  selectedCategories: BonusCategorySlug[]
): string {
  if (selectedCategories.length === 0 || def.globalOnly) {
    return def.label;
  }

  // Get chip label(s)
  let prefix = '';
  if (selectedCategories.length === 1) {
    prefix = CATEGORY_MAP.get(selectedCategories[0])?.chipLabel || '';
  } else {
    // E.g. "Selected categories"
    prefix = selectedCategories
      .map((c) => CATEGORY_MAP.get(c)?.chipLabel || '')
      .join(' / ');
  }

  if (def.key === 'biggest_bonus') {
    return `Biggest ${prefix} bonus amount`;
  }
  if (def.key === 'highest_max_withdraw') {
    return `Highest ${prefix} max withdrawal`;
  }
  if (def.key === 'lowest_cashout') {
    return `Lowest ${prefix} cash-out`;
  }
  if (def.key === 'lowest_turnover') {
    return `Lowest ${prefix} turnover/wager`;
  }
  if (def.key === 'best_turnover') {
    return `Best ${prefix} turnover`;
  }

  return def.label;
}

/**
 * Extracts the metric value for a listing given the active sort key and category scope (Section 6a).
 */
export function extractListingMetricValue(
  listing: Listing,
  sortKey: SortKey,
  selectedCategories: BonusCategorySlug[]
): number | string | null {
  if (sortKey === 'domain_az' || sortKey === 'domain_za') {
    return listing.normalised_domain;
  }
  if (sortKey === 'most_popular') {
    return listing.metric_popularity ?? 0;
  }

  const isGlobal = selectedCategories.length === 0;

  if (isGlobal) {
    switch (sortKey) {
      case 'biggest_bonus':
        return listing.metric_max_bonus_amount;
      case 'highest_max_withdraw':
        return listing.metric_max_withdraw;
      case 'lowest_cashout':
        return listing.metric_min_unlock;
      case 'lowest_turnover':
        return listing.metric_min_rollover;
      case 'best_turnover':
        return listing.metric_best_value;
      default:
        return null;
    }
  }

  // Scoped calculation
  const values: number[] = [];
  for (const cat of selectedCategories) {
    const metrics = listing.category_metrics?.[cat];
    if (!metrics) continue;

    let val: number | null = null;
    if (sortKey === 'biggest_bonus') val = metrics.max_bonus_amount;
    else if (sortKey === 'highest_max_withdraw') val = metrics.max_withdraw;
    else if (sortKey === 'lowest_cashout') val = metrics.min_unlock;
    else if (sortKey === 'lowest_turnover') val = metrics.min_rollover;
    else if (sortKey === 'best_turnover') val = metrics.best_value;

    if (val !== null && val !== undefined) {
      values.push(val);
    }
  }

  if (values.length === 0) {
    return null;
  }

  // Multi-category rule (Section 6a):
  // MAX for biggest_bonus / highest_max_withdraw / best_value
  // MIN for lowest_cashout / lowest_turnover
  if (
    sortKey === 'biggest_bonus' ||
    sortKey === 'highest_max_withdraw' ||
    sortKey === 'best_turnover'
  ) {
    return Math.max(...values);
  } else {
    return Math.min(...values);
  }
}

/**
 * Resolves formatted sort options with contextual labels and disabled state if all listings have null in scope (Section 6c).
 */
export function resolveSortOptionsList(
  listings: Listing[],
  selectedCategories: BonusCategorySlug[]
): FormattedSortOption[] {
  return SORT_OPTIONS.map((def) => {
    const label = getContextualSortLabel(def, selectedCategories);

    let hasData = true;
    if (def.isMetric && listings.length > 0) {
      hasData = listings.some((l) => {
        const val = extractListingMetricValue(l, def.key, selectedCategories);
        return val !== null && val !== undefined;
      });
    }

    return {
      key: def.key,
      label: hasData ? label : `${label} (no data)`,
      isDisabled: !hasData,
    };
  });
}

/**
 * Sorts listings using contextual metric resolver, nulls-last rule, and normalised_domain tiebreaker.
 */
export function sortListings(
  listings: Listing[],
  sortKey: SortKey,
  selectedCategories: BonusCategorySlug[]
): Listing[] {
  const def = SORT_OPTIONS.find((s) => s.key === sortKey) || SORT_OPTIONS[0];
  const isAsc = def.direction === 'asc';

  return [...listings].sort((a, b) => {
    const valA = extractListingMetricValue(a, sortKey, selectedCategories);
    const valB = extractListingMetricValue(b, sortKey, selectedCategories);

    const aIsNull = valA === null || valA === undefined;
    const bIsNull = valB === null || valB === undefined;

    // Rule: Listings with a null value for the active sort always sort LAST in either direction
    if (aIsNull && bIsNull) {
      return a.normalised_domain.localeCompare(b.normalised_domain);
    }
    if (aIsNull) return 1;
    if (bIsNull) return -1;

    // String comparison (domain_az, domain_za)
    if (typeof valA === 'string' && typeof valB === 'string') {
      const cmp = valA.localeCompare(valB);
      if (cmp !== 0) return isAsc ? cmp : -cmp;
      return a.normalised_domain.localeCompare(b.normalised_domain);
    }

    // Number comparison
    const numA = Number(valA);
    const numB = Number(valB);

    if (numA !== numB) {
      return isAsc ? numA - numB : numB - numA;
    }

    // Secondary tiebreaker is always normalised_domain asc so paging is stable
    return a.normalised_domain.localeCompare(b.normalised_domain);
  });
}

/**
 * Natural sort selection helper when user selects a category (Section 6b)
 */
export function getNaturalSortForCategory(category: BonusCategorySlug): SortKey {
  return CATEGORY_DEFAULT_SORT[category] || 'domain_az';
}
