/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { fetchListingDetail, recordListingClick } from '../lib/api.ts';
import { Bonus, BonusCategorySlug, Listing } from '../types/index.ts';
import { BONUS_CATEGORIES } from '../constants/taxonomy.ts';
import { StatusPill } from '../components/StatusPill.tsx';
import { BonusCard } from '../components/BonusCard.tsx';
import { ListingCard } from '../components/ListingCard.tsx';
import { useFavourites } from '../lib/favourites.ts';

export const ListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    listing: Listing;
    bonuses: Bonus[];
    similar: Listing[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isFav, toggle } = useFavourites();

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    fetchListingDetail(id)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load listing details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs font-mono text-zinc-400">
        Loading directory entry...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="text-zinc-200 font-bold text-lg">Listing Not Found</div>
        <p className="text-zinc-400 text-xs">
          The requested domain entry does not exist or may have been unindexed.
        </p>
        <Link
          to="/directory"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FFB020] text-zinc-950 font-semibold text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Directory</span>
        </Link>
      </div>
    );
  }

  const { listing, bonuses, similar } = data;
  const isSaved = isFav(listing.id);

  const handleVisit = () => {
    recordListingClick(listing.id);
  };

  // Group bonuses by closed set of 5 categories in Section 4 fixed render order
  const groupedBonuses: { category: (typeof BONUS_CATEGORIES)[number]; items: Bonus[] }[] =
    BONUS_CATEGORIES.map((cat) => ({
      category: cat,
      items: bonuses.filter((b) => b.category === cat.slug),
    })).filter((group) => group.items.length > 0); // Render section ONLY if the listing has >=1 bonus in it (Section 4)

  const formattedCheckedDate = listing.bonus_checked_at
    ? new Date(listing.bonus_checked_at).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No check recorded yet';

  return (
    <div className="space-y-10 py-4 max-w-5xl mx-auto">
      {/* Back Link */}
      <div>
        <Link
          to="/directory"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to directory</span>
        </Link>
      </div>

      {/* Listing Hero Block */}
      <div className="p-6 rounded-md border border-[#26262E] bg-[#111114] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
                {listing.name}
              </h1>
              <button
                type="button"
                onClick={() => toggle(listing.id)}
                aria-label={`Save ${listing.name} to favourites`}
                aria-pressed={isSaved}
                className={`p-1.5 rounded-md transition-colors ${
                  isSaved
                    ? 'text-rose-500 bg-rose-500/10'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#1C1C22]'
                }`}
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-rose-500' : ''}`} />
              </button>
            </div>

            <div className="font-mono text-sm text-zinc-400 mt-1">
              {listing.domain}
            </div>

            <div className="mt-3">
              <StatusPill
                technicalStatus={listing.technical_status}
                verificationStatus={listing.verification_status}
                bonusCount={listing.bonus_count}
              />
            </div>
          </div>

          {/* Primary Action Button: Open recorded destination */}
          <div className="shrink-0 flex sm:flex-col gap-2">
            <a
              href={listing.destination_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              onClick={handleVisit}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-[#FFB020]/40"
            >
              <span>Open recorded destination</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {listing.description && (
          <p className="text-xs text-zinc-400 leading-relaxed pt-2 border-t border-[#26262E]/60">
            {listing.description}
          </p>
        )}
      </div>

      {/* Record Details Definition List (Section 7) */}
      <section className="p-5 rounded-md border border-[#26262E] bg-[#15151A] space-y-3">
        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider text-[11px] text-zinc-400">
          Record Details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-xs">
          <div>
            <dt className="text-zinc-500">Normalised Domain</dt>
            <dd className="font-mono text-zinc-200 mt-0.5">{listing.normalised_domain}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Indexing Source</dt>
            <dd className="capitalize text-zinc-200 mt-0.5">{listing.source}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">First Indexed</dt>
            <dd className="font-mono text-zinc-200 mt-0.5">
              {new Date(listing.created_date).toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Technical Status</dt>
            <dd className="capitalize text-zinc-200 mt-0.5">{listing.technical_status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Directory Verification</dt>
            <dd className="capitalize text-zinc-200 mt-0.5">{listing.verification_status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Destination Target</dt>
            <dd className="font-mono text-zinc-400 truncate mt-0.5" title={listing.destination_url}>
              {listing.destination_url}
            </dd>
          </div>
        </dl>
      </section>

      {/* Current Bonus Availability Section (Section 7 & Section 8) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#26262E] pb-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">
              Current Bonus Availability
            </h2>
            <div className="text-xs text-zinc-400 mt-0.5">
              Last pulled: <span className="font-mono text-zinc-200">{formattedCheckedDate}</span>
            </div>
          </div>
          <div className="text-xs font-mono text-[#FFC24D]">
            {bonuses.length} structured {bonuses.length === 1 ? 'bonus' : 'bonuses'} recorded
          </div>
        </div>

        {/* Grouped Bonuses Rendered by Category */}
        {groupedBonuses.length > 0 ? (
          <div className="space-y-8">
            {groupedBonuses.map(({ category, items }) => (
              <div key={category.slug} className="space-y-3">
                <div className="flex items-baseline justify-between border-b border-[#26262E]/70 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">
                      {category.heading}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{category.subline}</p>
                  </div>
                  <span className="text-xs font-mono text-zinc-500 shrink-0">
                    {items.length} recorded
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((bonus) => (
                    <BonusCard key={bonus.id} bonus={bonus} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State when no readable feed (Section 8) */
          <div className="p-8 rounded-md border border-[#26262E] bg-[#111114] text-center space-y-2">
            <p className="text-zinc-300 text-xs">
              {listing.feed_status === 'no_feed'
                ? 'This site does not publish a public promotion feed that can be read.'
                : 'No structured bonuses currently recorded for this domain.'}
            </p>
            <p className="text-[11px] text-zinc-500">
              Crawl engine discovered zero verified promotions matching AXHub's 5-category taxonomy.
            </p>
          </div>
        )}
      </section>

      {/* What These Statuses Mean Explanatory Guide (Section 13) */}
      <section className="p-5 rounded-md border border-[#26262E] bg-[#111114] space-y-3 text-xs leading-relaxed text-zinc-400">
        <h3 className="font-bold text-zinc-200 flex items-center gap-1.5 text-xs uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-zinc-400" />
          What these statuses mean
        </h3>
        <ul className="space-y-2">
          <li>
            <strong className="text-zinc-300">Technical Availability:</strong> Indicates whether the domain HTTP endpoint replied successfully during the most recent automated scan. It does not certify that the site is safe, legal, or solvent. Automated availability monitoring is periodic, so statuses may temporarily go stale.
          </li>
          <li>
            <strong className="text-zinc-300">Verification Status:</strong> Represents internal AXHub editorial review (confirming domain formatting and destination consistency). It is <em>not</em> an endorsement or regulatory licensing audit.
          </li>
          <li>
            <strong className="text-zinc-300">Promotion Rules:</strong> Bonus terms, wagering multipliers, and withdrawal caps are captured verbatim from the operator's public modals and are subject to immediate revision by the casino operator.
          </li>
        </ul>
      </section>

      {/* Similar Listings Section */}
      {similar.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-[#26262E]">
          <h3 className="text-sm font-bold text-zinc-100">Similar Listings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {similar.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
