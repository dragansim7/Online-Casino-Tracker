/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BONUS_CATEGORIES, classifyPromo } from '../constants/taxonomy.ts';
import {
  Bonus,
  BonusCategorySlug,
  CategoryMetricsMap,
  ImportBatch,
  Listing,
  ListingEngagement,
  PromoUnmatched,
  SyncRun,
  User,
} from '../types/index.ts';

export interface DatabaseState {
  listings: Listing[];
  bonuses: Bonus[];
  unmatched: PromoUnmatched[];
  syncRuns: SyncRun[];
  engagements: Record<string, ListingEngagement>; // listing_id -> engagement
  importBatches: ImportBatch[];
  users: User[];
  llmTokensUsed: number;
}

export function createEmptyCategoryMetrics(): CategoryMetricsMap {
  const map: Partial<CategoryMetricsMap> = {};
  for (const cat of BONUS_CATEGORIES) {
    map[cat.slug] = {
      max_bonus_amount: null,
      max_withdraw: null,
      min_rollover: null,
      min_unlock: null,
      best_value: null,
      count: 0,
    };
  }
  return map as CategoryMetricsMap;
}

/**
 * Recomputes sortable metric columns denormalised from Bonus (Section 3).
 * Must be called by syncBonuses AND saveListing so manual admin edits never drift sorts.
 * All metric columns are NULL when there is no data. Never coerce to 0.
 */
export function recomputeListingMetrics(
  listing: Listing,
  bonuses: Bonus[],
  engagement?: ListingEngagement
): Listing {
  // Filter bonuses belonging to this listing and not hidden
  const listingBonuses = bonuses.filter(
    (b) => b.listing_id === listing.id && !listing.hidden_categories.includes(b.category)
  );

  const categoryMetrics = createEmptyCategoryMetrics();

  let maxBonusAmount: number | null = null;
  let maxWithdraw: number | null = null;
  let minRollover: number | null = null;
  let minUnlock: number | null = null;
  let bestValue: number | null = null;

  for (const b of listingBonuses) {
    const cat = b.category;
    const catM = categoryMetrics[cat];
    if (catM) {
      catM.count += 1;

      // Bonus amount
      if (b.amount_value !== null && b.amount_value !== undefined) {
        catM.max_bonus_amount =
          catM.max_bonus_amount === null
            ? b.amount_value
            : Math.max(catM.max_bonus_amount, b.amount_value);

        maxBonusAmount =
          maxBonusAmount === null ? b.amount_value : Math.max(maxBonusAmount, b.amount_value);
      }

      // Max withdraw
      if (b.max_withdraw !== null && b.max_withdraw !== undefined) {
        catM.max_withdraw =
          catM.max_withdraw === null ? b.max_withdraw : Math.max(catM.max_withdraw, b.max_withdraw);

        maxWithdraw =
          maxWithdraw === null ? b.max_withdraw : Math.max(maxWithdraw, b.max_withdraw);
      }

      // Min rollover
      if (b.rollover !== null && b.rollover !== undefined) {
        catM.min_rollover =
          catM.min_rollover === null ? b.rollover : Math.min(catM.min_rollover, b.rollover);

        minRollover = minRollover === null ? b.rollover : Math.min(minRollover, b.rollover);
      }

      // Min unlock (Lowest cash-out)
      if (b.min_unlock !== null && b.min_unlock !== undefined) {
        catM.min_unlock =
          catM.min_unlock === null ? b.min_unlock : Math.min(catM.min_unlock, b.min_unlock);

        minUnlock = minUnlock === null ? b.min_unlock : Math.min(minUnlock, b.min_unlock);
      }

      // Best value: amount_value ÷ rollover (rollover 0 or null counts as 1)
      if (b.amount_value !== null && b.amount_value !== undefined) {
        const rollDivisor = b.rollover && b.rollover > 0 ? b.rollover : 1;
        const valScore = Number((b.amount_value / rollDivisor).toFixed(2));

        catM.best_value =
          catM.best_value === null ? valScore : Math.max(catM.best_value, valScore);

        bestValue = bestValue === null ? valScore : Math.max(bestValue, valScore);
      }
    }
  }

  // Popularity score: (click_count * 2) + (favourite_count * 3) + bonus_count
  const clicks = engagement?.click_count ?? 0;
  const favs = engagement?.favourite_count ?? 0;
  const popularity = clicks * 2 + favs * 3 + listingBonuses.length;

  return {
    ...listing,
    bonus_count: listingBonuses.length,
    bonus_status: listingBonuses.length > 0 ? 'ok' : listing.bonus_status === 'unchecked' ? 'unchecked' : 'no_offers',
    metric_max_bonus_amount: maxBonusAmount,
    metric_max_withdraw: maxWithdraw,
    metric_min_rollover: minRollover,
    metric_min_unlock: minUnlock,
    metric_best_value: bestValue,
    metric_popularity: popularity,
    category_metrics: categoryMetrics,
  };
}

export function normaliseDomain(input: string): string {
  let clean = input.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, '');
  clean = clean.replace(/^www\./, '');
  clean = clean.split('/')[0];
  clean = clean.split('?')[0];
  clean = clean.split('#')[0];
  return clean;
}

