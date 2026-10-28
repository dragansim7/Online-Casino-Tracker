# Implementation Plan: Cloud Persistence & Performance Optimization

This plan outlines the end-to-end architecture to implement **Cloud Database Persistence with Firebase Firestore** and **Full-Stack Performance Optimizations** for AXHub, based on your selected priorities.

---

## 1. Objectives & Scope

1. **Cloud Database Persistence (Firestore)**:
   - Seamlessly connect AXHub to your provisioned Firestore database (`ai-studio-axhub-29bb6ce1-faf6-4268-ad2b-79eb95d78116`).
   - Persist all domain listings, scraped bonuses, verification states, visibility toggles, and unmatched promos so they survive server restarts and redeployments permanently.
   - Implement an automatic bootstrap & hydration pipeline: on server startup, load data from Firestore; if the cloud database is empty, seed from the current baseline catalog.
   - Synchronize all admin operations (single domain add, bulk `.txt` import, bulk delete, category toggles) directly with Firestore.
   - Establish hardened `firebase-blueprint.json` and deploy zero-trust `firestore.rules` via Firebase Fax RPC.

2. **Full-Stack Performance Optimization**:
   - **Client-Side Rendering**: Implement virtualized windowing or optimized chunked rendering for the domain listing grid, ensuring smooth 60 FPS scrolling and immediate filter/sort responsiveness even with 900+ active domains.
   - **Server Caching & HTTP ETag / 304**: Add in-memory response caching and conditional `ETag` headers on `/api/listings` and `/api/counts` to eliminate redundant data transfer and sub-5ms repeat requests.
   - **Client Bundle Code-Splitting**: Code-split admin sub-modules (Bulk Importer, Scraper Telemetry, Unmatched Promos) via `React.lazy` and `Suspense` to shrink the initial JavaScript payload for public visitors.
   - **Query & Filter Memoization**: Optimize client-side faceted filtering and bonus metric resolution with pre-computed lookup tables.

3. **Scraper Operations**:
   - Preserve manual on-demand execution as requested (no unwanted cron jobs running in the background).
   - Record completed crawl runs and stage-by-stage telemetry (`Trigger`, `Fetch`, `Extract`, `Publish`) to Firestore for persistence and administrative auditing.

---

## 2. Architecture & Data Model

### 2.1 Firestore Collections
- `listings`: Documents keyed by listing ID / domain slug (`domain`, `display_name`, `affiliate_url`, `verification_status`, `technical_status`, `hidden_categories`, `category_metrics`, `updated_at`).
- `bonuses`: Documents representing active bonus offers (`listing_id`, `category`, `title`, `amount_value`, `percentage`, `rollover`, `min_deposit`, `max_withdraw`, `promo_code`, `valid_until`).
- `promos_unmatched`: Items pending review (`listing_id`, `raw_title`, `detected_category`, `confidence`, `created_at`).
- `sync_runs`: Audit records of manual scraper executions (`timestamp`, `status`, `target_count`, `success_count`, `error_count`, `duration_ms`, `stage_metrics`).

### 2.2 Server-Side Persistence & Hydration Flow
```
Server Boot
   │
   ├─► Initialize Firebase Admin / Firestore SDK (DB: ai-studio-axhub-29bb6ce1-faf6-4268-ad2b-79eb95d78116)
   │
   ├─► Query Firestore 'listings' collection
   │      ├─► If documents exist ──► Hydrate in-memory cache directly from Firestore
   │      └─► If collection empty ─► Seed initial 900+ casinos.json into Firestore batch writes
   │
   └─► Ready to serve fast requests from memory with asynchronous write-through to Firestore
```

### 2.3 Write-Through Mutation Flow
```
Admin Action (Add / Bulk Import / Delete / Sync Run)
   │
   ├─► Validate input (duplicate check, domain format)
   ├─► Apply update to active server state & invalidate response cache
   ├─► Commit batch write / transaction to Firestore
   └─► Return updated status & ETag to frontend
```

---

## 3. Step-by-Step Execution Plan

### Phase 1: Firebase & Firestore Persistence Layer
- [ ] Create `firebase-blueprint.json` defining exact schema entities (`Listing`, `Bonus`, `PromoUnmatched`, `SyncRun`).
- [ ] Implement `src/server/firestoreRepository.ts`:
  - Firestore client initialization targeting database ID `ai-studio-axhub-29bb6ce1-faf6-4268-ad2b-79eb95d78116`.
  - Robust batch read / write operations with automatic batch chunking (Firestore limit of 500 writes per batch).
  - Hydration logic on startup to load all listings, active bonuses, and recent sync runs into memory.
  - CRUD operations: `saveListing`, `bulkSaveListings`, `deleteListing`, `bulkDeleteListings`, `saveBonuses`, `recordSyncRun`.
- [ ] Integrate `firestoreRepository` into `src/server/db.ts` and `server.ts` routes so all reads and admin writes persist to Firestore.
- [ ] Formulate and deploy hardened `firestore.rules` via the `fax.DeployRules` RPC.

### Phase 2: Server-Side Performance & Cache Layer
- [ ] Add an in-memory TTL/hash cache for `/api/listings` and `/api/counts`.
- [ ] Implement HTTP `ETag` and `If-None-Match` conditional handling: return HTTP `304 Not Modified` when listings haven't changed, saving bandwidth and client compute.
- [ ] Cache invalidation hooks on any listing mutation or completed scraper run.

### Phase 3: Frontend Performance & Virtualization
- [ ] Refactor `src/pages/HomePage.tsx` / `src/components/DirectoryGrid.tsx`:
  - Implement efficient list virtualization / windowed DOM rendering to smoothly display hundreds of casino cards without DOM strain.
  - Optimize card re-renders with `React.memo` and stable callback hooks.
  - Memoize filter counts and active bonus badge calculations.
- [ ] Code-split administrative views:
  - Dynamically load the Admin Console (`AdminPage.tsx`), Scraper Telemetry view, and modal dialogs using `React.lazy` and `Suspense`.

### Phase 4: Testing & Verification
- [ ] Verify server bootstrap and Firestore hydration with database `ai-studio-axhub-29bb6ce1-faf6-4268-ad2b-79eb95d78116`.
- [ ] Verify single domain quick add, bulk `.txt` import, and bulk delete write to Firestore and persist across server restart.
- [ ] Verify on-demand manual scraping saves updated bonus figures directly into Firestore.
- [ ] Verify HTTP 304 caching behavior and virtualized grid rendering in the browser.
- [ ] Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.

---

## 4. Verification Criteria
- Server connects to `ai-studio-axhub-29bb6ce1-faf6-4268-ad2b-79eb95d78116` on start and successfully synchronizes data.
- Domain listings and bonus updates remain intact even after stopping and restarting the server.
- The main directory scrolls smoothly with 900+ domains without UI freezing or lag.
- Manual scraper runs execute cleanly on demand and log their metrics to Firestore.
- Zero TypeScript, ESLint, or runtime compilation errors.
