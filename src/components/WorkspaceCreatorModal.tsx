import React, { useState } from 'react';
import {
  X,
  Check,
  Cpu,
  Layers,
  Terminal,
  Sparkles,
  Sliders,
  Globe,
  Lock,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { ElasticSlider } from './react-bits/inputs/ElasticSlider';
import { SpotlightCard } from './react-bits/cards/SpotlightCard';

interface WorkspaceCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roomData: {
    name: string;
    description: string;
    runtime: string;
    memoryMb: number;
    threads: number;
    isPrivate: boolean;
  }) => Promise<void>;
}

const RUNTIMES = [
  {
    id: 'python-wasm',
    name: 'Python (Pyodide WASM)',
    desc: 'In-browser NumPy, SciPy & Pandas with zero server cost and 0ms latency.',
    badge: 'Pyodide 0.26',
    icon: Cpu,
    accent: 'text-amber-500',
  },
  {
    id: 'quickjs-worker',
    name: 'JavaScript / TypeScript (QuickJS)',
    desc: 'High-speed sandboxed ES2023 execution worker with memory boundaries.',
    badge: 'QuickJS Engine',
    icon: Layers,
    accent: 'text-yellow-500',
  },
  {
    id: 'node-pty',
    name: 'Fullstack Cloud Terminal (Node-PTY)',
    desc: 'Interactive POSIX shell daemon streaming over full-duplex WebSockets.',
    badge: 'Node-PTY POSIX',
    icon: Terminal,
    accent: 'text-[#FF7057]',
  },
];

