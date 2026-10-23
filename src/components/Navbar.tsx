/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Heart, Shield, Lock, Search, LogOut } from 'lucide-react';
import { useFavourites } from '../lib/favourites.ts';
import { useAuth } from '../lib/auth.ts';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { favourites } = useFavourites();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 h-14 bg-[#0B0B0D]/95 backdrop-blur border-b border-[#26262E]">
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        {/* Brand / Logo (Single Wordmark) */}
        <Link
          to="/"
          className="flex items-center gap-2 text-zinc-100 font-bold tracking-tight text-lg hover:text-[#FFB020] transition-colors whitespace-nowrap shrink-0"
        >
          <span className="w-6 h-6 rounded bg-[#FFB020] text-zinc-950 flex items-center justify-center font-black text-xs">
            AX
          </span>
          <span>AXHub</span>
        </Link>

        {/* Desktop Nav Links (Section 2 Top Bar Contract) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
          <Link
            to="/directory"
            className="hover:text-zinc-100 transition-colors whitespace-nowrap"
          >
            Directory
          </Link>
          <Link
            to="/favourites"
            className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors whitespace-nowrap"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
            <span>Favourites</span>
            {favourites.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#1C1C22] text-[#FFB020] border border-[#26262E] text-[10px] font-mono font-bold">
                {favourites.length}
              </span>
            )}
          </Link>
          <Link
            to="/responsible-gambling"
            className="hover:text-zinc-100 transition-colors whitespace-nowrap text-amber-400/90"
          >
            Responsible Play
          </Link>
          <Link
            to="/about"
            className="hover:text-zinc-100 transition-colors whitespace-nowrap"
          >
            About
          </Link>
        </nav>

        {/* Actions Zone: Admin status or Login */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#FFB020] text-zinc-950 hover:bg-[#FFC24D] transition-colors shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#15151A]"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-mono truncate max-w-[120px]">
                {user.email}
              </span>
              <button
                type="button"
                onClick={logout}
                aria-label="Log out"
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/directory"
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[#FFB020] text-zinc-950 hover:bg-[#FFC24D] transition-colors"
              >
                Browse Directory
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            to="/favourites"
            aria-label="Favourites"
            className="p-2 text-zinc-400 hover:text-zinc-100 relative"
          >
            <Heart className="w-5 h-5" />
            {favourites.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FFB020]" />
            )}
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#15151A] focus:outline-none"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden bg-[#0B0B0D] border-b border-[#26262E] px-4 py-4 space-y-3">
          <Link
            to="/directory"
            onClick={() => setIsOpen(false)}
            className="block text-sm font-medium text-zinc-200 py-1"
          >
            Directory
          </Link>
          <Link
            to="/favourites"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between text-sm font-medium text-zinc-200 py-1"
          >
            <span>Favourites</span>
            <span className="font-mono text-xs bg-[#1C1C22] px-2 py-0.5 rounded text-[#FFB020]">
              {favourites.length}
            </span>
          </Link>
          <Link
            to="/responsible-gambling"
            onClick={() => setIsOpen(false)}
            className="block text-sm font-medium text-amber-400 py-1"
          >
            Responsible Gambling Support
          </Link>
          <Link
            to="/about"
            onClick={() => setIsOpen(false)}
            className="block text-sm font-medium text-zinc-200 py-1"
          >
            About AXHub
          </Link>

          <div className="pt-3 border-t border-[#26262E] flex flex-col gap-2">
            {isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="w-full text-center py-2 text-xs font-semibold rounded bg-[#FFB020] text-zinc-950"
              >
                Open Admin Console
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="w-full text-center py-2 text-xs font-medium rounded border border-[#26262E] bg-[#15151A] text-zinc-200"
              >
                Sign In / Admin
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
