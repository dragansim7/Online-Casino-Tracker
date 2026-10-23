/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

const FAV_KEY = 'axhub:favourites';
const EVENT_KEY = 'axhub:favourites-changed';

export function getFavourites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isFavourite(id: string): boolean {
  const favs = getFavourites();
  return favs.includes(id);
}

export function toggleFavourite(id: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = getFavourites();
  const exists = current.includes(id);
  const updated = exists ? current.filter((x) => x !== id) : [...current, id];

  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: { favourites: updated } }));

    // Non-blocking increment to backend engagement
    if (!exists) {
      fetch(`/api/listings/${id}/favourite`, { method: 'POST' }).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to update favourites:', err);
  }

  return !exists;
}

export function useFavourites() {
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    setFavourites(getFavourites());

    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.favourites) {
        setFavourites(custom.detail.favourites);
      } else {
        setFavourites(getFavourites());
      }
    };

    window.addEventListener(EVENT_KEY, handler);
    window.addEventListener('storage', handler);

    return () => {
      window.removeEventListener(EVENT_KEY, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return {
    favourites,
    isFav: (id: string) => favourites.includes(id),
    toggle: (id: string) => toggleFavourite(id),
  };
}
