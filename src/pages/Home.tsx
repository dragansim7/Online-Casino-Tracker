/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ArrowRight, ShieldCheck, Star, Layers, Globe } from 'lucide-react';
import { fetchLiveCounts, fetchListings } from '../lib/api.ts';
import { Listing } from '../types/index.ts';
import { ListingCard } from '../components/ListingCard.tsx';

export const Home: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState<{ domains: number; featured: number; verified: number }>({
    domains: 0,
    featured: 0,
    verified: 0,
  });
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [recentListings, setRecentListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        const [countsData, featuredData, recentData] = await Promise.all([
          fetchLiveCounts(),
          fetchListings({ limit: 4, sort: 'domain_az' }),
          fetchListings({ limit: 6, sort: 'domain_az' }),
        ]);

        setCounts(countsData);
        // Filter featured from initial set or fetch
        const featured = featuredData.items.filter((item) => item.is_featured);
        setFeaturedListings(featured.slice(0, 4));
        setRecentListings(recentData.items.slice(0, 6));
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/directory?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/directory');
    }
  };

  return (
    <div className="space-y-14 py-6 md:py-10">
      {/* Hero Section (Section 7) */}
      <section className="text-center max-w-3xl mx-auto px-4 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#26262E] bg-[#111114] text-xs text-zinc-400">
          <Globe className="w-3.5 h-3.5 text-[#FFB020]" />
          <span>Independent Australia & Global Domain Index</span>
        </div>

        {/* H1 and one-line explainer */}
        <h1 className="text-4xl sm:text-5xl font-black text-zinc-100 tracking-tight">
          AXHub
        </h1>
        <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed text-balance">
          An independent, searchable directory of casino websites and domains, with a structured bonus-comparison engine and filter-aware sorting.
        </p>

        {/* Large Search Form (role="search") */}
        <form
          role="search"
          onSubmit={handleSearchSubmit}
          className="relative max-w-xl mx-auto mt-6"
        >
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by casino name or domain (e.g. yes77au.com, pokies)..."
              className="w-full pl-12 pr-28 py-3.5 rounded-lg border border-[#26262E] bg-[#15151A] text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-[#FFB020] focus:ring-1 focus:ring-[#FFB020]/40 transition-colors"
            />
            <button
              type="submit"
              className="absolute right-2 px-4 py-2 rounded-md bg-[#FFB020] text-zinc-950 font-semibold text-xs hover:bg-[#FFC24D] transition-colors cursor-pointer"
            >
              Search
            </button>
          </div>
        </form>

        {/* Live Counts (Section 7) */}
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-400 pt-1">
          <span className="text-zinc-200 font-semibold">{counts.domains.toLocaleString()} domains</span>
          <span>·</span>
          <span className="text-zinc-200 font-semibold">{counts.featured} featured</span>
          <span>·</span>
          <span className="text-zinc-200 font-semibold">{counts.verified} verified</span>
        </div>

        {/* Disclaimer Microcopy */}
        <p className="text-[11.5px] text-zinc-500 max-w-lg mx-auto leading-normal">
          Availability only reflects domain response when last crawled. AXHub does not verify gambling licenses or endorse operators.
        </p>
      </section>

      {/* Featured Listings Section (Section 7) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-[#FFB020] fill-[#FFB020]" />
            <h2 className="text-base font-bold text-zinc-100">Featured Listings</h2>
          </div>
          <Link
            to="/directory?ver=verified"
            className="text-xs text-zinc-400 hover:text-[#FFB020] transition-colors flex items-center gap-1"
          >
            <span>View verified</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {featuredListings.length === 0 ? (
          <div className="p-8 rounded-md border border-[#26262E] bg-[#111114] text-center text-sm text-zinc-500">
            No featured listings yet
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* Recently Added Section (6-card grid) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-400" />
            <h2 className="text-base font-bold text-zinc-100">Recently Added</h2>
          </div>
          <Link
            to="/directory"
            className="text-xs text-zinc-400 hover:text-[#FFB020] transition-colors flex items-center gap-1"
          >
            <span>All listings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>

        {/* Browse the Full Directory Button */}
        <div className="pt-6 text-center">
          <Link
            to="/directory"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-sm hover:bg-[#FFC24D] transition-colors shadow-sm"
          >
            <span>Browse the full directory</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};
