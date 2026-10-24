import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, ChevronRight, X, Terminal } from 'lucide-react';
import { DecryptedText } from './react-bits/text/DecryptedText';

export const WasmBootHud: React.FC = () => {
  const [bootStep, setBootStep] = useState<number>(1);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setBootStep(2), 800);
    const timer2 = setTimeout(() => setBootStep(3), 1600);
    const timer3 = setTimeout(() => setIsFinished(true), 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  if (isDismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 select-none">
      {!isFinished ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-[#FF7057]/30 theme-bg-glass p-3 neu-card backdrop-blur-xl max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between gap-2 border-b theme-border pb-1.5">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#FF7057]">
              <Cpu className="h-3.5 w-3.5 animate-spin" />
              <span>WASM Kernel Boot Sequence</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className={`flex items-center gap-1.5 ${bootStep >= 1 ? 'text-emerald-400' : 'theme-text-muted'}`}>
              <span className="text-[10px]">[01/03]</span>
              <span>Mounting virtual filesystem (IDBFS)...</span>
              {bootStep > 1 && <CheckCircle2 className="h-3 w-3" />}
            </div>

            {bootStep >= 2 && (
              <div className={`flex items-center gap-1.5 ${bootStep >= 2 ? 'text-[#FF7057]' : 'theme-text-muted'}`}>
                <span className="text-[10px]">[02/03]</span>
                <DecryptedText text="Compiling Pyodide 0.26 WebAssembly binary..." speed={25} />
                {bootStep > 2 && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
              </div>
            )}

            {bootStep >= 3 && (
              <div className="flex items-center gap-1.5 text-purple-400">
                <span className="text-[10px]">[03/03]</span>
                <DecryptedText text="Connecting Yjs WebSocket provider... Ready." speed={25} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 font-mono text-[11px] text-emerald-400 neu-card backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>WASM 0.26 Core Ready (0ms latency)</span>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="ml-1 rounded p-0.5 text-emerald-400/70 hover:text-emerald-400 cursor-pointer"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default WasmBootHud;

