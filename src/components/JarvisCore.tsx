import React from 'react';
import { Mic, MicOff, Volume2, Radio, ShieldAlert } from 'lucide-react';
import type { AssistantCoreState } from '../types/jarvis';

interface JarvisCoreProps {
  coreState: AssistantCoreState;
  audioLevels: number[];
  micActive: boolean;
  wakeWordEnabled: boolean;
  isSpeaking: boolean;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  onToggleWakeWord: () => void;
  compact?: boolean;
}

const STATE_LABELS: Record<AssistantCoreState, { title: string; tone: string }> = {
  idle: { title: 'Standby', tone: 'text-cyan-400' },
  wake_listening: { title: 'Wake Listener Active', tone: 'text-cyan-300' },
  listening: { title: 'Listening to Voice', tone: 'text-amber-400' },
  thinking: { title: 'Processing Intent', tone: 'text-cyan-300' },
  speaking: { title: 'Speaking Response', tone: 'text-cyan-400' },
  awaiting_confirmation: { title: 'Awaiting Confirmation', tone: 'text-amber-400' },
  error: { title: 'Attention Needed', tone: 'text-rose-400' },
};

export const JarvisCore: React.FC<JarvisCoreProps> = ({
  coreState,
  audioLevels,
  micActive,
  wakeWordEnabled,
  isSpeaking,
  onToggleMic,
  onStopSpeaking,
  onToggleWakeWord,
  compact = false,
}) => {
  const statusInfo = STATE_LABELS[coreState];
  const isListeningNow = coreState === 'listening';
  const isAmber = isListeningNow || coreState === 'awaiting_confirmation';
  const ringStroke = isAmber ? '#F59E0B' : '#06B6D4';

  const bars = audioLevels.length > 0 ? audioLevels : Array.from({ length: 24 }, () => 0.12);

  return (
    <section
      aria-label="JARVIS Holographic Core"
      data-testid="jarvis-core"
      data-core-state={coreState}
      className="flex flex-col items-center justify-center rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5"
    >
      {/* Honest Microphone Privacy Indicator */}
      <div className="mb-3 flex w-full items-center justify-between text-xs">
        <span className={`font-mono font-medium ${statusInfo.tone}`}>{statusInfo.title}</span>
        <span
          className={`flex items-center gap-1.5 font-mono ${
            micActive ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          {micActive ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
              Mic Live
            </>
          ) : (
            'Mic Off'
          )}
        </span>
      </div>

      {/* Circular Animated Holographic Core */}
      <div
        className={`relative flex items-center justify-center ${
          compact ? 'h-40 w-40' : 'h-52 w-52 sm:h-56 sm:w-56'
        }`}
      >
        <svg
          viewBox="0 0 220 220"
          className="h-full w-full"
          role="img"
          aria-label={`JARVIS circular core in ${statusInfo.title} state`}
        >
          {/* Outer segmented telemetry ring */}
          <circle
            cx="110"
            cy="110"
            r="98"
            fill="none"
            stroke={ringStroke}
            strokeOpacity="0.22"
            strokeWidth="1.5"
            strokeDasharray="14 8 4 8"
            className="jarvis-ring-cw"
          />

          {/* Mid counter-rotating arc */}
          <circle
            cx="110"
            cy="110"
            r="82"
            fill="none"
            stroke={ringStroke}
            strokeOpacity={isListeningNow || isSpeaking ? '0.85' : '0.45'}
            strokeWidth="3"
            strokeDasharray="120 45 55 45"
            strokeLinecap="round"
            className="jarvis-ring-ccw"
          />

          {/* Inner precision ring */}
          <circle
            cx="110"
            cy="110"
            r="64"
            fill="none"
            stroke={ringStroke}
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />

          {/* Radial tick marks */}
          {Array.from({ length: 24 }).map((_, idx) => {
            const angle = (idx * 15 * Math.PI) / 180;
            const x1 = 110 + Math.cos(angle) * 68;
            const y1 = 110 + Math.sin(angle) * 68;
            const level = bars[idx % bars.length] || 0.12;
            const len = isListeningNow || isSpeaking ? 4 + level * 11 : 4;
            const x2 = 110 + Math.cos(angle) * (68 + len);
            const y2 = 110 + Math.sin(angle) * (68 + len);
            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={ringStroke}
                strokeOpacity={isListeningNow || isSpeaking ? 0.9 : 0.35}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}

          {/* Core energy disc */}
          <circle
            cx="110"
            cy="110"
            r="48"
            fill={ringStroke}
            fillOpacity={isListeningNow ? '0.18' : '0.10'}
            stroke={ringStroke}
            strokeOpacity="0.65"
            strokeWidth="1.5"
          />
        </svg>

        {/* Center interactive voice button */}
        <button
          type="button"
          onClick={onToggleMic}
          aria-label={micActive ? 'Stop voice listening' : 'Start voice command'}
          className={`absolute flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-full border transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
            micActive
              ? 'border-amber-400/80 bg-amber-500/20 text-amber-200'
              : 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
          }`}
        >
          {coreState === 'awaiting_confirmation' ? (
            <ShieldAlert className="h-6 w-6 text-amber-300" />
          ) : micActive ? (
            <Mic className="h-6 w-6" />
          ) : (
            <MicOff className="h-6 w-6 opacity-80" />
          )}
          <span className="mt-1 font-mono text-[10px] font-semibold tracking-wider uppercase">
            {micActive ? 'Stop' : 'Speak'}
          </span>
        </button>
      </div>

      {/* Live Audio Waveform Strip */}
      <div
        aria-label="Audio waveform visualizer"
        data-testid="audio-waveform"
        className="mt-4 flex h-9 w-full items-center justify-center gap-1 px-2"
      >
        {bars.map((val, idx) => {
          const heightPct = Math.max(14, Math.min(100, Math.round(val * 100)));
          return (
            <span
              key={idx}
              style={{ height: `${heightPct}%` }}
              className={`w-1 rounded-full transition-all duration-100 ${
                isAmber ? 'bg-amber-400/85' : 'bg-cyan-400/75'
              }`}
            />
          );
        })}
      </div>

      {/* Hands-free Wake Word & Audio Playback Controls */}
      <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-2 border-t border-cyan-500/15 pt-3">
        <button
          type="button"
          onClick={onToggleWakeWord}
          aria-pressed={wakeWordEnabled}
          className={`flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
            wakeWordEnabled
              ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
              : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-cyan-500/40'
          }`}
        >
          <Radio className="h-3.5 w-3.5 shrink-0" />
          <span>{wakeWordEnabled ? 'Wake Word: On' : 'Wake Word: Off'}</span>
        </button>

        {isSpeaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-200 whitespace-nowrap hover:bg-amber-500/25 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <Volume2 className="h-3.5 w-3.5 shrink-0" />
            <span>Mute Voice</span>
          </button>
        )}
      </div>
    </section>
  );
};
