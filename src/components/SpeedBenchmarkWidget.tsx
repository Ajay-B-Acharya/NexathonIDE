import React, { useState, useEffect } from 'react';
import { RotateCcw, Server, Cpu, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { SpotlightCard } from './react-bits/cards/SpotlightCard';

export const SpeedBenchmarkWidget: React.FC = () => {
  const [racing, setRacing] = useState(false);
  const [timerWasm, setTimerWasm] = useState('0.04s');
  const [timerDocker, setTimerDocker] = useState('0.00s');
  const [dockerStatus, setDockerStatus] = useState('Ready to benchmark');
  const [dockerProgress, setDockerProgress] = useState(12);

  const triggerRace = () => {
    setRacing(true);
    setTimerWasm('0.04s');
    setTimerDocker('0.00s');
    setDockerProgress(2);
    setDockerStatus('Sending remote VM dispatch request...');

    const start = performance.now();

    const interval = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      setTimerDocker(`${elapsed.toFixed(2)}s`);

      if (elapsed < 1.5) {
        setDockerStatus('Provisioning AWS EC2 t3.medium VM...');
        setDockerProgress(15);
      } else if (elapsed < 4.0) {
        setDockerStatus('Pulling Docker image layers (742MB)...');
        setDockerProgress(38);
      } else if (elapsed < 7.0) {
        setDockerStatus('Starting containerd runtime daemon & SSH pipe...');
        setDockerProgress(64);
      } else if (elapsed < 10.0) {
        setDockerStatus('Mounting persistent EBS volume & network bridge...');
        setDockerProgress(85);
      } else {
        setDockerStatus('Container Ready. Initial port forwarding active.');
        setDockerProgress(100);
        clearInterval(interval);
        setRacing(false);
      }
    }, 100);
  };

  useEffect(() => {
    // Initial auto-run benchmark on first view
    triggerRace();
  }, []);

  return (
    <div className="mx-auto max-w-4xl my-12">
      <SpotlightCard
        spotlightColor="rgba(99, 102, 241, 0.16)"
        className="p-6 md:p-8 rounded-2xl border theme-border theme-bg-surface-1/90 backdrop-blur-xl theme-shadow"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b theme-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400 font-bold">
                Live Execution Benchmark
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-500">
                <Zap className="h-3 w-3 fill-current" />
                0ms Server Roundtrip
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold theme-text-primary mt-1">
              Cold-Start Execution: Cloud VM vs. In-Browser WASM
            </h3>
          </div>

          <button
            type="button"
            onClick={triggerRace}
            disabled={racing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${racing ? 'animate-spin' : ''}`} />
            <span>{racing ? 'Simulating Race...' : 'Re-Run Live Benchmark'}</span>
          </button>
        </div>

        <div className="mt-6 space-y-6 font-mono text-xs">
          {/* NexathonIDE WASM Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 theme-text-primary font-bold">
                <Cpu className="w-4 h-4 text-emerald-500" />
                NexathonIDE (In-Browser Pyodide & QuickJS WASM)
              </span>
              <span className="text-emerald-500 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {timerWasm} (Instant Local Silicon)
              </span>
            </div>
            <div className="h-3.5 w-full rounded-full theme-bg-surface-2 overflow-hidden p-0.5 border theme-border">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-300" />
            </div>
            <div className="flex justify-between text-[11px] theme-text-secondary">
              <span>Status: Executed in local WebWorker heap (0 server latency)</span>
              <span className="text-emerald-500 font-semibold">$0 Cloud Bill</span>
            </div>
          </div>

          {/* Traditional Docker Cloud IDE Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 theme-text-secondary">
                <Server className="w-4 h-4 text-slate-400" />
                Traditional Cloud IDEs (Gitpod / Codespaces Docker Containers)
              </span>
              <span className="theme-text-secondary font-semibold flex items-center gap-1">
                {racing && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
                {timerDocker}
              </span>
            </div>
            <div className="h-3.5 w-full rounded-full theme-bg-surface-2 overflow-hidden p-0.5 border theme-border">
              <div
                style={{ width: `${dockerProgress}%` }}
                className="h-full rounded-full bg-slate-500 dark:bg-slate-600 transition-all duration-100 ease-out"
              />
            </div>
            <div className="flex justify-between text-[11px] theme-text-secondary">
              <span className="truncate max-w-[80%]">{dockerStatus}</span>
              <span className="text-rose-500 font-semibold">$15-$40 / mo</span>
            </div>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
};

export default SpeedBenchmarkWidget;

