/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BonusCategorySlug =
  | 'signup_no_deposit'
  | 'signup_deposit_match'
  | 'referral'
  | 'daily'
  | 'birthday';

export interface CategoryInfo {
  slug: BonusCategorySlug;
  heading: string;
  chipLabel: string;
  subline: string;
}

export type TechnicalStatus = 'online' | 'offline' | 'checking' | 'unknown';
export type VerificationStatus = 'verified' | 'unverified' | 'review_required';
export type BonusStatus = 'unchecked' | 'ok' | 'no_offers' | 'unavailable' | 'failed';
export type FeedStatus = 'unknown' | 'ok' | 'no_feed' | 'error';
export type ListingSource = 'manual' | 'import';

export interface CategoryMetricData {
  max_bonus_amount: number | null;
  max_withdraw: number | null;
  min_rollover: number | null;
  min_unlock: number | null;
  best_value: number | null;
  count: number;
}

export type CategoryMetricsMap = Record<BonusCategorySlug, CategoryMetricData>;

export interface Listing {
  id: string;
  name: string;
  domain: string;
  normalised_domain: string;
  destination_url: string;
  description: string;
  admin_notes: string;
  is_featured: boolean;
  is_demo: boolean;
  source: ListingSource;
  technical_status: TechnicalStatus;
  verification_status: VerificationStatus;
  last_checked_at: string | null;
  bonus_status: BonusStatus;
  bonus_checked_at: string | null;
  bonus_count: number;
  bonus_summary: string;
  feed_url: string | null;
  feed_status: FeedStatus;
  feed_last_checked_at: string | null;
  hidden_categories: BonusCategorySlug[];
  category_overrides: Record<string, BonusCategorySlug>; // raw promo name -> slug
  search_text: string;
  created_date: string;
  updated_date: string;

  // Denormalised metric columns (recomputed by syncBonuses AND saveListing)
  metric_max_bonus_amount: number | null;
  metric_max_withdraw: number | null;
  metric_min_rollover: number | null;
  metric_min_unlock: number | null;
  metric_best_value: number | null;
  metric_popularity: number;
  category_metrics: CategoryMetricsMap;
}

export type ResetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type ClaimCondition = 'FREE' | 'DEPOSIT' | 'CUSTOM';

export interface Bonus {
  id: string;
  listing_id: string;
  name: string;
  category: BonusCategorySlug;
  amount_label: string;
  amount_value: number | null;
  rollover: number | null;
  min_unlock: number | null;
  max_withdraw: number | null;
  min_deposit: number | null;
  reset_period: ResetPeriod | null;
  claim_condition: ClaimCondition | null;
  providers_allowed: string | null;
  providers_excluded: string | null;
  game_types: string | null;
  terms_text: string | null;
  first_seen: string;
  last_seen_at: string;
  is_new: boolean;
}

export interface PromoUnmatched {
  id: string;
  listing_id: string;
  raw_name: string;
  raw_amount: string;
  raw_terms: string;
  seen_at: string;
  suggested_category: BonusCategorySlug | null;
  resolved: boolean;
  drop_reason?: string;
}

export interface SyncRun {
  id: string;
  listing_id: string;
  started_at: string;
  duration_ms: number;
  cards_found: number;
  cards_parsed: number;
  matched_count: number;
  dropped_count: number;
  status: 'ok' | 'no_feed' | 'error';
  error_text: string | null;
}

export interface ListingEngagement {
  id: string;
  listing_id: string;
  click_count: number;
  favourite_count: number;
  popularity_score: number;
}

export interface ImportBatch {
  id: string;
  admin_email: string;
  total_processed: number;
  imported_count: number;
  duplicate_count: number;
  invalid_count: number;
  failed_count: number;
  created_date: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
}

export type SortKey =
  | 'domain_az'
  | 'domain_za'
  | 'biggest_bonus'
  | 'highest_max_withdraw'
  | 'lowest_cashout'
  | 'lowest_turnover'
  | 'best_turnover'
  | 'most_popular';

export interface SortOptionDefinition {
  key: SortKey;
  label: string;
  baseNoun: string;
  metricField?: keyof Listing;
  scopedMetricField?: keyof CategoryMetricData;
  direction: 'asc' | 'desc';
  isMetric: boolean;
  globalOnly?: boolean;
}

export interface FilterState {
  categories: BonusCategorySlug[];
  verification: 'all' | 'verified' | 'unverified' | 'review_required';
  availability: 'all' | 'offline';
  q?: string;
}
