import React, { useState } from 'react';
import { Code2, ArrowRight, Sparkles, Terminal, Cpu, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const PRESET_COLORS = [
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#ec4899', name: 'Rose' },
  { hex: '#a855f7', name: 'Violet' },
  { hex: '#06b6d4', name: 'Cyan' },
];

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);

  const previewName = name.trim() || 'Developer';
  const previewInitials = previewName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const user: UserProfile = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      name: trimmed,
      color: selectedColor,
    };
    onLogin(user);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-obsidian-glow bg-grid-pattern p-4 text-slate-200 select-none overflow-hidden">
      {/* Ambient Top Spotlight */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[600px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[120px]" />

      {/* Floating Product Pill */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-[#141824]/90 px-3.5 py-1.5 text-xs font-medium text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.2)] backdrop-blur-md">
        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
        <span>✨ Real-Time Collaborative Cloud IDE & AI Debugger</span>
      </div>

      {/* Main Glassmorphic Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f121d]/90 p-7 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        {/* Subtle Top Edge Highlight */}
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] ring-1 ring-white/20">
            <Code2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Nexathon<span className="text-indigo-400">IDE</span>
            </h1>
            <p className="text-xs text-slate-400">
              Multi-File Yjs CRDTs • Pyodide & QuickJS • AI Diff Review
            </p>
          </div>
        </div>

        {/* Live Collaborator Presence Preview Box */}
        <div className="mb-6 rounded-xl border border-white/10 bg-[#141824]/90 p-3.5 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Live Presence Preview
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Ready to collaborate
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#090a0f]/80 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-md transition-colors duration-200"
                style={{
                  backgroundColor: selectedColor,
                  boxShadow: `0 0 12px ${selectedColor}66`,
                }}
              >
                {previewInitials}
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{previewName}</div>
                <div className="text-[10px] font-mono text-slate-400">
                  src/main.py • Ln 14, Col 8
                </div>
              </div>
            </div>

            {/* Simulated Monaco Yjs Cursor Flag */}
            <div className="flex items-center">
              <div
                className="h-5 w-0.5"
                style={{ backgroundColor: selectedColor }}
              />
              <span
                className="rounded-r px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs transition-colors duration-200"
                style={{ backgroundColor: selectedColor }}
              >
                {previewName}
              </span>
            </div>
          </div>
        </div>

        {/* Sign-In Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Developer Handle
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-[#141824] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Cursor & Awareness Color
            </label>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#141824]/60 p-2">
              {PRESET_COLORS.map((c) => {
                const isSelected = selectedColor === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    title={c.name}
                    className={`group relative flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 ${
                      isSelected
                        ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0f121d]'
                        : 'opacity-70 hover:scale-105 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: isSelected ? `0 0 14px ${c.hex}` : undefined,
                    }}
                    aria-label={`Select cursor color ${c.name}`}
                  />
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_0_25px_rgba(99,102,241,0.55)] cursor-pointer"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        {/* Footer Feature Pills */}
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
            WASM Sandbox
          </span>
          <span className="inline-flex items-center gap-1">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            Cloud Node-PTY
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
            AI Diff Guard
          </span>
        </div>
      </div>
    </div>
  );
};
