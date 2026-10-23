/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[#26262E] bg-[#0B0B0D] text-zinc-400 text-xs mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        {/* Warning Banner (Section 12) */}
        <div className="p-4 rounded-md border border-[#26262E] bg-[#111114] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded bg-amber-500/10 text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <div className="text-zinc-200 font-semibold text-sm">
                Gambling can be harmful. Only gamble what you can afford to lose.
              </div>
              <div className="text-zinc-400 text-xs mt-0.5">
                If gambling is causing you or someone you know harm, free and confidential support is available 24/7.
              </div>
            </div>
          </div>
          <Link
            to="/responsible-gambling"
            className="inline-flex items-center px-3 py-1.5 rounded text-xs font-medium border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors shrink-0"
          >
            Responsible Gambling Support
          </Link>
        </div>

        {/* Regulatory & Disclaimer Copy (Section 12) */}
        <div className="space-y-3 text-[11.5px] leading-relaxed text-zinc-500 border-b border-[#26262E] pb-8">
          <p>
            <strong className="text-zinc-400">Independent Directory Notice:</strong> AXHub is an independent domain directory and bonus index. A listing in AXHub is <strong className="text-zinc-400">not an endorsement</strong>. AXHub does not verify gambling licences, regulatory standings, or financial stability of listed operators.
          </p>
          <p>
            <strong className="text-zinc-400">Availability & Verification Semantics:</strong> Technical availability only means the domain responded with an HTTP status when last checked and is <strong className="text-zinc-400">NOT a licence, safety, or legality check</strong>. Statuses can go stale as automated real-time probers are periodic. Directory "verification" designates an internal editorial review step verifying domain identity, not regulatory oversight.
          </p>
          <p>
            <strong className="text-zinc-400">Bonus Terms:</strong> Bonus conditions, wagering multipliers, unlock thresholds, and withdrawal caps are captured verbatim from public operator feeds and may change without notice. Always verify active terms directly on the operator website before participating.
          </p>
        </div>

        {/* Navigation & Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-200">AXHub</span>
            <span>·</span>
            <span>Independent Casino & Domain Directory</span>
          </div>

          <nav className="flex flex-wrap items-center gap-4 text-zinc-400">
            <Link to="/directory" className="hover:text-zinc-200 transition-colors">
              Directory
            </Link>
            <Link to="/about" className="hover:text-zinc-200 transition-colors">
              About
            </Link>
            <Link to="/contact" className="hover:text-zinc-200 transition-colors">
              Contact
            </Link>
            <Link to="/privacy" className="hover:text-zinc-200 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-zinc-200 transition-colors">
              Terms of Use
            </Link>
            <Link to="/responsible-gambling" className="hover:text-amber-300 transition-colors">
              Responsible Gambling
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};
