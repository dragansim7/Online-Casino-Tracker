/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react';
import { Bonus } from '../types/index.ts';

interface BonusCardProps {
  bonus: Bonus;
}

export const BonusCard: React.FC<BonusCardProps> = ({ bonus }) => {
  const [showTerms, setShowTerms] = useState(false);

  // Headline: amount_label as the headline (absent -> "Amount not published as a figure")
  const headline = bonus.amount_label || 'Amount not published as a figure';

  return (
    <div className="p-4 rounded-md border border-[#26262E] bg-[#15151A] hover:border-[#FFB020]/40 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          {/* Headline Amount */}
          <div className="text-lg font-bold text-[#FFC24D] tracking-tight">
            {headline}
          </div>
          {/* Promo Name */}
          <h4 className="text-sm font-medium text-zinc-100 mt-0.5">{bonus.name}</h4>
        </div>

        {bonus.is_new && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFB020]/20 text-[#FFC24D] border border-[#FFB020]/40 shrink-0">
            <Sparkles className="w-2.5 h-2.5" />
            NEW
          </span>
        )}
      </div>

      {/* Render ONLY the fields present (Section 8) */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-300 py-3 border-y border-[#26262E]/70 my-3">
        {bonus.rollover !== null && bonus.rollover !== undefined && (
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <dt className="text-zinc-500">Turnover / wager</dt>
            <dd className="font-semibold text-zinc-200">{bonus.rollover}×</dd>
          </div>
        )}

        {bonus.min_unlock !== null && bonus.min_unlock !== undefined && (
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <dt className="text-zinc-500">Minimum to unlock</dt>
            <dd className="font-mono text-zinc-200">AUD {bonus.min_unlock}</dd>
          </div>
        )}

        {bonus.max_withdraw !== null && bonus.max_withdraw !== undefined && (
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <dt className="text-zinc-500">Maximum withdrawal</dt>
            <dd className="font-mono text-zinc-200">AUD {bonus.max_withdraw}</dd>
          </div>
        )}

        {bonus.min_deposit !== null && bonus.min_deposit !== undefined && (
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <dt className="text-zinc-500">Minimum deposit</dt>
            <dd className="font-mono text-zinc-200">AUD {bonus.min_deposit}</dd>
          </div>
        )}

        {bonus.reset_period && (
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <dt className="text-zinc-500">Resets</dt>
            <dd className="capitalize text-zinc-200">{bonus.reset_period.toLowerCase()}</dd>
          </div>
        )}

        {bonus.claim_condition && (
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <dt className="text-zinc-500">Claim condition</dt>
            <dd className="capitalize text-zinc-200">{bonus.claim_condition.toLowerCase()}</dd>
          </div>
        )}

        {bonus.providers_allowed && (
          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:gap-2 pt-1 border-t border-[#26262E]/40">
            <dt className="text-zinc-500 shrink-0">Allowed games / providers:</dt>
            <dd className="text-zinc-300 truncate">{bonus.providers_allowed}</dd>
          </div>
        )}
      </dl>

      {/* Collapsed Operator Terms block preserving line breaks and ✦ separators VERBATIM (Section 8) */}
      {bonus.terms_text && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowTerms(!showTerms)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors py-1 focus:outline-none"
            aria-expanded={showTerms}
          >
            <span>Operator's terms</span>
            {showTerms ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>

          {showTerms && (
            <div className="mt-2 p-3 rounded bg-[#111114] border border-[#26262E] text-xs text-zinc-300 font-mono whitespace-pre-line leading-relaxed selection:bg-[#FFB020]/30">
              {bonus.terms_text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
