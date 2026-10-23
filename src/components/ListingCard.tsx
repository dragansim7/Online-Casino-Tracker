/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ExternalLink, ArrowRight, ShieldCheck, Star } from 'lucide-react';
import { Listing } from '../types/index.ts';
import { StatusPill } from './StatusPill.tsx';
import { useFavourites } from '../lib/favourites.ts';
import { recordListingClick } from '../lib/api.ts';

interface ListingCardProps {
  listing: Listing;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const { isFav, toggle } = useFavourites();
  const isSaved = isFav(listing.id);

  const handleVisit = () => {
    recordListingClick(listing.id);
  };

  const formattedAddedDate = new Date(listing.created_date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedCheckedDate = listing.last_checked_at
    ? new Date(listing.last_checked_at).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No check recorded yet';

  return (
    <div className="group relative flex flex-col justify-between p-3.5 rounded-md border border-[#26262E] bg-[#15151A] hover:border-[#FFB020]/40 transition-colors">
      <div>
        {/* Top Header: Name, Monospace Domain, and Favourite Heart */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                to={`/listing/${listing.id}`}
                className="font-medium text-zinc-100 hover:text-[#FFC24D] transition-colors truncate block text-sm"
                title={listing.name}
              >
                {listing.name}
              </Link>
              {listing.is_featured && (
                <span
                  title="Featured Domain"
                  className="inline-flex items-center text-[#FFB020] shrink-0"
                >
                  <Star className="w-3.5 h-3.5 fill-[#FFB020]" />
                </span>
              )}
            </div>

            <div className="font-mono text-[12px] text-zinc-500 tracking-tight truncate mt-0.5">
              {listing.domain}
            </div>
          </div>

          {/* Favourite Heart Button */}
          <button
            type="button"
            onClick={() => toggle(listing.id)}
            aria-label={`Save ${listing.name} to favourites`}
            aria-pressed={isSaved}
            className={`p-1.5 rounded-md transition-colors shrink-0 focus:outline-none focus:ring-1 focus:ring-[#FFB020]/40 ${
              isSaved
                ? 'text-rose-500 hover:text-rose-400 bg-rose-500/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#1C1C22]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500' : ''}`} />
          </button>
        </div>

        {/* Status Pills */}
        <div className="mb-3">
          <StatusPill
            technicalStatus={listing.technical_status}
            verificationStatus={listing.verification_status}
            bonusCount={listing.bonus_count}
          />
        </div>

        {/* Added & Availability Checked Rows (Section 7) */}
        <div className="space-y-1 text-[11px] text-zinc-400 border-t border-[#26262E]/60 pt-2.5 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Added</span>
            <span className="text-zinc-300 font-mono">{formattedAddedDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Availability checked</span>
            <span className="text-zinc-400 font-mono text-[10.5px]">
              {formattedCheckedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Card Actions: Details + Visit Site */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#26262E]">
        <Link
          to={`/listing/${listing.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#26262E] bg-[#111114] text-zinc-200 hover:text-white hover:border-[#FFB020]/30 transition-colors focus:outline-none focus:ring-1 focus:ring-[#FFB020]/40"
        >
          Details
          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
        </Link>

        <a
          href={listing.destination_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={handleVisit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#FFB020] text-zinc-950 hover:bg-[#FFC24D] transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-[#FFB020]/40"
        >
          Visit site
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
