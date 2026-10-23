/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, Phone, Globe, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export const ResponsibleGambling: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4" />
          <span>Player Protection & Support</span>
        </div>
        <h1 className="text-3xl font-black text-zinc-100 tracking-tight">
          Responsible Gambling Policy & Resources
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Gambling should be considered strictly as paid entertainment, never as an investment or a method to resolve financial hardship. Only gamble what you can afford to lose.
        </p>
      </div>

      {/* Immediate Crisis Contacts */}
      <div className="p-5 rounded-md border border-amber-500/40 bg-[#15151A] space-y-4">
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <Phone className="w-4 h-4 text-amber-400" />
          Immediate 24/7 Confidential Help Services
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded border border-[#26262E] bg-[#111114] space-y-2">
            <div className="font-bold text-zinc-200 text-sm">National Gambling Helpline (Australia)</div>
            <div className="text-zinc-400">Free, confidential 24/7 telephone counselling and referral.</div>
            <div className="text-amber-400 font-mono text-sm font-bold">1800 858 858</div>
            <div className="text-zinc-500 text-[11px]">Online chat at gamblinghelponline.org.au</div>
          </div>

          <div className="p-4 rounded border border-[#26262E] bg-[#111114] space-y-2">
            <div className="font-bold text-zinc-200 text-sm">BetStop — National Self-Exclusion</div>
            <div className="text-zinc-400">Australia's free government register to exclude from all licensed wagering operators.</div>
            <div className="text-zinc-300 font-mono text-sm">betstop.gov.au</div>
            <div className="text-zinc-500 text-[11px]">Exclusion periods from 3 months to permanent.</div>
          </div>
        </div>
      </div>

      {/* Warning Signs (Section 12) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-zinc-100">Recognizing Warning Signs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-300">
          <div className="p-3.5 rounded border border-[#26262E] bg-[#111114] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Chasing losses by depositing more money after an unprofitable session.</span>
          </div>
          <div className="p-3.5 rounded border border-[#26262E] bg-[#111114] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Gambling with money designated for essentials (rent, bills, groceries).</span>
          </div>
          <div className="p-3.5 rounded border border-[#26262E] bg-[#111114] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Borrowing money, selling assets, or concealing play from loved ones.</span>
          </div>
          <div className="p-3.5 rounded border border-[#26262E] bg-[#111114] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Experiencing anxiety, distress, or sleep disruption linked to gambling activity.</span>
          </div>
        </div>
      </section>

      {/* Practical Limit Tools */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-zinc-100">Self-Protection & Limit Tools</h2>
        <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
          <p>
            Reputable operators provide player account controls. We recommend configuring these prior to placing any wagers:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li><strong>Deposit Limits:</strong> Set hard daily, weekly, or monthly deposit ceilings.</li>
            <li><strong>Session Timeouts:</strong> Enforce automated logouts after a set duration.</li>
            <li><strong>Cool-Off Periods:</strong> Temporarily lock your account for 24 hours to 30 days.</li>
            <li><strong>Permanent Self-Exclusion:</strong> Completely revoke account access.</li>
          </ul>
        </div>
      </section>

      {/* Legal Age & Jurisdiction Statement */}
      <section className="p-4 rounded-md border border-[#26262E] bg-[#111114] text-xs text-zinc-400 space-y-2">
        <h3 className="font-bold text-zinc-200">Legal Age & Jurisdiction</h3>
        <p>
          Online gambling is strictly restricted to persons aged 18 and older (or legal majority in your territory). Participation by minors is illegal. It is the player's sole obligation to verify whether remote gambling is legal within their sovereign state or territory before accessing any external destination.
        </p>
      </section>
    </div>
  );
};
