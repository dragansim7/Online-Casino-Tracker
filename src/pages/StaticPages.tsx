/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Info, Mail, FileText, CheckCircle2 } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6 text-zinc-300 text-xs leading-relaxed">
      <div>
        <h1 className="text-3xl font-black text-zinc-100 tracking-tight mb-2">About AXHub</h1>
        <p className="text-sm text-zinc-400">
          Independent domain index and algorithmic bonus classifier.
        </p>
      </div>

      <div className="p-4 rounded-md border border-[#26262E] bg-[#111114] space-y-2">
        <h2 className="font-bold text-zinc-100 text-sm">Mission & Neutrality</h2>
        <p>
          AXHub was engineered to address a pervasive issue in the iGaming landscape: commercial bias and distorted bonus representations. Traditional affiliate aggregators rank casinos based on commercial commission bids rather than mathematical reality.
        </p>
        <p>
          AXHub maintains a strict 5-category taxonomy. Promotional claims are ingested, stripped of marketing spin, and parsed into verifiable metrics: raw amount, actual turnover multiplier, minimum unlock threshold, and withdrawal ceiling.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="font-bold text-zinc-100 text-sm">Strict Independence</h2>
        <p>
          We do not operate casino games, process bets, or hold player deposits. Technical availability simply confirms that a domain answered an automated HTTP scan; it is not a certification of safety or licensing standing.
        </p>
      </div>
    </div>
  );
};

export const Contact: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 text-xs text-zinc-300">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight">Contact Directory Administrators</h1>
      <p className="text-zinc-400">
        For domain dispute notices, technical status rectifications, or feed endpoint submissions.
      </p>

      <div className="p-5 rounded-md border border-[#26262E] bg-[#111114] space-y-3">
        <div className="flex items-center gap-2 text-zinc-200 font-semibold">
          <Mail className="w-4 h-4 text-[#FFB020]" />
          <span>Editorial & Ingestion Desk</span>
        </div>
        <p className="font-mono text-zinc-300 text-sm">admin@axhub.com</p>
        <p className="text-zinc-500 text-[11.5px]">
          Inquiries regarding feed updates or inaccurate bonus rules are processed within 48 business hours.
        </p>
      </div>
    </div>
  );
};

export const Privacy: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 text-xs text-zinc-300 leading-relaxed">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight">Privacy Policy</h1>
      <p className="text-zinc-400">Effective Date: October 2026</p>

      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-100">1. Data Collection & Local Favourites</h2>
        <p>
          AXHub is designed to be privacy-first. Public browsing does not require registration. Bookmark favourites are stored entirely on your local device via the Web Storage API (<code className="font-mono text-[#FFC24D]">localStorage</code>).
        </p>

        <h2 className="text-sm font-bold text-zinc-100">2. Outbound Links</h2>
        <p>
          Clicking "Visit site" routes you directly to external third-party casino domains. AXHub has no control over external tracking scripts, cookies, or privacy practices maintained by those operators.
        </p>

        <h2 className="text-sm font-bold text-zinc-100">3. Analytics & Telemetry</h2>
        <p>
          We do not run invasive user fingerprinting or commercial advertising trackers. Anonymous aggregate counters track listing engagement to calculate popularity rankings.
        </p>
      </div>
    </div>
  );
};

export const Terms: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 text-xs text-zinc-300 leading-relaxed">
      <h1 className="text-3xl font-black text-zinc-100 tracking-tight">Terms of Use</h1>
      <p className="text-zinc-400">Effective Date: October 2026</p>

      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-100">1. Nature of the Service</h2>
        <p>
          AXHub provides an informational index of web domains and promotional terms. We are not a gambling service, gambling operator, bookmaker, or payment facilitator.
        </p>

        <h2 className="text-sm font-bold text-zinc-100">2. No Warranty on Operator Terms</h2>
        <p>
          Bonus offers change at the sole discretion of operators. While our crawl engine parses terms from public feeds, users must read the official operator terms on the target domain prior to wagering.
        </p>

        <h2 className="text-sm font-bold text-zinc-100">3. Age & Jurisdiction Compliance</h2>
        <p>
          Access to AXHub is intended exclusively for individuals aged 18 or older in jurisdictions where remote gaming directory browsing is lawful.
        </p>
      </div>
    </div>
  );
};
