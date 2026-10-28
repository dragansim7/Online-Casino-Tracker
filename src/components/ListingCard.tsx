/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ExternalLink, ArrowRight, Star } from 'lucide-react';
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

  const bonus = listing.matched_bonus;

  return (
    <div className="group relative flex flex-col justify-between p-4 rounded-lg border border-[#26262E] bg-[#15151A] hover:border-[#FFB020]/50 transition-all duration-200 shadow-md">
      <div>
        {/* Top Header: Name, Monospace Domain, and Favourite Heart */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                to={`/listing/${listing.id}`}
                className="font-bold text-zinc-100 hover:text-[#FFC24D] transition-colors truncate block text-base"
                title={listing.name}
              >
                {listing.name}
              </Link>
              {listing.is_featured && (
                <span
                  title="Featured Domain"
                  className="inline-flex items-center text-[#FFB020] shrink-0"
                >
                  <Star className="w-4 h-4 fill-[#FFB020]" />
                </span>
              )}
            </div>

            <div className="font-mono text-xs text-zinc-500 tracking-tight truncate mt-0.5">
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

        {/* Filtered & Sorted Active Bonus Showcase Box */}
        <div className="rounded-md border border-[#26262E] bg-[#111114] p-3 mb-3.5 space-y-2.5">
          {bonus ? (
            <>
              {/* Highlight Headline */}
              <div>
                <div className="text-base font-extrabold text-[#FFB020] tracking-tight leading-tight">
                  {bonus.amount_label}
                </div>
                <div className="text-xs text-zinc-400 font-medium truncate mt-0.5" title={bonus.name}>
                  {bonus.name}
                </div>
              </div>

              {/* Specifications Key-Value Grid */}
              <div className="space-y-1.5 text-[11px] pt-2 border-t border-[#26262E]/80">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Turnover / wager</span>
                  <span className="text-zinc-200 font-mono font-bold">
                    {bonus.rollover !== null && bonus.rollover !== undefined ? `${bonus.rollover}×` : 'None'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Minimum to unlock</span>
                  <span className="text-zinc-200 font-mono">
                    {bonus.min_unlock !== null && bonus.min_unlock !== undefined
                      ? `AUD ${bonus.min_unlock}`
                      : bonus.min_deposit !== null && bonus.min_deposit !== undefined
                      ? `AUD ${bonus.min_deposit}`
                      : 'Free'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Maximum withdrawal</span>
                  <span className="text-zinc-200 font-mono font-semibold">
                    {bonus.max_withdraw !== null && bonus.max_withdraw !== undefined
                      ? `AUD ${bonus.max_withdraw.toLocaleString()}`
                      : 'No limit'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Claim condition</span>
                  <span className="text-zinc-300 font-medium capitalize">
                    {bonus.claim_condition === 'FREE'
                      ? 'Free'
                      : bonus.claim_condition === 'DEPOSIT'
                      ? 'Deposit'
                      : 'Custom claim'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Allowed games / providers</span>
                  <span className="text-zinc-300 font-medium truncate max-w-[150px] text-right" title={bonus.game_types || bonus.providers_allowed || 'Pokies'}>
                    {bonus.game_types || bonus.providers_allowed || 'Pokies'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-2 text-center space-y-1">
              <div className="text-xs font-semibold text-zinc-300">
                No active offers matching current filter
              </div>
              <div className="text-[11px] text-zinc-500">
                Standard play & site promotions available directly.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Actions: Details + Visit Site */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#26262E]">
        <Link
          to={`/listing/${listing.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#26262E] bg-[#111114] text-zinc-200 hover:text-white hover:border-[#FFB020]/40 transition-colors"
        >
          <span>Details</span>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
        </Link>

        <a
          href={listing.destination_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={handleVisit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md bg-[#FFB020] text-zinc-950 hover:bg-[#FFC24D] transition-colors shadow-sm"
        >
          <span>Visit site</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
