/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const ListingCardSkeleton: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col justify-between p-4 rounded-lg border border-[#26262E] bg-[#15151A] shadow-md animate-pulse"
    >
      <div>
        {/* Top Header Placeholder */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-5 w-4/5 rounded bg-zinc-800/90" />
            <div className="h-3 w-1/2 rounded bg-zinc-800/50" />
          </div>
          <div className="w-7 h-7 rounded-md bg-zinc-800/60 shrink-0" />
        </div>

        {/* Status Pills Placeholder */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-24 rounded bg-zinc-800/60" />
          <div className="h-5 w-20 rounded bg-zinc-800/40" />
        </div>

        {/* Showcase Box Placeholder */}
        <div className="rounded-md border border-[#26262E] bg-[#111114] p-3 mb-3.5 space-y-3">
          <div className="space-y-1.5">
            <div className="h-5 w-3/5 rounded bg-amber-500/20" />
            <div className="h-3 w-4/5 rounded bg-zinc-800/60" />
          </div>

          {/* Metric Rows */}
          <div className="space-y-2 pt-2 border-t border-[#26262E]/80 text-[11px]">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 rounded bg-zinc-800/50" />
              <div className="h-3 w-12 rounded bg-zinc-800/70" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3 w-28 rounded bg-zinc-800/50" />
              <div className="h-3 w-16 rounded bg-zinc-800/70" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3 w-32 rounded bg-zinc-800/50" />
              <div className="h-3 w-20 rounded bg-zinc-800/70" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 rounded bg-zinc-800/50" />
              <div className="h-3 w-14 rounded bg-zinc-800/70" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Placeholder */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#26262E]">
        <div className="h-8 flex-1 rounded-md bg-zinc-800/60" />
        <div className="h-8 flex-1 rounded-md bg-amber-500/30" />
      </div>
    </div>
  );
};
