/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { Home } from './pages/Home.tsx';
import { Directory } from './pages/Directory.tsx';
import { ListingDetail } from './pages/ListingDetail.tsx';
import { Favourites } from './pages/Favourites.tsx';
import { ResponsibleGambling } from './pages/ResponsibleGambling.tsx';
import { About, Contact, Privacy, Terms } from './pages/StaticPages.tsx';
import { Login, ForgotPassword, ResetPassword } from './pages/AuthPages.tsx';
import { Admin } from './pages/Admin.tsx';

export default function App() {
  // Inject structured JSON-LD data for SEO
  useEffect(() => {
    const scriptId = 'axhub-structured-data';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'AXHub',
        applicationCategory: 'DirectoryApplication',
        operatingSystem: 'All',
        description:
          'Independent, searchable directory of casino websites and domains, with a structured bonus-comparison engine and filter-aware sorting.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'AUD',
        },
      });
      document.head.appendChild(script);
    }
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#0B0B0D] text-zinc-100 font-sans antialiased selection:bg-[#FFB020] selection:text-zinc-950">
        <Navbar />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/favourites" element={<Favourites />} />
            <Route path="/responsible-gambling" element={<ResponsibleGambling />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
