import React, { useState } from 'react';
import { Copy, Check, Cpu } from 'lucide-react';
import {
  ANDROID_ARCHITECTURE_SUMMARY,
  ANDROID_BLUEPRINT_FILES,
} from '../data/androidBlueprint';

export const AndroidStudioPlan: React.FC = () => {
  const [activeFileId, setActiveFileId] = useState(ANDROID_BLUEPRINT_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeFile =
    ANDROID_BLUEPRINT_FILES.find((f) => f.id === activeFileId) || ANDROID_BLUEPRINT_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopiedId(activeFile.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-cyan-400" />
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Native Android Studio Implementation Plan (Kotlin + Jetpack Compose)
            </h2>
            <p className="text-xs text-slate-400">
              Production architecture for native Android wake-word service, runtime permissions, Intent control, and offline SpeechRecognizer/TTS.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ANDROID_ARCHITECTURE_SUMMARY.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-800 bg-[#080D16] p-4"
            >
              <h3 className="font-display text-sm font-semibold text-cyan-300">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {ANDROID_BLUEPRINT_FILES.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveFileId(file.id)}
                className={`min-h-[38px] rounded-lg border px-3 py-1.5 font-mono text-xs whitespace-nowrap transition-colors ${
                  activeFile.id === file.id
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                    : 'border-slate-800 bg-[#080D16] text-slate-400 hover:text-slate-200'
                }`}
              >
                {file.filename}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25"
          >
            {copiedId === activeFile.id ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Module</span>
              </>
            )}
          </button>
        </div>

        <div className="mb-3 text-xs text-slate-300">
          <span className="font-semibold text-cyan-300">{activeFile.title}</span> ·{' '}
          <span className="text-slate-400">{activeFile.summary}</span>
        </div>

        <pre className="max-h-[460px] overflow-auto rounded-xl border border-slate-800 bg-[#05080E] p-4 font-mono text-xs leading-relaxed text-slate-200">
          <code>{activeFile.code}</code>
        </pre>
      </section>
    </div>
  );
};
