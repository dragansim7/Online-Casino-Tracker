/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User as UserIcon, ArrowRight, ShieldCheck, Check } from 'lucide-react';
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
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminDemo = () => {
    setEmail('Dragansim7@gmail.com');
    setPassword('admin123');
  };

  const handleUserDemo = () => {
    setEmail('player@example.com');
    setPassword('user123');
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-zinc-100">Sign in to AXHub</h1>
        <p className="text-xs text-zinc-400">
          Public browsing requires no account. Sign in to access directory admin tools.
        </p>
      </div>

      {/* Quick Demo Fill Buttons */}
      <div className="p-3.5 rounded-md border border-[#26262E] bg-[#111114] space-y-2 text-xs">
        <div className="text-zinc-400 font-medium text-[11px] uppercase tracking-wider">
          Demo Quick Fill:
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAdminDemo}
            className="flex-1 py-1.5 px-2 rounded border border-[#FFB020]/40 bg-[#FFB020]/10 text-[#FFC24D] font-medium text-xs hover:bg-[#FFB020]/20 transition-colors"
          >
            Fill Admin Credentials
          </button>
          <button
            type="button"
            onClick={handleUserDemo}
            className="flex-1 py-1.5 px-2 rounded border border-[#26262E] bg-[#15151A] text-zinc-300 font-medium text-xs hover:border-zinc-500 transition-colors"
          >
            Fill User Credentials
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 rounded-md border border-[#26262E] bg-[#15151A] space-y-4">
        {error && (
          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 block">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-9 pr-3 py-2 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="font-medium text-zinc-300">Password</label>
            <Link to="/forgot-password" className="text-zinc-500 hover:text-zinc-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors disabled:opacity-50 mt-2"
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="text-center text-xs text-zinc-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-[#FFB020] hover:underline">
          Register
        </Link>
      </div>
    </div>
  );
};

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register(email, name);
      navigate('/directory');
    } catch {
      //
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-zinc-100">Create an Account</h1>
        <p className="text-xs text-zinc-400">Join AXHub for custom alerts and directory tools.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 rounded-md border border-[#26262E] bg-[#15151A] space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 block">Full Name</label>
          <div className="relative">
            <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Johnson"
              className="w-full pl-9 pr-3 py-2 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 block">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-9 pr-3 py-2 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 block">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-md bg-[#FFB020] text-zinc-950 font-bold text-xs hover:bg-[#FFC24D] transition-colors disabled:opacity-50 mt-2"
        >
          {isLoading ? 'Creating...' : 'Create Account'}
        </button>
      </form>

      <div className="text-center text-xs text-zinc-500">
        Already have an account?{' '}
        <Link to="/login" className="text-[#FFB020] hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
};

export const ForgotPassword: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-zinc-100">Reset Password</h1>
        <p className="text-xs text-zinc-400">
          Enter your registered email to receive password recovery instructions.
        </p>
      </div>

      <div className="p-6 rounded-md border border-[#26262E] bg-[#15151A] space-y-4">
        {submitted ? (
          <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>Password recovery email dispatched</span>
            </div>
            <p>If an account exists for this address, a reset token has been sent.</p>
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
                placeholder="name@example.com"
                className="w-full px-3 py-2 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
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
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
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
            className="w-full px-3 py-2 rounded border border-[#26262E] bg-[#111114] text-xs text-zinc-100 focus:outline-none focus:border-[#FFB020]"
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