export const WorkspaceCreatorModal: React.FC<WorkspaceCreatorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRuntime, setSelectedRuntime] = useState(RUNTIMES[0].id);
  const [memoryMb, setMemoryMb] = useState(1024);
  const [threads, setThreads] = useState(4);
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = roomName.trim() || `${RUNTIMES.find(r => r.id === selectedRuntime)?.name || 'Custom'} Sandbox`;
    const finalDesc = roomDesc.trim() || `Allocated ${memoryMb}MB WASM heap with ${threads} WebWorker threads.`;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: finalTitle,
        description: finalDesc,
        runtime: selectedRuntime,
        memoryMb,
        threads,
        isPrivate,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none">
      <SpotlightCard
        spotlightColor="rgba(255, 112, 87, 0.15)"
        className="w-full max-w-xl rounded-2xl border theme-border theme-bg-surface-1 p-6 neu-card relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b theme-border pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF7057] text-white neu-button">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold theme-text-primary">
                Multi-Step Workspace Provisioner
              </h3>
              <p className="text-[11px] theme-text-secondary">
                Configure your execution runtime, WASM heap, and Yjs CRDT peer mesh.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper Navigation Strip */}
        <div className="flex items-center justify-between mb-6 px-1">
          {[
            { num: 1, title: 'Runtime' },
            { num: 2, title: 'WASM Heap' },
            { num: 3, title: 'CRDT Mesh' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono font-bold transition-colors ${
                  step === item.num
                    ? 'bg-[#FF7057] text-white neu-button'
                    : step > item.num
                    ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                    : 'theme-bg-surface-2 theme-text-secondary border theme-border'
                }`}
              >
                {step > item.num ? <Check className="h-3 w-3" /> : item.num}
              </div>
              <span
                className={`text-xs font-medium ${
                  step === item.num ? 'theme-text-primary font-semibold' : 'theme-text-secondary'
                }`}
              >
                {item.title}
              </span>
              {idx < 2 && <div className="h-px w-8 sm:w-16 theme-border mx-1" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <form onSubmit={(e) => void handleFinalSubmit(e)}>
          {/* STEP 1: Environment Selection */}
          {step === 1 && (
            <div className="space-y-3 min-h-[260px]">
              <span className="text-xs font-semibold theme-text-primary block mb-1">
                Choose Base Execution Engine
              </span>
              {RUNTIMES.map((rt) => {
                const Icon = rt.icon;
                const isSelected = selectedRuntime === rt.id;
                return (
                  <div
                    key={rt.id}
                    onClick={() => setSelectedRuntime(rt.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 transition cursor-pointer ${
                      isSelected
                        ? 'border-[#FF7057] bg-[#FF7057]/10'
                        : 'theme-border theme-bg-surface-2 hover:theme-bg-surface-1'
                    }`}
                  >
                    <div className={`mt-0.5 rounded-lg p-2 theme-bg-surface-1 border theme-border ${rt.accent}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold theme-text-primary">{rt.name}</span>
                        <span className="rounded font-mono text-[10px] bg-[#FF7057]/15 border border-[#FF7057]/20 px-1.5 py-0.2 text-[#FF7057]">
                          {rt.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] theme-text-secondary leading-relaxed">{rt.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 2: Resource Allocation with ElasticSlider */}
          {step === 2 && (
            <div className="space-y-6 min-h-[260px] py-2">
              <div className="rounded-xl border theme-border theme-bg-surface-2 p-3.5 space-y-1">
                <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-[#FF7057]" />
                  Tactile Elastic Resource Allocation
                </span>
                <p className="text-[11px] theme-text-secondary">
                  Drag the sliders to allocate dedicated browser WebWorker threads and virtual memory heaps.
                </p>
              </div>

              <ElasticSlider
                label="Virtual Browser Memory Heap"
                value={memoryMb}
                min={256}
                max={2048}
                step={256}
                suffix="MB"
                onChange={setMemoryMb}
              />

              <ElasticSlider
                label="Worker Thread Concurrency"
                value={threads}
                min={1}
                max={8}
                step={1}
                suffix="Threads"
                onChange={setThreads}
              />

              <div className="flex justify-between items-center text-[11px] font-mono theme-text-secondary pt-2">
                <span>Execution Sandbox: Isolated Worker</span>
                <span className="text-emerald-500 font-semibold">Cold Start: &lt;4ms</span>
              </div>
            </div>
          )}

          {/* STEP 3: Room Identity & Yjs Mesh Mode */}
          {step === 3 && (
            <div className="space-y-4 min-h-[260px]">
              <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                  Workspace Title
                </label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Distributed Consensus Lab"
                  className="w-full rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 text-xs theme-text-primary placeholder:text-muted focus:border-[#FF7057] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                  Description <span className="theme-text-muted">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  placeholder="Multiplayer CRDT algorithm with zero conflict state vectors"
                  className="w-full rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 text-xs theme-text-primary placeholder:text-muted focus:border-[#FF7057] focus:outline-none"
                />
              </div>

              {/* Private / Public Toggle */}
              <div
                onClick={() => setIsPrivate((p) => !p)}
                className="flex items-center justify-between rounded-xl border theme-border theme-bg-surface-2 p-3 cursor-pointer hover:border-[#FF7057]/40 transition"
              >
                <div className="flex items-center gap-2.5">
                  {isPrivate ? (
                    <Lock className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Globe className="h-4 w-4 text-emerald-500" />
                  )}
                  <div>
                    <div className="text-xs font-bold theme-text-primary">
                      {isPrivate ? 'Private Room Mesh' : 'Public Discovery Mesh'}
                    </div>
                    <div className="text-[10px] theme-text-secondary">
                      {isPrivate
                        ? 'Only teammates with the direct invite token can join.'
                        : 'Discoverable in the executive workspace directory.'}
                    </div>
                  </div>
                </div>
                <div
                  className={`h-5 w-9 rounded-full transition-colors relative p-0.5 ${
                    isPrivate ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition-transform ${
                      isPrivate ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between border-t theme-border pt-4 mt-5">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-2 px-3.5 py-1.5 text-xs font-medium theme-text-secondary hover:theme-text-primary transition cursor-pointer neu-button"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF7057] hover:bg-[#F26049] px-4 py-1.5 text-xs font-semibold text-white transition cursor-pointer neu-button"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF7057] hover:bg-[#F26049] px-5 py-1.5 text-xs font-semibold text-white transition cursor-pointer neu-button disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Launch Cloud IDE →</span>
              </button>
            )}
          </div>
        </form>
      </SpotlightCard>
    </div>
  );
};

export default WorkspaceCreatorModal;

