# AXHub — Independent Casino Domain Directory & Bonus Engine

AXHub is an independent, searchable directory of casino websites and domains, featuring a structured bonus-comparison engine, filter-aware sorting, and a dark, minimal, mobile-first UI.

---

## 1. Entity Setup & Architecture

AXHub utilizes a full-stack Node/Express architecture backed by denormalised entity records:

- **`Listing`**: Contains identity (`name`, `domain`, `normalised_domain`), status indicators (`technical_status`, `verification_status`), and denormalised sortable metric columns (`metric_max_bonus_amount`, `metric_max_withdraw`, `metric_min_rollover`, `metric_min_unlock`, `metric_best_value`, `metric_popularity`, `category_metrics`).
- **`Bonus`**: Stored in a strict closed set of 5 categories (`signup_no_deposit`, `signup_deposit_match`, `referral`, `daily`, `birthday`). Fields are stored only when present (or `NULL`), preserving operator line breaks and `✦` separators verbatim.
- **`PromoUnmatched`**: Dropped promotions that fail classifier rules or match explicit drop lists (rebates, VIP tiers, mini-games, partner brands). Accessible via the Admin Unmatched Queue for manual categorization.
- **`SyncRun` & `ImportBatch`**: Maintain audit trails of crawler runs, durations, tokens, and deduplicated domain imports.
- **`ListingEngagement`**: Tracks clicks on "Visit site" and client-side favourite toggles (`popularity_score = (clicks * 2) + (favourites * 3) + bonus_count`).

---

## 2. Contextual Sort Resolver

Metric sorting adapts contextually based on active category filters (Section 6):

- **Scope Resolution**:
  - `GLOBAL`: When no category filter is active, sorting evaluates listing-level `metric_*` columns.
  - `SCOPED`: When one or more categories are selected, reads `category_metrics[cat]`. For multi-category selections:
    - `MAX` for `biggest_bonus`, `highest_max_withdraw`, and `best_value`.
    - `MIN` for `lowest_cashout` and `lowest_turnover`.
  - `domain_az`, `domain_za`, and `most_popular` are always global.
- **Dynamic Relabeling**:
  - Selecting *Signup no deposit* automatically defaults to and relabels `Biggest Signup no deposit bonus amount`.
  - Selecting *Daily free* defaults to `Lowest Daily free turnover/wager`.
  - Selecting *Referral* or *Birthday* defaults to `Highest [Category] max withdrawal`.
  - Labels follow the `{Chip label} {noun}` template.
- **No-Data & Nulls-Last Handling**:
  - Metric options with no data in the active scope are disabled with a ` (no data)` suffix, never hidden.
  - Listings with `NULL` metric values always sort last in either direction.
  - Secondary tiebreaker is always `normalised_domain asc` for deterministic pagination.
  - Query parameters (`?cat=...&sort=...&page=...`) persist full state in the URL.

---

## 3. Feed Discovery & Bonus Sync Engine

- **Feed Discovery**: Discovers promo feeds in order: `{domain}/promotion`, `/promotions`, `/bonus`, `/bonuses`, `/promo`, then scans homepage links matching `/promo|bonus|offer|reward/i`. Never guesses feeds from domain names.
- **Direct API Adapters (Zero-LLM Scraping)**:
  - For white-label platforms like Yeah96, AXHub utilizes the direct public wallet endpoint (`POST ${baseUrl}/api/v1/index.php` with `module=/merchants/getPublicInfo&merchantId=140`).
  - Fetches the raw JSON list of promotions in under 300ms, parses Quill HTML/delta terms, extracts wagering/deposit/withdrawal caps directly from API fields, and maps them to the 5 AXHub categories without spending any LLM credits or waiting on 6-hour cron delays.
- **Scraping Abstraction & LLM Extraction (Generic Sites)**:
  - Captures promotion modal text and card names on arbitrary HTML sites.
  - Passes raw modal text to Gemini 3.8 Flash (`@google/genai`) or deterministic tree with strict JSON schema.
  - Strictly adheres to the **Negative-Fit Rule**: if confidence < 0.7 or matched against the drop list, category is set to `null` and routed to `PromoUnmatched`.
- **Non-Destructive Write Resilience**:
  - If a fetch fails or times out, existing bonuses remain untouched. `feed_status` is updated to `'error'` without wiping historical data.
  - If a feed genuinely returns 0 offers, `bonus_status='no_offers'` and `bonus_count=0` are recorded.

---

## 4. Classifier Decision Tree & Drop List

Strict first-match-wins order:
1. Tied to player's birthday → `birthday`
2. Requires inviting / sharing / downline → `referral`
3. No deposit required AND new member framing → `signup_no_deposit`
4. Percentage match on deposit (first deposit → `signup_deposit_match`, recurring → `daily`)
5. Flat free credit / free spins with repeating cadence → `daily`
6. Flat free credit unlocked by deposit threshold with repeating cadence → `daily`
7. Otherwise → **DROP** (into `PromoUnmatched`).

**Explicit Drop List**:
- Rebates / cashback: "Weekly Rebate", "Daily Win Lose Rebate", "Weekly Commission", "Slot Unlimited", "Cashback", "Turnover Rebate"
- Loyalty / tier programmes: "VIP Loyalty Program", "VIP Upgrade Bonus", "VIP Club", "Tier Rewards"
- Mini-games / side features: "Golden Egg Bonus", "Plinko Ball Bonus", "Scratch Card", "Lucky Number", "Leaderboard"
- Third-party / partner brands: "COSMO PLAY", "COSMOJACK"

---

## 5. Seed Data & Acceptance Tests Verified

- **~900 Australian Domains**: Seeded with real Australian patterns (`yes77au.com`, `yes68.com`, `xpay33.com`, `zebra88.club`, `zeroaud.com`, `youwin777au.com`, `koala777.com`, `wombatbet.com`, `crownpokies.com`, `auslot88.com`, etc.) with referral-suffixed destination URLs.
- **Rich Listing**: `yes77au.com` contains bonuses across all 5 categories with varied amounts, rollovers (1x to 35x), unlock minimums ($10 to $50), and withdrawal caps ($100 to $5,000).
- **Droppable Promos Seeded**: Deliberately seeded rebates, VIP programs, and mini-games in `PromoUnmatched` to prove the drop list works.
- **Simulation Suite**: Admin console allows simulating fetch failures (leaving data intact) and zero-offer responses.

---

## 6. What Still Needs Real Data

In a live production deployment:
1. **Live Headless Browser Scraper Service**: Deploy Puppeteer/Playwright headless Chromium worker to execute JavaScript rendering on target casino single-page apps.
2. **Rotating Residential IP Proxy Pool**: Australian-geolocated residential proxy egress to bypass regional geo-blocks.
3. **Automated Availability Heartbeat**: Background cron job calling HTTP `HEAD` / `GET` probes on indexed domains every 6 hours.
