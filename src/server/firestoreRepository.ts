/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { firestoreDb } from '../lib/firebase.ts';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { Listing, Bonus, SyncRun, PromoUnmatched } from '../types/index.ts';

export class FirestoreRepository {
  private isOnline = false;

  constructor() {
    this.checkConnection();
  }

  private async checkConnection() {
    try {
      // Light check on database readiness
      if (firestoreDb && firestoreDb.app) {
        this.isOnline = true;
      }
    } catch {
      this.isOnline = false;
    }
  }

  /**
   * Asynchronously push a listing to Firestore
   */
  public async syncListing(listing: Listing): Promise<void> {
    try {
      const docRef = doc(firestoreDb, 'listings', listing.id);
      await setDoc(docRef, {
        id: listing.id,
        name: listing.name,
        domain: listing.domain,
        normalised_domain: listing.normalised_domain,
        destination_url: listing.destination_url,
        description: listing.description || '',
        admin_notes: listing.admin_notes || '',
        is_featured: listing.is_featured,
        technical_status: listing.technical_status,
        verification_status: listing.verification_status,
        bonus_count: listing.bonus_count,
        bonus_status: listing.bonus_status,
        hidden_categories: listing.hidden_categories || [],
        category_metrics: listing.category_metrics || {},
        updated_date: listing.updated_date,
        created_date: listing.created_date,
      }, { merge: true });
    } catch (err: any) {
      // Firestore errors are caught and logged so server never crashes on network/credential drops
      console.warn(`[Firestore] Sync listing ${listing.domain} notice:`, err.message || err);
    }
  }

  /**
   * Delete a listing from Firestore
   */
  public async deleteListing(id: string): Promise<void> {
    try {
      const docRef = doc(firestoreDb, 'listings', id);
      await deleteDoc(docRef);
    } catch (err: any) {
      console.warn(`[Firestore] Delete listing ${id} notice:`, err.message || err);
    }
  }

  /**
   * Save a completed sync run record to Firestore for audit
   */
  public async recordSyncRun(syncRun: SyncRun): Promise<void> {
    try {
      const docRef = doc(firestoreDb, 'sync_runs', syncRun.id);
      await setDoc(docRef, syncRun, { merge: true });
    } catch (err: any) {
      console.warn(`[Firestore] Record sync run notice:`, err.message || err);
    }
  }

  /**
   * Attempt to load cloud listings from Firestore
   */
  public async fetchCloudListings(): Promise<Listing[] | null> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'listings'));
      if (snap.empty) return null;
      const listings: Listing[] = [];
      snap.forEach((d) => {
        listings.push(d.data() as Listing);
      });
      return listings;
    } catch (err: any) {
      console.warn('[Firestore] fetchCloudListings notice:', err.message || err);
      return null;
    }
  }
}

export const firestoreRepo = new FirestoreRepository();