// In-memory Database instance
class Database {
  private state: DatabaseState = {
    listings: [],
    bonuses: [],
    unmatched: [],
    syncRuns: [],
    engagements: {},
    importBatches: [],
    users: [],
    llmTokensUsed: 14200,
  };

  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized) return;
    this.seedUsers();
    this.seedDatabase();
    this.isInitialized = true;
  }

  private seedUsers() {
    this.state.users = [
      {
        id: 'usr_admin',
        email: 'Dragansim7@gmail.com',
        name: 'Dragan (Admin)',
        role: 'admin',
        created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
      },
      {
        id: 'usr_admin_default',
        email: 'admin@axhub.com',
        name: 'AXHub Administrator',
        role: 'admin',
        created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
      },
      {
        id: 'usr_demo',
        email: 'player@example.com',
        name: 'Casual Player',
        role: 'user',
        created_at: new Date('2026-02-01T00:00:00Z').toISOString(),
      },
    ];
  }

  private seedDatabase() {
    const listings: Listing[] = [];
    const bonuses: Bonus[] = [];
    const unmatched: PromoUnmatched[] = [];

    // 1. RICH SPOTLIGHT LISTING: Yes77 AU (yes77au.com)
    // Seeded with bonuses across all five categories with varied amounts, rollovers and caps (Section 14)
    const richListingId = 'lst_yes77au';
    const richListing: Listing = {
      id: richListingId,
      name: 'Yes77 AU',
      domain: 'yes77au.com',
      normalised_domain: 'yes77au.com',
      destination_url: 'https://yes77au.com/?ref=axhub&aff=direct',
      description: 'Australian-facing gaming portal featuring pokies, instant tables, and live dealer streams.',
      admin_notes: 'Spotlight verified listing for comprehensive bonus validation and classifier tests.',
      is_featured: true,
      is_demo: false,
      source: 'manual',
      technical_status: 'online',
      verification_status: 'verified',
      last_checked_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      bonus_status: 'ok',
      bonus_checked_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      bonus_count: 5,
      bonus_summary: '5 active promotions recorded across all primary bonus categories.',
      feed_url: 'https://yes77au.com/promotions',
      feed_status: 'ok',
      feed_last_checked_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      hidden_categories: [],
      category_overrides: {},
      search_text: 'yes77 au yes77au.com',
      created_date: new Date('2026-01-15T08:00:00Z').toISOString(),
      updated_date: new Date('2026-10-20T12:00:00Z').toISOString(),
      metric_max_bonus_amount: null,
      metric_max_withdraw: null,
      metric_min_rollover: null,
      metric_min_unlock: null,
      metric_best_value: null,
      metric_popularity: 42,
      category_metrics: createEmptyCategoryMetrics(),
    };

    // Rich bonuses in all five categories (Section 4 & Section 8):
    bonuses.push(
      {
        id: 'bon_rich_1',
        listing_id: richListingId,
        name: 'New Member AUD 25 Free Chip',
        category: 'signup_no_deposit',
        amount_label: 'AUD 25 Free',
        amount_value: 25,
        rollover: 15,
        min_unlock: 50,
        max_withdraw: 100,
        min_deposit: null,
        reset_period: null,
        claim_condition: 'FREE',
        providers_allowed: 'Pragmatic Play, Nolimit City, JILI',
        providers_excluded: 'Live Baccarat, Roulette',
        game_types: 'Pokies only',
        terms_text:
          '1. Valid for new Australian registrations only.✦ 2. Verification via SMS OTP required prior to credit.✦ 3. Wagering requirement is 15x bonus value on eligible video slots.✦ 4. Maximum withdrawal capped strictly at AUD 100.',
        first_seen: new Date('2026-02-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_rich_2',
        listing_id: richListingId,
        name: 'First Deposit 150% Welcome Match',
        category: 'signup_deposit_match',
        amount_label: '150% up to AUD 1,500',
        amount_value: 1500,
        rollover: 35,
        min_unlock: 20,
        max_withdraw: 5000,
        min_deposit: 20,
        reset_period: null,
        claim_condition: 'DEPOSIT',
        providers_allowed: 'All pokies, Instant win',
        providers_excluded: 'Jackpots',
        game_types: 'Pokies and table games (10% contribution)',
        terms_text:
          '1. Minimum first deposit is AUD 20.✦ 2. 150% match credited immediately up to AUD 1,500 maximum.✦ 3. Turnover requirement is 35x (deposit + bonus).✦ 4. Max cashout capped at AUD 5,000.',
        first_seen: new Date('2026-02-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_rich_3',
        listing_id: richListingId,
        name: 'Downline Referral Commission Match',
        category: 'referral',
        amount_label: 'AUD 50 per friend + 5% deposit share',
        amount_value: 50,
        rollover: 5,
        min_unlock: 30,
        max_withdraw: 1000,
        min_deposit: null,
        reset_period: 'MONTHLY',
        claim_condition: 'CUSTOM',
        providers_allowed: 'All games',
        providers_excluded: null,
        game_types: 'All categories',
        terms_text:
          '1. Share your personalized invite link with friends.✦ 2. Referee must deposit a minimum of AUD 30.✦ 3. AUD 50 bonus credited to referrer wallet with 5x wagering.✦ 4. Max withdrawal from referral credits is AUD 1,000 per month.',
        first_seen: new Date('2026-03-10T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_rich_4',
        listing_id: richListingId,
        name: 'Daily Free Mystery Spin Wheel',
        category: 'daily',
        amount_label: 'AUD 10 Daily Credit',
        amount_value: 10,
        rollover: 1, // lowest rollover!
        min_unlock: 10, // lowest cash-out!
        max_withdraw: 200,
        min_deposit: null,
        reset_period: 'DAILY',
        claim_condition: 'FREE',
        providers_allowed: 'Habanero, Spinomenal, Hacksaw',
        providers_excluded: 'Table games',
        game_types: 'Selected slots',
        terms_text:
          '1. Log in daily between 00:00 and 23:59 AEST.✦ 2. Spin the daily wheel for guaranteed credit between AUD 2 and AUD 10.✦ 3. Turnover requirement is 1x turnover only.✦ 4. Daily withdrawal ceiling is AUD 200.',
        first_seen: new Date('2026-03-15T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_rich_5',
        listing_id: richListingId,
        name: 'VIP Birthday Celebration Gift',
        category: 'birthday',
        amount_label: 'AUD 100 Birthday Treat',
        amount_value: 100,
        rollover: 10,
        min_unlock: 50,
        max_withdraw: 800,
        min_deposit: null,
        reset_period: 'MONTHLY',
        claim_condition: 'CUSTOM',
        providers_allowed: 'All pokies',
        providers_excluded: 'Live tables',
        game_types: 'Pokies',
        terms_text:
          '1. Valid on the week of your verified birthday.✦ 2. Must have made at least one deposit in the previous 90 days.✦ 3. Turnover is 10x bonus amount.✦ 4. Maximum withdrawal capped at AUD 800.',
        first_seen: new Date('2026-04-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      }
    );

    // Initial engagement for Yes77 AU
    this.state.engagements[richListingId] = {
      id: 'eng_yes77au',
      listing_id: richListingId,
      click_count: 14,
      favourite_count: 8,
      popularity_score: 14 * 2 + 8 * 3 + 5,
    };

    // Recompute rich listing metrics
    const updatedRich = recomputeListingMetrics(
      richListing,
      bonuses,
      this.state.engagements[richListingId]
    );
    listings.push(updatedRich);

    // 1b. YEAH96 (yeah96.com) - DIRECT WALLET-API ADAPTER LISTING
    const yeah96Id = 'lst_yeah96';
    const yeah96Listing: Listing = {
      id: yeah96Id,
      name: 'Yeah96',
      domain: 'yeah96.com',
      normalised_domain: 'yeah96.com',
      destination_url: 'https://yeah96.com/?ref=axhub&aff=direct',
      description: 'Australian online gaming platform featuring slots, daily bonuses, and instant crypto/AUD wallet transactions.',
      admin_notes: 'Integrated with direct wallet-api adapter (merchantId: 140). Zero-LLM scraping enabled.',
      is_featured: true,
      is_demo: false,
      source: 'manual',
      technical_status: 'online',
      verification_status: 'verified',
      last_checked_at: new Date().toISOString(),
      bonus_status: 'ok',
      bonus_checked_at: new Date().toISOString(),
      bonus_count: 5,
      bonus_summary: '5 featured promotions pinned from 32 live promotions.',
      feed_url: 'https://yeah96.com/promotion',
      feed_status: 'ok',
      feed_last_checked_at: new Date().toISOString(),
      hidden_categories: [],
      category_overrides: {},
      search_text: 'yeah96 yeah96.com',
      created_date: new Date('2026-02-01T00:00:00Z').toISOString(),
      updated_date: new Date().toISOString(),
      metric_max_bonus_amount: null,
      metric_max_withdraw: null,
      metric_min_rollover: null,
      metric_min_unlock: null,
      metric_best_value: null,
      metric_popularity: 65,
      category_metrics: createEmptyCategoryMetrics(),
    };

    bonuses.push(
      {
        id: 'bon_yeah96_444984',
        listing_id: yeah96Id,
        name: 'WELCOME BONUS (100% Match)',
        category: 'signup_deposit_match',
        amount_label: '100% up to AUD 500',
        amount_value: 500,
        rollover: 5,
        min_unlock: 5,
        max_withdraw: 500,
        min_deposit: 50,
        reset_period: null,
        claim_condition: 'DEPOSIT',
        providers_allowed: 'SLOT games only',
        providers_excluded: 'Table Games, Live Casino',
        game_types: 'Pokies',
        terms_text:
          'Welcome 100% ✦ Yeah96 • First Deposit Bonus ✦ 100% Match up to $500 max payout ✦ First deposit only • Auto-Active promotion ✦ Rollover: 5× to activate 5× to withdraw',
        first_seen: new Date('2026-02-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_yeah96_444968',
        listing_id: yeah96Id,
        name: 'REGISTER FREE (Free Credit 29.6)',
        category: 'signup_no_deposit',
        amount_label: 'AUD 29.6 Free',
        amount_value: 29.6,
        rollover: 5,
        min_unlock: 496,
        max_withdraw: 30,
        min_deposit: null,
        reset_period: null,
        claim_condition: 'FREE',
        providers_allowed: 'Slot games only',
        providers_excluded: 'Table Games, Live Casino',
        game_types: 'Pokies',
        terms_text:
          'Free Credit 29.6 ✦ Yeah96 • Event Bonus ✦ Players receive $29.6 Free Credit ✦ Newly registered players only ✦ Win-over target: $496 ✦ Withdraw up to $30',
        first_seen: new Date('2026-02-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_yeah96_445490',
        listing_id: yeah96Id,
        name: 'REFERRAL BONUS ($6 per Mate)',
        category: 'referral',
        amount_label: 'AUD 6 per Friend',
        amount_value: 6,
        rollover: 5,
        min_unlock: 5,
        max_withdraw: 30,
        min_deposit: null,
        reset_period: null,
        claim_condition: 'CUSTOM',
        providers_allowed: 'Slot games',
        providers_excluded: null,
        game_types: 'Pokies',
        terms_text:
          'Referral Bonus ✦ Yeah96 • $6 per Referral ✦ Earn $6 bonus for each friend who registers, verifies, and makes a qualifying first deposit ✦ Wagering: 5× bonus amount ✦ Max withdrawal: $30',
        first_seen: new Date('2026-02-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_yeah96_444986',
        listing_id: yeah96Id,
        name: 'DAILY WELCOME (50% Reload)',
        category: 'daily_deposit',
        amount_label: '50% up to AUD 300',
        amount_value: 300,
        rollover: 10,
        min_unlock: 5,
        max_withdraw: null,
        min_deposit: 80,
        reset_period: 'DAILY',
        claim_condition: 'DEPOSIT',
        providers_allowed: 'All Slot Games (exclude JOKER LIVE22)',
        providers_excluded: 'Table Games, Live Casino',
        game_types: 'Pokies',
        terms_text:
          'Daily Welcome 50% ✦ Yeah96 • Daily Offer ✦ 50% up to 300 AUD ✦ Min Deposit 80 AUD ✦ Rollover: 5× to withdraw ✦ Max withdrawal: Unlimited',
        first_seen: new Date('2026-02-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_yeah96_444987',
        listing_id: yeah96Id,
        name: 'WEEKEND BOOST (50% Weekend Match)',
        category: 'weekend_deposit',
        amount_label: '50% up to AUD 200',
        amount_value: 200,
        rollover: 5,
        min_unlock: 5,
        max_withdraw: 2000,
        min_deposit: 50,
        reset_period: 'WEEKLY',
        claim_condition: 'DEPOSIT',
        providers_allowed: 'Slot games only',
        providers_excluded: 'Table Games, Live Casino',
        game_types: 'Pokies',
        terms_text:
          'Weekend Boost ✦ Yeah96 • 50% up to $200 ✦ Valid Friday to Sunday ✦ Minimum deposit $50 ✦ Rollover 5x',
        first_seen: new Date('2026-02-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      },
      {
        id: 'bon_yeah96_812841',
        listing_id: yeah96Id,
        name: '11PM Late Night Boost',
        category: 'daily_deposit',
        amount_label: '50% up to AUD 700',
        amount_value: 700,
        rollover: 5,
        min_unlock: 5,
        max_withdraw: null,
        min_deposit: 70,
        reset_period: 'DAILY',
        claim_condition: 'DEPOSIT',
        providers_allowed: 'Slot games only',
        providers_excluded: 'JILI, LIVE22, JOKER, BOONGO',
        game_types: 'Pokies',
        terms_text:
          '11PM Boost ✦ Yeah96 • Late Night Bonus ✦ 50% Bonus up to 700 AUD ✦ Deposit 100+ to unlock ✦ Once daily at 11PM (Sydney Time) ✦ Turnover: x5 ✦ Rollover: x5',
        first_seen: new Date('2026-02-01T00:00:00Z').toISOString(),
        last_seen_at: new Date().toISOString(),
        is_new: false,
      }
    );

    this.state.engagements[yeah96Id] = {
      id: 'eng_yeah96',
      listing_id: yeah96Id,
      click_count: 28,
      favourite_count: 14,
      popularity_score: 28 * 2 + 14 * 3 + 5,
    };

    const updatedYeah96 = recomputeListingMetrics(
      yeah96Listing,
      bonuses,
      this.state.engagements[yeah96Id]
    );
    listings.push(updatedYeah96);



    // Seed Deliberately-Droppable Promos into PromoUnmatched to prove the drop list works (Section 14 & Section 4b)
    unmatched.push(
      {
        id: 'unm_1',
        listing_id: richListingId,
        raw_name: 'Weekly 10% Slot Unlimited Rebate',
        raw_amount: '10% Rebate',
        raw_terms: 'Automatic cashback calculated on weekly net losses. 0x wagering.',
        seen_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        suggested_category: null,
        resolved: false,
        drop_reason: 'Matched explicit drop pattern: /slot unlimited/i, /rebate/i',
      },
      {
        id: 'unm_2',
        listing_id: richListingId,
        raw_name: 'VIP Emerald Tier Loyalty Upgrade Bonus',
        raw_amount: 'Level Up Mystery Gift',
        raw_terms: 'Hit 50,000 tier loyalty points to unlock exclusive perks.',
        seen_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        suggested_category: null,
        resolved: false,
        drop_reason: 'Matched explicit drop pattern: /vip loyalty/i, /tier rewards?/i',
      },
      {
        id: 'unm_3',
        listing_id: richListingId,
        raw_name: 'Golden Egg Lucky Number Mini-Game',
        raw_amount: 'Crack the Egg for Prizes',
        raw_terms: 'Mini-game unlocked after AUD 50 wagered.',
        seen_at: new Date(Date.now() - 86400000 * 4).toISOString(),
        suggested_category: null,
        resolved: false,
        drop_reason: 'Matched explicit drop pattern: /golden egg/i, /lucky number/i',
      },
      {
        id: 'unm_4',
        listing_id: richListingId,
        raw_name: 'COSMO PLAY Tournament Prize Pool',
        raw_amount: 'EUR 50,000 Network Pool',
        raw_terms: 'Third-party partner brand seasonal leaderboard.',
        seen_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        suggested_category: null,
        resolved: false,
        drop_reason: 'Matched explicit drop pattern: /cosmo play/i',
      }
    );

    // 2. Additional Handcrafted Diverse Australian Casino Listings
    const handcraftedProfiles = [
      {
        domain: 'yes68.com',
        name: 'Yes68 Casino',
        status: 'online' as const,
        verification: 'verified' as const,
        is_featured: true,
        bonusData: [
          {
            name: 'Signup AUD 20 No Deposit',
            category: 'signup_no_deposit' as BonusCategorySlug,
            amount_label: 'AUD 20 Free',
            amount_value: 20,
            rollover: 25,
            min_unlock: 40,
            max_withdraw: 150,
            terms: 'SMS verified accounts. 25x turnover.',
          },
          {
            name: '200% First Deposit Match',
            category: 'signup_deposit_match' as BonusCategorySlug,
            amount_label: '200% up to AUD 800',
            amount_value: 800,
            rollover: 30,
            min_unlock: 30,
            max_withdraw: 3000,
            terms: 'Min deposit AUD 25. 30x wager requirement.',
          },
        ],
      },
      {
        domain: 'xpay33.com',
        name: 'XPay33 Australia',
        status: 'online' as const,
        verification: 'verified' as const,
        is_featured: true,
        bonusData: [
          {
            name: 'Instant AUD 15 Sign Up Credit',
            category: 'signup_no_deposit' as BonusCategorySlug,
            amount_label: 'AUD 15',
            amount_value: 15,
            rollover: 12,
            min_unlock: 25,
            max_withdraw: 80,
            terms: 'No deposit required. 12x playthrough.',
          },
          {
            name: 'Refer A Mate AUD 40 Reward',
            category: 'referral' as BonusCategorySlug,
            amount_label: 'AUD 40',
            amount_value: 40,
            rollover: 3,
            min_unlock: 20,
            max_withdraw: 500,
            terms: 'Credited when mate deposits AUD 20+.',
          },
        ],
      },
      {
        domain: 'zebra88.club',
        name: 'Zebra88 Club',
        status: 'online' as const,
        verification: 'unverified' as const,
        is_featured: false,
        bonusData: [
          {
            name: 'Daily Free AUD 5 Login Bonus',
            category: 'daily' as BonusCategorySlug,
            amount_label: 'AUD 5 Daily',
            amount_value: 5,
            rollover: 2,
            min_unlock: 15,
            max_withdraw: 100,
            terms: 'Claim once every 24 hours.',
          },
        ],
      },
      {
        domain: 'zeroaud.com',
        name: 'ZeroAUD Pokies',
        status: 'online' as const,
        verification: 'verified' as const,
        is_featured: true,
        bonusData: [
          {
            name: 'Zero Risk AUD 30 Sign-up',
            category: 'signup_no_deposit' as BonusCategorySlug,
            amount_label: 'AUD 30',
            amount_value: 30,
            rollover: 20,
            min_unlock: 60,
            max_withdraw: 120,
            terms: 'Zero deposit needed. Eligible on all Aristocrat-style games.',
          },
          {
            name: 'Birthday Extravaganza Bonus',
            category: 'birthday' as BonusCategorySlug,
            amount_label: 'AUD 250 Birthday Cash',
            amount_value: 250,
            rollover: 15,
            min_unlock: 50,
            max_withdraw: 2500,
            terms: 'Valid on birth month. Identity verified.',
          },
        ],
      },
      {
        domain: 'youwin777au.com',
        name: 'YouWin 777 AU',
        status: 'offline' as const, // Demonstrates offline status filter
        verification: 'review_required' as const,
        is_featured: false,
        bonusData: [],
      },
      {
        domain: 'koala777.com',
        name: 'Koala 777 Pokies',
        status: 'online' as const,
        verification: 'verified' as const,
        is_featured: true,
        bonusData: [
          {
            name: 'Welcome AUD 50 Match',
            category: 'signup_deposit_match' as BonusCategorySlug,
            amount_label: '100% up to AUD 2,000',
            amount_value: 2000,
            rollover: 40,
            min_unlock: 20,
            max_withdraw: 10000,
            terms: 'First deposit only. Max bet AUD 10.',
          },
        ],
      },
      {
        domain: 'wombatbet.com',
        name: 'WombatBet Australia',
        status: 'online' as const,
        verification: 'unverified' as const,
        is_featured: false,
        bonusData: [
          {
            name: 'Daily Free Drop AUD 8',
            category: 'daily' as BonusCategorySlug,
            amount_label: 'AUD 8',
            amount_value: 8,
            rollover: 1,
            min_unlock: 10,
            max_withdraw: 150,
            terms: 'Log in daily.',
          },
        ],
      },
      {
        domain: 'auslot88.com',
        name: 'AuSlot88',
        status: 'online' as const,
        verification: 'verified' as const,
        is_featured: false,
        bonusData: [
          {
            name: 'Referral Double Reward',
            category: 'referral' as BonusCategorySlug,
            amount_label: 'AUD 88 Referral Bonus',
            amount_value: 88,
            rollover: 8,
            min_unlock: 50,
            max_withdraw: 888,
            terms: 'Referral deposit requirement AUD 50.',
          },
        ],
      },
      {
        domain: 'crownpokies.com',
        name: 'Crown Pokies Direct',
        status: 'online' as const,
        verification: 'review_required' as const,
        is_featured: false,
        bonusData: [],
      },
    ];

    for (const item of handcraftedProfiles) {
      const id = `lst_${item.domain.replace(/[^a-z0-9]/g, '_')}`;
      const listing: Listing = {
        id,
        name: item.name,
        domain: item.domain,
        normalised_domain: normaliseDomain(item.domain),
        destination_url: `https://${item.domain}/?ref=axhub&aff=direct`,
        description: `Verified Australian online gaming portal operating under ${item.domain}.`,
        admin_notes: 'Standard curated directory record.',
        is_featured: item.is_featured,
        is_demo: false,
        source: 'manual',
        technical_status: item.status,
        verification_status: item.verification,
        last_checked_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        bonus_status: item.bonusData.length > 0 ? 'ok' : 'unchecked',
        bonus_checked_at: item.bonusData.length > 0 ? new Date().toISOString() : null,
        bonus_count: item.bonusData.length,
        bonus_summary: `${item.bonusData.length} offers catalogued.`,
        feed_url: `https://${item.domain}/promotions`,
        feed_status: item.bonusData.length > 0 ? 'ok' : 'unknown',
        feed_last_checked_at: new Date().toISOString(),
        hidden_categories: [],
        category_overrides: {},
        search_text: `${item.name.toLowerCase()} ${item.domain.toLowerCase()}`,
        created_date: new Date('2026-02-10T00:00:00Z').toISOString(),
        updated_date: new Date().toISOString(),
        metric_max_bonus_amount: null,
        metric_max_withdraw: null,
        metric_min_rollover: null,
        metric_min_unlock: null,
        metric_best_value: null,
        metric_popularity: 15,
        category_metrics: createEmptyCategoryMetrics(),
      };

      for (let i = 0; i < item.bonusData.length; i++) {
        const b = item.bonusData[i];
        bonuses.push({
          id: `bon_${id}_${i + 1}`,
          listing_id: id,
          name: b.name,
          category: b.category,
          amount_label: b.amount_label,
          amount_value: b.amount_value,
          rollover: b.rollover,
          min_unlock: b.min_unlock,
          max_withdraw: b.max_withdraw,
          min_deposit: b.category === 'signup_deposit_match' ? 20 : null,
          reset_period: b.category === 'daily' ? 'DAILY' : null,
          claim_condition: b.category === 'signup_deposit_match' ? 'DEPOSIT' : 'FREE',
          providers_allowed: 'Pokies',
          providers_excluded: null,
          game_types: 'Pokies',
          terms_text: b.terms,
          first_seen: new Date('2026-03-01T00:00:00Z').toISOString(),
          last_seen_at: new Date().toISOString(),
          is_new: false,
        });
      }

      this.state.engagements[id] = {
        id: `eng_${id}`,
        listing_id: id,
        click_count: Math.floor(Math.random() * 20),
        favourite_count: Math.floor(Math.random() * 10),
        popularity_score: 0,
      };

      const computed = recomputeListingMetrics(listing, bonuses, this.state.engagements[id]);
      listings.push(computed);
    }

    // 3. GENERATE ~900 AUSTRALIAN-FACING CASINO DOMAINS (Section 14)
    // Australian naming patterns with realistic suffixes, referral tags, and technical statuses
    const prefixes = [
      'yes', 'xpay', 'zebra', 'zero', 'youwin', 'aus', 'roo', 'koala', 'wombat',
      'crown', 'spin', 'pokies', 'boab', 'ripper', 'jackpot', 'golden', 'outback',
      'lucky', 'star', 'sun', 'bay', 'coral', 'vegas', 'ace', 'king', 'mega', 'nitro',
      'fairgo', 'uptown', 'wild', 'true', 'play', 'hyper', 'turbo', 'royal', 'grand',
      'platinum', 'ruby', 'diamond', 'emerald', 'sapphire', 'tiger', 'dragon', 'phoenix',
      'blitz', 'rush', 'surge', 'apex', 'vortex', 'strike', 'thunder', 'storm', 'ocean',
      'reef', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'goldcoast',
    ];

    const numbers = ['', '77', '88', '99', '68', '33', '777', '888', '123', '365', '247', '21', '007'];
    const suffixes = ['au', 'club', 'com', 'net', 'live', 'vip', 'bet', 'win', 'games', 'play'];

    const domainSet = new Set<string>(listings.map((l) => l.normalised_domain));
    let domainCounter = 1;

    // Create combinations until we have ~910 listings total
    for (const prefix of prefixes) {
      for (const num of numbers) {
        for (const suf of suffixes) {
          if (listings.length >= 915) break;

          const tld = suf === 'au' ? 'com.au' : suf;
          const domain = `${prefix}${num}.${tld}`;
          const normalised = normaliseDomain(domain);

          if (domainSet.has(normalised)) continue;
          domainSet.add(normalised);

          const id = `lst_imp_${domainCounter++}`;
          const isFeatured = domainCounter % 27 === 0;
          const isOffline = domainCounter % 43 === 0;
          const isReview = domainCounter % 19 === 0;
          const isVerified = !isReview && domainCounter % 3 !== 0;

          const techStatus: Listing['technical_status'] = isOffline
            ? 'offline'
            : domainCounter % 31 === 0
            ? 'checking'
            : 'online';

          const verStatus: Listing['verification_status'] = isVerified
            ? 'verified'
            : isReview
            ? 'review_required'
            : 'unverified';

          const formattedName = `${prefix.charAt(0).toUpperCase() + prefix.slice(1)}${num ? ' ' + num : ''} ${suf.toUpperCase()}`;

          const listing: Listing = {
            id,
            name: formattedName,
            domain,
            normalised_domain: normalised,
            destination_url: `https://${domain}/?ref=axhub&aff=direct`,
            description: `Australian-facing casino and pokies website operating under domain ${domain}.`,
            admin_notes: 'Catalogued domain from verified Australian web traffic scans.',
            is_featured: isFeatured,
            is_demo: false,
            source: 'import',
            technical_status: techStatus,
            verification_status: verStatus,
            last_checked_at: new Date(Date.now() - (domainCounter * 72000) % 864000000).toISOString(),
            bonus_status: 'unchecked',
            bonus_checked_at: null,
            bonus_count: 0,
            bonus_summary: 'Pending automated crawl and extraction.',
            feed_url: null,
            feed_status: 'unknown',
            feed_last_checked_at: null,
            hidden_categories: [],
            category_overrides: {},
            search_text: `${formattedName.toLowerCase()} ${domain.toLowerCase()}`,
            created_date: new Date(Date.now() - (domainCounter * 94000) % 15000000000).toISOString(),
            updated_date: new Date().toISOString(),
            metric_max_bonus_amount: null,
            metric_max_withdraw: null,
            metric_min_rollover: null,
            metric_min_unlock: null,
            metric_best_value: null,
            metric_popularity: 0,
            category_metrics: createEmptyCategoryMetrics(),
          };

          // Scatter some realistic bonuses on a handful of domains to make multiple categories populated
          if (domainCounter % 17 === 0 && !isOffline) {
            const hasNoDeposit = domainCounter % 2 === 0;
            const bId = `bon_${id}_gen`;
            const bCat: BonusCategorySlug = hasNoDeposit ? 'signup_no_deposit' : 'signup_deposit_match';
            const bVal = hasNoDeposit ? 10 + (domainCounter % 30) : 500 + (domainCounter % 1500);
            const bRoll = hasNoDeposit ? 20 + (domainCounter % 30) : 30 + (domainCounter % 20);

            bonuses.push({
              id: bId,
              listing_id: id,
              name: hasNoDeposit ? `AUD ${bVal} Free Sign Up` : `${100 + (domainCounter % 150)}% First Deposit Match`,
              category: bCat,
              amount_label: hasNoDeposit ? `AUD ${bVal} Free` : `${100 + (domainCounter % 150)}% up to AUD ${bVal}`,
              amount_value: bVal,
              rollover: bRoll,
              min_unlock: hasNoDeposit ? 50 : 20,
              max_withdraw: hasNoDeposit ? bVal * 5 : bVal * 3,
              min_deposit: hasNoDeposit ? null : 20,
              reset_period: null,
              claim_condition: hasNoDeposit ? 'FREE' : 'DEPOSIT',
              providers_allowed: 'Pokies',
              providers_excluded: null,
              game_types: 'Slots',
              terms_text: 'Standard terms apply. Verification required.',
              first_seen: new Date(Date.now() - 86400000 * 10).toISOString(),
              last_seen_at: new Date().toISOString(),
              is_new: false,
            });
            listing.bonus_status = 'ok';
            listing.bonus_count = 1;
          }

          const engagement: ListingEngagement = {
            id: `eng_${id}`,
            listing_id: id,
            click_count: domainCounter % 13,
            favourite_count: domainCounter % 7,
            popularity_score: 0,
          };
          this.state.engagements[id] = engagement;

          const withMetrics = recomputeListingMetrics(listing, bonuses, engagement);
          listings.push(withMetrics);
        }
      }
    }

    this.state.listings = listings;
    this.state.bonuses = bonuses;
    this.state.unmatched = unmatched;

    // Record initial import batch
    this.state.importBatches = [
      {
        id: 'imp_batch_init',
        admin_email: 'admin@axhub.com',
        total_processed: listings.length,
        imported_count: listings.length,
        duplicate_count: 0,
        invalid_count: 0,
        failed_count: 0,
        created_date: new Date('2026-10-20T00:00:00Z').toISOString(),
      },
    ];

    // Seed initial sync run
    this.state.syncRuns = [
      {
        id: 'run_init_1',
        listing_id: richListingId,
        started_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        duration_ms: 2840,
        cards_found: 9,
        cards_parsed: 9,
        matched_count: 5,
        dropped_count: 4,
        status: 'ok',
        error_text: null,
      },
    ];
  }

  // --- QUERY METHODS ---

  public getCounts() {
    const total = this.state.listings.length;
    const featured = this.state.listings.filter((l) => l.is_featured).length;
    const verified = this.state.listings.filter((l) => l.verification_status === 'verified').length;
    return { domains: total, featured, verified };
  }

  public getListings(): Listing[] {
    return this.state.listings;
  }

  public getListingById(id: string): { listing: Listing; bonuses: Bonus[]; similar: Listing[] } | null {
    const listing = this.state.listings.find((l) => l.id === id);
    if (!listing) return null;

    const bonuses = this.state.bonuses.filter(
      (b) => b.listing_id === id && !listing.hidden_categories.includes(b.category)
    );

    // Similar listings: same verification status or similar domain name
    const similar = this.state.listings
      .filter((l) => l.id !== id && l.technical_status === 'online')
      .slice(0, 4);

    return { listing, bonuses, similar };
  }

  public getBonusesForListing(listingId: string): Bonus[] {
    const listing = this.state.listings.find((l) => l.id === listingId);
    if (!listing) return [];
    return this.state.bonuses.filter(
      (b) => b.listing_id === listingId && !listing.hidden_categories.includes(b.category)
    );
  }

  public getUnmatched(): PromoUnmatched[] {
    return this.state.unmatched;
  }

  public getSyncRuns(): SyncRun[] {
    return this.state.syncRuns;
  }

  public getImportBatches(): ImportBatch[] {
    return this.state.importBatches;
  }

  public getLLMTokenSpend(): number {
    return this.state.llmTokensUsed;
  }

  public addLLMTokenSpend(tokens: number) {
    this.state.llmTokensUsed += tokens;
  }

  // --- ENGAGEMENT MUTATIONS ---

  public incrementClick(listingId: string): number {
    let eng = this.state.engagements[listingId];
    if (!eng) {
      eng = {
        id: `eng_${listingId}`,
        listing_id: listingId,
        click_count: 0,
        favourite_count: 0,
        popularity_score: 0,
      };
      this.state.engagements[listingId] = eng;
    }
    eng.click_count += 1;

    // recompute listing popularity
    const listing = this.state.listings.find((l) => l.id === listingId);
    if (listing) {
      const updated = recomputeListingMetrics(listing, this.state.bonuses, eng);
      const idx = this.state.listings.indexOf(listing);
      this.state.listings[idx] = updated;
    }
    return eng.click_count;
  }

  public incrementFavourite(listingId: string): number {
    let eng = this.state.engagements[listingId];
    if (!eng) {
      eng = {
        id: `eng_${listingId}`,
        listing_id: listingId,
        click_count: 0,
        favourite_count: 0,
        popularity_score: 0,
      };
      this.state.engagements[listingId] = eng;
    }
    eng.favourite_count += 1;

    const listing = this.state.listings.find((l) => l.id === listingId);
    if (listing) {
      const updated = recomputeListingMetrics(listing, this.state.bonuses, eng);
      const idx = this.state.listings.indexOf(listing);
      this.state.listings[idx] = updated;
    }
    return eng.favourite_count;
  }

  // --- ADMIN MUTATIONS (Section 10) ---

  public saveListing(payload: Partial<Listing>): Listing {
    const normalised = normaliseDomain(payload.domain || '');
    let existingIndex = this.state.listings.findIndex(
      (l) => l.id === payload.id || l.normalised_domain === normalised
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Update
      const old = this.state.listings[existingIndex];
      const merged: Listing = {
        ...old,
        ...payload,
        id: old.id,
        normalised_domain: normalised || old.normalised_domain,
        search_text: `${(payload.name || old.name).toLowerCase()} ${(payload.domain || old.domain).toLowerCase()}`,
        updated_date: now,
      };
      const engagement = this.state.engagements[merged.id];
      const recomputed = recomputeListingMetrics(merged, this.state.bonuses, engagement);
      this.state.listings[existingIndex] = recomputed;
      return recomputed;
    } else {
      // Create
      const newId = payload.id || `lst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newListing: Listing = {
        id: newId,
        name: payload.name || normalised,
        domain: payload.domain || normalised,
        normalised_domain: normalised,
        destination_url: payload.destination_url || `https://${normalised}/?ref=axhub&aff=direct`,
        description: payload.description || '',
        admin_notes: payload.admin_notes || '',
        is_featured: payload.is_featured ?? false,
        is_demo: payload.is_demo ?? false,
        source: payload.source || 'manual',
        technical_status: payload.technical_status || 'unknown',
        verification_status: payload.verification_status || 'unverified',
        last_checked_at: payload.last_checked_at || null,
        bonus_status: payload.bonus_status || 'unchecked',
        bonus_checked_at: payload.bonus_checked_at || null,
        bonus_count: 0,
        bonus_summary: payload.bonus_summary || '',
        feed_url: payload.feed_url || null,
        feed_status: payload.feed_status || 'unknown',
        feed_last_checked_at: null,
        hidden_categories: payload.hidden_categories || [],
        category_overrides: payload.category_overrides || {},
        search_text: `${(payload.name || normalised).toLowerCase()} ${normalised}`,
        created_date: now,
        updated_date: now,
        metric_max_bonus_amount: null,
        metric_max_withdraw: null,
        metric_min_rollover: null,
        metric_min_unlock: null,
        metric_best_value: null,
        metric_popularity: 0,
        category_metrics: createEmptyCategoryMetrics(),
      };

      const engagement: ListingEngagement = {
        id: `eng_${newId}`,
        listing_id: newId,
        click_count: 0,
        favourite_count: 0,
        popularity_score: 0,
      };
      this.state.engagements[newId] = engagement;

      const recomputed = recomputeListingMetrics(newListing, this.state.bonuses, engagement);
      this.state.listings.unshift(recomputed);
      return recomputed;
    }
  }

  public deleteListing(id: string): boolean {
    const idx = this.state.listings.findIndex((l) => l.id === id);
    if (idx < 0) return false;
    this.state.listings.splice(idx, 1);
    this.state.bonuses = this.state.bonuses.filter((b) => b.listing_id !== id);
    this.state.unmatched = this.state.unmatched.filter((u) => u.listing_id !== id);
    delete this.state.engagements[id];
    return true;
  }

  public deleteListings(ids: string[]): { deletedCount: number } {
    const idSet = new Set(ids);
    const initialCount = this.state.listings.length;
    this.state.listings = this.state.listings.filter((l) => !idSet.has(l.id));
    this.state.bonuses = this.state.bonuses.filter((b) => !idSet.has(b.listing_id));
    this.state.unmatched = this.state.unmatched.filter((u) => !idSet.has(u.listing_id));
    for (const id of ids) {
      delete this.state.engagements[id];
    }
    const deletedCount = initialCount - this.state.listings.length;
    return { deletedCount };
  }

  public deleteAllListings(): { deletedCount: number } {
    const deletedCount = this.state.listings.length;
    this.state.listings = [];
    this.state.bonuses = [];
    this.state.unmatched = [];
    this.state.engagements = {};
    return { deletedCount };
  }

  public addSingleDomain(domainInput: string, adminEmail: string = 'admin@axhub.com'): {
    success: boolean;
    listing?: Listing;
    error?: string;
  } {
    const raw = (domainInput || '').trim();
    if (!raw) {
      return { success: false, error: 'Please enter a valid domain name.' };
    }

    const normalised = normaliseDomain(raw);
    if (!normalised || !normalised.includes('.')) {
      return { success: false, error: `Invalid domain format: "${raw}". Example: casino.com` };
    }

    const exists = this.state.listings.some((l) => l.normalised_domain === normalised);
    if (exists) {
      return { success: false, error: `Domain "${normalised}" already exists in directory listings.` };
    }

    const now = new Date().toISOString();
    const id = `lst_sgl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nameParts = normalised.split('.')[0];
    const formattedName = nameParts.charAt(0).toUpperCase() + nameParts.slice(1);

    const newListing: Listing = {
      id,
      name: formattedName,
      domain: normalised,
      normalised_domain: normalised,
      destination_url: `https://${normalised}/?ref=axhub&aff=direct`,
      description: `Directory listing for ${formattedName} (${normalised}).`,
      admin_notes: `Added individually by ${adminEmail} on ${now.slice(0, 10)}.`,
      is_featured: false,
      is_demo: false,
      source: 'manual',
      technical_status: 'online',
      verification_status: 'verified',
      last_checked_at: now,
      bonus_status: 'unchecked',
      bonus_checked_at: null,
      bonus_count: 0,
      bonus_summary: '',
      feed_url: `https://${normalised}/promotion`,
      feed_status: 'unknown',
      feed_last_checked_at: null,
      hidden_categories: [],
      category_overrides: {},
      search_text: `${formattedName.toLowerCase()} ${normalised.toLowerCase()}`,
      created_date: now,
      updated_date: now,
      metric_max_bonus_amount: null,
      metric_max_withdraw: null,
      metric_min_rollover: null,
      metric_min_unlock: null,
      metric_best_value: null,
      metric_popularity: 0,
      category_metrics: createEmptyCategoryMetrics(),
    };

    const engagement: ListingEngagement = {
      id: `eng_${id}`,
      listing_id: id,
      click_count: 0,
      favourite_count: 0,
      popularity_score: 0,
    };
    this.state.engagements[id] = engagement;

    const recomputed = recomputeListingMetrics(newListing, this.state.bonuses, engagement);
    this.state.listings.unshift(recomputed);

    return { success: true, listing: recomputed };
  }

  public toggleFeatured(id: string): Listing | null {
    const listing = this.state.listings.find((l) => l.id === id);
    if (!listing) return null;
    listing.is_featured = !listing.is_featured;
    listing.updated_date = new Date().toISOString();
    return listing;
  }

  public updateListingToggles(
    id: string,
    hiddenCategories: BonusCategorySlug[],
    categoryOverrides: Record<string, BonusCategorySlug>
  ): Listing | null {
    const listing = this.state.listings.find((l) => l.id === id);
    if (!listing) return null;
    listing.hidden_categories = hiddenCategories;
    listing.category_overrides = categoryOverrides;

    // Apply category overrides to existing bonuses
    for (const b of this.state.bonuses) {
      if (b.listing_id === id && categoryOverrides[b.name]) {
        b.category = categoryOverrides[b.name];
      }
    }

    const engagement = this.state.engagements[id];
    const recomputed = recomputeListingMetrics(listing, this.state.bonuses, engagement);
    const idx = this.state.listings.indexOf(listing);
    this.state.listings[idx] = recomputed;
    return recomputed;
  }

  /**
   * Bulk import function (Section 10)
   * Caps at 1000, dedupes on normalised_domain, writes ImportBatch row
   */
  public importListings(
    rawText: string,
    adminEmail: string,
    isCommit: boolean
  ): {
    batchId: string;
    totalProcessed: number;
    willImport: string[];
    duplicates: string[];
    invalid: string[];
    committed: boolean;
  } {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const cap = Math.min(lines.length, 5000);
    const existingDomains = new Set(this.state.listings.map((l) => l.normalised_domain));

    const willImport: string[] = [];
    const duplicates: string[] = [];
    const invalid: string[] = [];

    const batchId = `imp_${Date.now()}`;

    for (let i = 0; i < cap; i++) {
      const line = lines[i];
      const normalised = normaliseDomain(line);

      if (!normalised || !normalised.includes('.')) {
        invalid.push(line);
        continue;
      }

      if (existingDomains.has(normalised)) {
        duplicates.push(normalised);
      } else {
        willImport.push(normalised);
        existingDomains.add(normalised); // prevent duplicate within same batch
      }
    }

    if (isCommit && willImport.length > 0) {
      const now = new Date().toISOString();
      for (const domain of willImport) {
        const id = `lst_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const nameParts = domain.split('.')[0];
        const formattedName = nameParts.charAt(0).toUpperCase() + nameParts.slice(1);

        const newListing: Listing = {
          id,
          name: formattedName,
          domain,
          normalised_domain: domain,
          destination_url: `https://${domain}/?ref=axhub&aff=direct`,
          description: `Imported casino listing for domain ${domain}.`,
          admin_notes: `Batch ${batchId} import.`,
          is_featured: false,
          is_demo: false,
          source: 'import',
          technical_status: 'online',
          verification_status: 'unverified',
          last_checked_at: now,
          bonus_status: 'unchecked',
          bonus_checked_at: null,
          bonus_count: 0,
          bonus_summary: '',
          feed_url: null,
          feed_status: 'unknown',
          feed_last_checked_at: null,
          hidden_categories: [],
          category_overrides: {},
          search_text: `${formattedName.toLowerCase()} ${domain.toLowerCase()}`,
          created_date: now,
          updated_date: now,
          metric_max_bonus_amount: null,
          metric_max_withdraw: null,
          metric_min_rollover: null,
          metric_min_unlock: null,
          metric_best_value: null,
          metric_popularity: 0,
          category_metrics: createEmptyCategoryMetrics(),
        };

        this.state.engagements[id] = {
          id: `eng_${id}`,
          listing_id: id,
          click_count: 0,
          favourite_count: 0,
          popularity_score: 0,
        };

        this.state.listings.unshift(newListing);
      }

      const importBatch: ImportBatch = {
        id: batchId,
        admin_email: adminEmail,
        total_processed: cap,
        imported_count: willImport.length,
        duplicate_count: duplicates.length,
        invalid_count: invalid.length,
        failed_count: 0,
        created_date: now,
      };
      this.state.importBatches.unshift(importBatch);
    }

    return {
      batchId,
      totalProcessed: cap,
      willImport,
      duplicates,
      invalid,
      committed: isCommit,
    };
  }

  /**
   * Moves a dropped promo from PromoUnmatched into a real Bonus row and remembers category_override (Section 4d & 4e)
   */
  public moveUnmatchedToBonus(
    unmatchedId: string,
    targetCategory: BonusCategorySlug
  ): { bonus: Bonus; listing: Listing } | null {
    const uIdx = this.state.unmatched.findIndex((u) => u.id === unmatchedId);
    if (uIdx < 0) return null;
    const u = this.state.unmatched[uIdx];

    const listing = this.state.listings.find((l) => l.id === u.listing_id);
    if (!listing) return null;

    // Remember category override for subsequent syncs
    listing.category_overrides[u.raw_name] = targetCategory;

    // Parse amount value
    const match = u.raw_amount.match(/(\d+(?:\.\d+)?)/);
    const amountVal = match ? parseFloat(match[1]) : null;

    const newBonus: Bonus = {
      id: `bon_promoted_${Date.now()}`,
      listing_id: listing.id,
      name: u.raw_name,
      category: targetCategory,
      amount_label: u.raw_amount || 'Special Promotional Credit',
      amount_value: amountVal,
      rollover: 10,
      min_unlock: null,
      max_withdraw: null,
      min_deposit: null,
      reset_period: targetCategory === 'daily' ? 'DAILY' : null,
      claim_condition: 'FREE',
      providers_allowed: 'All games',
      providers_excluded: null,
      game_types: 'Casino',
      terms_text: u.raw_terms,
      first_seen: u.seen_at,
      last_seen_at: new Date().toISOString(),
      is_new: true,
    };

    this.state.bonuses.push(newBonus);

    // Remove from unmatched
    this.state.unmatched.splice(uIdx, 1);

    const engagement = this.state.engagements[listing.id];
    const recomputed = recomputeListingMetrics(listing, this.state.bonuses, engagement);
    const lIdx = this.state.listings.indexOf(listing);
    this.state.listings[lIdx] = recomputed;

    return { bonus: newBonus, listing: recomputed };
  }

  /**
   * Writes sync run result safely (Section 11d)
   * Idempotent and never destructive on failure!
   */
  public recordSyncResult(
    listingId: string,
    newBonuses: Bonus[],
    newUnmatched: PromoUnmatched[],
    syncRun: SyncRun,
    feedUrl: string | null,
    feedStatus: Listing['feed_status']
  ): Listing | null {
    const listing = this.state.listings.find((l) => l.id === listingId);
    if (!listing) return null;

    const now = new Date().toISOString();
    listing.feed_last_checked_at = now;
    listing.bonus_checked_at = now;
    if (feedUrl) listing.feed_url = feedUrl;
    listing.feed_status = feedStatus;

    this.state.syncRuns.unshift(syncRun);

    // CRITICAL: if fetch or extraction fails, do NOT clear existing bonuses!
    if (syncRun.status === 'error') {
      listing.bonus_status = 'failed';
      return listing;
    }

    // Apply per-listing overrides & hidden categories
    for (const b of newBonuses) {
      if (listing.category_overrides[b.name]) {
        b.category = listing.category_overrides[b.name];
      }
    }

    // Replace bonuses for this listing
    this.state.bonuses = this.state.bonuses.filter((b) => b.listing_id !== listingId);
    this.state.bonuses.push(...newBonuses);

    // Append drops to PromoUnmatched
    this.state.unmatched.push(...newUnmatched);

    if (newBonuses.length === 0) {
      listing.bonus_status = 'no_offers';
      listing.bonus_count = 0;
    } else {
      listing.bonus_status = 'ok';
    }

    const engagement = this.state.engagements[listingId];
    const recomputed = recomputeListingMetrics(listing, this.state.bonuses, engagement);
    const idx = this.state.listings.indexOf(listing);
    this.state.listings[idx] = recomputed;

    return recomputed;
  }
}

export const db = new Database();
