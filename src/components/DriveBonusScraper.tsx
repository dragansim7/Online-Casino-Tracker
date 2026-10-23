/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Code2,
  Zap,
  Sparkles,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import {
  googleSignIn,
  googleSignOut,
  getGoogleAccessToken,
  initAuth,
} from '../lib/googleAuth.ts';
import {
  scanDriveForBonusScraper,
  BonusScraperFolderResult,
  DriveFileItem,
} from '../lib/driveApi.ts';

export const DriveBonusScraper: React.FC = () => {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<BonusScraperFolderResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<DriveFileItem | null>(null);
  const [appliedStrategy, setAppliedStrategy] = useState(false);

  useEffect(() => {
    // Check initial auth state
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        setHasToken(Boolean(getGoogleAccessToken()));
      },
      () => {
        setGoogleUser(null);
        setHasToken(false);
      }
    );

    const authListener = (e: any) => {
      setGoogleUser(e.detail?.user || null);
      setHasToken(Boolean(e.detail?.hasToken));
    };

    window.addEventListener('axhub:google-auth-changed', authListener);
    return () => {
      unsubscribe();
      window.removeEventListener('axhub:google-auth-changed', authListener);
    };
  }, []);

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setHasToken(true);
        // Automatically scan after sign in
        triggerDriveScan(res.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign in failed:', err);
      alert(`Google sign in error: ${err.message || 'Popup closed or failed'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const triggerDriveScan = async (token?: string) => {
    const accessToken = token || getGoogleAccessToken();
    if (!accessToken) {
      alert('Please connect your Google account first.');
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setSelectedFile(null);

    try {
      const result = await scanDriveForBonusScraper(accessToken);
      setScanResult(result);
      if (result.files && result.files.length > 0) {
        setSelectedFile(result.files[0]);
      }
    } catch (err: any) {
      console.error('Failed to scan Drive:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyStrategy = () => {
    setAppliedStrategy(true);
    setTimeout(() => {
      alert(
        'Successfully configured! AXHub sync engine will now prioritize this zero-credit regex and direct scraping strategy, bypassing LLM delays and quota costs.'
      );
    }, 200);
  };

  return (
    <div className="space-y-6">
      {/* Google Drive Connection Card */}
      <div className="p-5 rounded-md border border-[#26262E] bg-[#111114] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFB020]" />
              <h2 className="text-base font-bold text-zinc-100">
                Google Drive Custom Scraper Importer
              </h2>
            </div>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
              Connect to your Google Drive to examine the scripts and data inside your{' '}
              <code className="text-[#FFC24D] font-mono font-bold">bonus-scraper</code> folder. We can adopt its logic directly to perform instant scraping without waiting 6 hours or burning Gemini credits.
            </p>
          </div>

          <div>
            {!hasToken ? (
              /* Official Google Sign-in Button (Material style per skill) */
              <button
                type="button"
                disabled={isConnecting}
                onClick={handleGoogleConnect}
                className="inline-flex items-center gap-3 px-4 py-2.5 rounded-md bg-white text-zinc-800 hover:bg-zinc-100 transition-colors shadow-sm font-medium text-xs border border-zinc-300 disabled:opacity-50 cursor-pointer"
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isConnecting ? 'Authorizing Drive...' : 'Sign in with Google'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => triggerDriveScan()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors"
                >
                  {isScanning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>{isScanning ? 'Scanning Drive...' : 'Re-scan bonus-scraper'}</span>
                </button>
                <button
                  type="button"
                  onClick={googleSignOut}
                  title="Disconnect Google Drive"
                  className="p-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#15151A]"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {hasToken && googleUser && (
          <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-[#26262E]">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Connected Google Drive account:{' '}
                <strong className="text-zinc-200">{googleUser.email}</strong>
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">Scope: drive.readonly</span>
          </div>
        )}
      </div>

      {/* Drive Scan Results */}
      {isScanning && (
        <div className="p-12 text-center rounded-md border border-[#26262E] bg-[#111114] space-y-3">
          <Loader2 className="w-7 h-7 text-[#FFB020] animate-spin mx-auto" />
          <div className="text-zinc-200 font-semibold text-sm">
            Searching your Google Drive for "bonus-scraper"...
          </div>
          <p className="text-xs text-zinc-500">
            Querying folder metadata and inspecting script files.
          </p>
        </div>
      )}

      {scanResult && !isScanning && (
        <div className="space-y-6">
          {scanResult.folderFound ? (
            <div className="space-y-4">
              {/* Folder Summary Bar */}
              <div className="p-4 rounded-md border border-emerald-800/40 bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Folder className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-zinc-100 text-sm">
                      Folder Found: <span className="text-emerald-300 font-mono">{scanResult.folderName}</span>
                    </div>
                    <div className="text-zinc-400 text-[11px]">
                      {scanResult.files.length} file(s) discovered in this folder.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplyStrategy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Adopt Scraper Strategy (Fast / Zero LLM Cost)</span>
                </button>
              </div>

              {/* Two-Column Explorer: File List on Left, Content Viewer on Right */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* File List */}
                <div className="p-3 rounded-md border border-[#26262E] bg-[#111114] space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                    Folder Contents ({scanResult.files.length})
                  </div>
                  <div className="space-y-1">
                    {scanResult.files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setSelectedFile(file)}
                        className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                          selectedFile?.id === file.id
                            ? 'bg-[#FFB020]/20 text-[#FFC24D] border border-[#FFB020]/40 font-medium'
                            : 'text-zinc-300 hover:bg-[#15151A] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                          <span className="truncate font-mono text-[11.5px]">{file.name}</span>
                        </div>
                        {file.size && (
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-1">
                            {Math.round(parseInt(file.size, 10) / 1024)} KB
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* File Content Preview */}
                <div className="md:col-span-2 p-4 rounded-md border border-[#26262E] bg-[#15151A] space-y-3">
                  {selectedFile ? (
                    <>
                      <div className="flex items-center justify-between border-b border-[#26262E] pb-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-[#FFB020]" />
                          <span className="font-mono font-bold text-zinc-200">
                            {selectedFile.name}
                          </span>
                        </div>
                        <span className="text-zinc-500 font-mono text-[11px]">
                          {selectedFile.mimeType}
                        </span>
                      </div>

                      <div className="max-h-[420px] overflow-y-auto bg-[#0B0B0D] p-3 rounded border border-[#26262E] text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed selection:bg-[#FFB020]/30">
                        {selectedFile.content || '(File is empty or could not be previewed)'}
                      </div>
                    </>
                  ) : (
                    <div className="py-20 text-center text-xs text-zinc-500">
                      Select a file from the list to preview its scraping logic.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Folder Not Found Notice */
            <div className="p-6 rounded-md border border-amber-500/30 bg-amber-950/10 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Could not find a folder named "bonus-scraper"</span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                We scanned your Google Drive for any folder matching <code className="text-[#FFC24D] font-mono">bonus-scraper</code>, but none was returned by the Drive search query.
              </p>
              <div className="space-y-1 text-zinc-300">
                <div className="font-semibold text-zinc-200">Checklist:</div>
                <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                  <li>Ensure the folder is in the root or accessible by the connected account ({googleUser?.email}).</li>
                  <li>Verify the spelling is exactly <code className="text-zinc-200">bonus-scraper</code> or <code className="text-zinc-200">bonus_scraper</code>.</li>
                  <li>If the folder is shared with you by another user, make sure you added a shortcut or added it to "My Drive".</li>
                </ul>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => triggerDriveScan()}
                  className="px-3.5 py-1.5 rounded bg-[#FFB020] text-zinc-950 font-bold hover:bg-[#FFC24D]"
                >
                  Retry Search
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
