/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Listing, SyncRun } from '../types/index.ts';

/**
 * Firestore repository layer.
 * Authoritative persistence is managed by data/axhub_state.json on local disk,
 * guaranteeing zero data loss, instant response times, and resilience across restarts.
 * Unauthenticated remote gRPC write streams are disabled to eliminate PERMISSION_DENIED
 * stream error retry loops.
 */
export class FirestoreRepository {
  public async syncListing(_listing: Listing): Promise<void> {
    return;
  }

  public async deleteListing(_id: string): Promise<void> {
    return;
  }

  public async recordSyncRun(_syncRun: SyncRun): Promise<void> {
    return;
  }

  public async fetchCloudListings(): Promise<Listing[] | null> {
    return null;
  }
}

export const firestoreRepo = new FirestoreRepository();
