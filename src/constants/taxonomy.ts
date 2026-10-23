/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BonusCategorySlug, CategoryInfo, SortKey, SortOptionDefinition } from '../types/index.ts';

/**
 * Closed set of five categories in fixed render order.
 * Anything that does not cleanly match one of these is dropped from public record.
 */
export const BONUS_CATEGORIES: CategoryInfo[] = [
  {
    slug: 'signup_no_deposit',
    heading: 'Signup no deposit bonus',
    chipLabel: 'Signup no deposit',
    subline: 'Free credit or spins for registering, with no deposit needed.',
  },
  {
    slug: 'signup_deposit_match',
    heading: 'Signup deposit match bonus',
    chipLabel: 'Signup deposit match',
    subline: 'A percentage or cash match on a first deposit.',
  },
  {
    slug: 'referral',
    heading: 'Referral share/invite/deposit bonus',
    chipLabel: 'Referral',
    subline: "Paid for inviting, sharing, or a downline's deposit.",
  },
  {
    slug: 'daily',
    heading: 'Daily free bonus',
    chipLabel: 'Daily free',
    subline: 'Free credit or a repeatable offer claimed each day.',
  },
  {
    slug: 'birthday',
    heading: 'Birthday bonus',
    chipLabel: 'Birthday',
    subline: "A gift credited around a player's birthday.",
  },
];

export const CATEGORY_MAP = new Map<BonusCategorySlug, CategoryInfo>(
  BONUS_CATEGORIES.map((c) => [c.slug, c])
);

/**
 * Natural sort defaults when a single category is selected (Section 6b)
 */
export const CATEGORY_DEFAULT_SORT: Record<BonusCategorySlug, SortKey> = {
  signup_no_deposit: 'biggest_bonus',
  signup_deposit_match: 'biggest_bonus',
  referral: 'highest_max_withdraw',
  birthday: 'highest_max_withdraw',
  daily: 'lowest_turnover',
};

/**
 * Section 6 Sort Options definitions
 */
export const SORT_OPTIONS: SortOptionDefinition[] = [
  {
    key: 'domain_az',
    label: 'Domain name — A → Z',
    baseNoun: 'Domain name — A → Z',
    direction: 'asc',
    isMetric: false,
    globalOnly: true,
  },
  {
    key: 'domain_za',
    label: 'Domain name — Z → A',
    baseNoun: 'Domain name — Z → A',
    direction: 'desc',
    isMetric: false,
    globalOnly: true,
  },
  {
    key: 'biggest_bonus',
    label: 'Biggest bonus amount',
    baseNoun: 'bonus amount',
    metricField: 'metric_max_bonus_amount',
    scopedMetricField: 'max_bonus_amount',
    direction: 'desc',
    isMetric: true,
  },
  {
    key: 'highest_max_withdraw',
    label: 'Highest max withdrawal',
    baseNoun: 'max withdrawal',
    metricField: 'metric_max_withdraw',
    scopedMetricField: 'max_withdraw',
    direction: 'desc',
    isMetric: true,
  },
  {
    key: 'lowest_cashout',
    label: 'Lowest cash-out',
    baseNoun: 'cash-out',
    metricField: 'metric_min_unlock',
    scopedMetricField: 'min_unlock',
    direction: 'asc',
    isMetric: true,
  },
  {
    key: 'lowest_turnover',
    label: 'Lowest turnover/wager',
    baseNoun: 'turnover/wager',
    metricField: 'metric_min_rollover',
    scopedMetricField: 'min_rollover',
    direction: 'asc',
    isMetric: true,
  },
  {
    key: 'best_turnover',
    label: 'Best turnover',
    baseNoun: 'turnover',
    metricField: 'metric_best_value',
    scopedMetricField: 'best_value',
    direction: 'desc',
    isMetric: true,
  },
  {
    key: 'most_popular',
    label: 'Most popular',
    baseNoun: 'Most popular',
    metricField: 'metric_popularity',
    direction: 'desc',
    isMetric: false,
    globalOnly: true,
  },
];

