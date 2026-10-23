/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Gift } from 'lucide-react';
import { TechnicalStatus, VerificationStatus } from '../types/index.ts';

interface StatusPillProps {
  technicalStatus?: TechnicalStatus;
  verificationStatus?: VerificationStatus;
  bonusCount?: number;
  showExplanationTooltip?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  technicalStatus,
  verificationStatus,
  bonusCount,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
      {/* Availability Dot & Status */}
      {technicalStatus && (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#26262E] bg-[#111114] text-zinc-300"
          title={
            technicalStatus === 'unknown'
              ? 'No check has been recorded for this domain yet'
              : `Domain response: ${technicalStatus}`
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              technicalStatus === 'online'
                ? 'bg-emerald-400'
                : technicalStatus === 'offline'
                ? 'bg-rose-500'
                : technicalStatus === 'checking'
                ? 'bg-amber-400'
                : 'bg-zinc-500'
            }`}
          />
          <span className="capitalize">{technicalStatus}</span>
        </span>
      )}

      {/* Verification Pill */}
      {verificationStatus && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded border ${
            verificationStatus === 'verified'
              ? 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300'
              : verificationStatus === 'review_required'
              ? 'border-amber-800/50 bg-amber-950/30 text-amber-300'
              : 'border-[#26262E] bg-[#111114] text-zinc-400'
          }`}
          title={
            verificationStatus === 'unverified'
              ? 'This record has not been through the directory review process.'
              : `Directory verification: ${verificationStatus}`
          }
        >
          {verificationStatus === 'verified'
            ? 'Verified'
            : verificationStatus === 'review_required'
            ? 'Review req.'
            : 'Unverified'}
        </span>
      )}

      {/* Gold Bonus Count Pill (when bonusCount > 0) */}
      {bonusCount !== undefined && bonusCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#FFB020]/40 bg-[#FFB020]/10 text-[#FFC24D] font-semibold">
          <Gift className="w-3 h-3 text-[#FFB020]" />
          <span>
            {bonusCount} {bonusCount === 1 ? 'bonus' : 'bonuses'}
          </span>
        </span>
      )}
    </div>
  );
};
