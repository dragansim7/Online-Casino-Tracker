/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { Home } from './pages/Home.tsx';
import { Directory } from './pages/Directory.tsx';

// Code-split heavy views to reduce initial bundle size and boost performance
const ListingDetail = lazy(() => import('./pages/ListingDetail.tsx').then(m => ({ default: m.ListingDetail })));
const Favourites = lazy(() => import('./pages/Favourites.tsx').then(m => ({ default: m.Favourites })));
const ResponsibleGambling = lazy(() => import('./pages/ResponsibleGambling.tsx').then(m => ({ default: m.ResponsibleGambling })));
const About = lazy(() => import('./pages/StaticPages.tsx').then(m => ({ default: m.About })));
const Contact = lazy(() => import('./pages/StaticPages.tsx').then(m => ({ default: m.Contact })));
const Privacy = lazy(() => import('./pages/StaticPages.tsx').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/StaticPages.tsx').then(m => ({ default: m.Terms })));
const Login = lazy(() => import('./pages/AuthPages.tsx').then(m => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('./pages/AuthPages.tsx').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/AuthPages.tsx').then(m => ({ default: m.ResetPassword })));
const Admin = lazy(() => import('./pages/Admin.tsx').then(m => ({ default: m.Admin })));

const RouteLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[350px]">
    <div className="w-6 h-6 border-2 border-[#FFB020] border-t-transparent rounded-full animate-spin"></div>
  </div>
);

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
          <Suspense fallback={<RouteLoadingFallback />}>
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
          </Suspense>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