/**
 * Section 4b: Explicit Drop List - Promos that must never be forced into a public category
 */
export const EXPLICIT_DROP_PATTERNS = [
  /rebate/i,
  /cashback/i,
  /commission/i,
  /slot unlimited/i,
  /turnover rebate/i,
  /win lose rebate/i,
  /vip loyalty/i,
  /vip upgrade/i,
  /vip club/i,
  /tier rewards?/i,
  /golden egg/i,
  /plinko ball/i,
  /scratch card/i,
  /lucky number/i,
  /leaderboard/i,
  /cosmo\s*play/i,
  /cosmojack/i,
];

/**
 * Classifier Decision Tree (Section 4a)
 * 1. Tied to the player's birthday -> birthday
 * 2. Requires inviting / sharing / a downline -> referral
 * 3. No deposit required AND new-member/first-time framing -> signup_no_deposit
 * 4. A PERCENTAGE match on a deposit:
 *    first deposit only -> signup_deposit_match
 *    recurring (daily/weekly/monthly) -> daily
 * 5. Flat free credit or free spins, no deposit, repeating cadence -> daily
 * 6. Flat free credit unlocked by hitting a deposit threshold, repeating -> daily
 * 7. Nothing above matched -> null (DROP)
 */
export function classifyPromo(
  rawName: string,
  rawAmount: string = '',
  rawTerms: string = ''
): { category: BonusCategorySlug | null; dropReason?: string } {
  const text = `${rawName} ${rawAmount} ${rawTerms}`.toLowerCase();

  // Check explicit drop list first
  for (const pattern of EXPLICIT_DROP_PATTERNS) {
    if (pattern.test(text)) {
      return {
        category: null,
        dropReason: `Matched explicit drop pattern: ${pattern.toString()}`,
      };
    }
  }

  // 1. Birthday
  if (/birthday|bday|born day|anniversary of birth/i.test(text)) {
    return { category: 'birthday' };
  }

  // 2. Referral
  if (/refer|friend|invite|downline|share with friends|affiliate commission share/i.test(text)) {
    return { category: 'referral' };
  }

  // 3. Signup No Deposit
  const isNoDeposit =
    /no deposit|free sign|registration bonus|on register|sign up free|welcome free chips?|welcome free spins?/i.test(
      text
    ) && !/deposit match|first deposit match/i.test(text);

  if (isNoDeposit) {
    return { category: 'signup_no_deposit' };
  }

  // 4. Percentage Match on Deposit
  const hasPercentageMatch = /%|\bmatch\b|\bdeposit bonus\b/i.test(text);
  const isFirstDeposit = /first deposit|welcome package|1st deposit|initial deposit|new member deposit/i.test(text);
  const isRecurring = /daily|weekly|monthly|every day|every week|reload|re-deposit/i.test(text);

  if (hasPercentageMatch) {
    if (isFirstDeposit && !isRecurring) {
      return { category: 'signup_deposit_match' };
    }
    if (isRecurring) {
      return { category: 'daily' };
    }
    // Default welcome deposit match if framing is welcome/first
    if (/welcome/i.test(text)) {
      return { category: 'signup_deposit_match' };
    }
  }

  // 5. Flat free credit or free spins, repeating cadence -> daily
  if (/daily login|check-in|everyday bonus|daily gift|daily free|spin the wheel|daily roll/i.test(text)) {
    return { category: 'daily' };
  }

  // 6. Flat free credit unlocked by deposit threshold, repeating -> daily
  if (isRecurring && /deposit/i.test(text)) {
    return { category: 'daily' };
  }

  // 7. Nothing matched -> DROP
  return {
    category: null,
    dropReason: 'Did not meet strict taxonomy criteria (Section 4a)',
  };
}
