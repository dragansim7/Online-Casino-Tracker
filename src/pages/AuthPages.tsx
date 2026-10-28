/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth.ts';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const u = await login(email, password);
      if (u.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/directory');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-16 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FFB020]/10 border border-[#FFB020]/30 text-[#FFB020] mb-2">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-zinc-100 tracking-tight">
          Admin Portal Sign In
        </h1>
        <p className="text-xs text-zinc-400">
          Enter your authorized credentials to access the directory management console.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-md border border-[#26262E] bg-[#15151A] space-y-4 shadow-xl"
      >
        {error && (
          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 block">Administrator Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full pl-9 pr-3 py-2.5 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020] transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="font-medium text-zinc-300">Password</label>
            <Link to="/forgot-password" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-3 py-2.5 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020] transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-all disabled:opacity-50 mt-2 shadow-sm cursor-pointer"
        >
          {isLoading ? 'Verifying Credentials...' : 'Sign In to Console'}
        </button>
      </form>

      <div className="text-center text-xs text-zinc-500">
        <Link to="/directory" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Return to Public Directory
        </Link>
      </div>
    </div>
  );
};

export const ForgotPassword: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="max-w-md mx-auto py-16 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-zinc-100">Reset Password</h1>
        <p className="text-xs text-zinc-400">
          Enter your registered administrator email to receive recovery instructions.
        </p>
      </div>

      <div className="p-6 rounded-md border border-[#26262E] bg-[#15151A] space-y-4">
        {submitted ? (
          <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
            <div className="font-bold">Password recovery dispatched</div>
            <p>If an authorized administrator account exists for this address, a reset notification has been sent.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Email Address</label>
              <input
                type="email"
                required
                placeholder="admin@example.com"
                className="w-full px-3 py-2.5 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors"
            >
              Send Recovery Instructions
            </button>
          </form>
        )}
      </div>

      <div className="text-center text-xs text-zinc-500">
        <Link to="/login" className="text-[#FFB020] hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export const ResetPassword: React.FC = () => {
  return (
    <div className="max-w-md mx-auto py-16 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-zinc-100">Choose New Password</h1>
      </div>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="p-6 rounded-md border border-[#26262E] bg-[#15151A] space-y-4"
      >
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 block">New Password</label>
          <input
            type="password"
            required
            className="w-full px-3 py-2.5 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2.5 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors"
        >
          Update Password
        </button>
      </form>
    </div>
  );
};
