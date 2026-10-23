/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, ArrowLeft } from 'lucide-react';
import { useFavourites } from '../lib/favourites.ts';
import { Listing } from '../types/index.ts';
import { ListingCard } from '../components/ListingCard.tsx';

export const Favourites: React.FC = () => {
  const { favourites } = useFavourites();
  const [items, setItems] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (favourites.length === 0) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`/api/favourites?ids=${favourites.join(',')}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
      })
      .catch((err) => {
        console.error('Failed to load favourites:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [favourites]);

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between border-b border-[#26262E] pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-100 flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            <span>Saved Favourites</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Locally stored domains saved for quick reference.
          </p>
        </div>

        <Link
          to="/directory"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Browse directory</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-xs font-mono text-zinc-400">
          Loading saved items...
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-md border border-[#26262E] bg-[#111114] space-y-4">
          <Heart className="w-8 h-8 text-zinc-600 mx-auto" />
          <div className="text-zinc-300 font-semibold text-sm">No favourites saved yet</div>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Click the heart icon on any listing card in the directory to save it to your local list.
          </p>
          <div>
            <Link
              to="/directory"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors"
            >
              <span>Explore Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
