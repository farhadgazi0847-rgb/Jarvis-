import React, { useState } from 'react';
import { Trash2, Plus, Brain, Radio, UserCheck, History } from 'lucide-react';
import type {
  BrowserMicPermissionState,
  CommandLogEntry,
  JarvisPersonality,
  JarvisSettings,
  JarvisVoiceName,
  LanguageCode,
  MemoryItem,
} from '../types/jarvis';

interface SettingsAndMemoryProps {
  settings: JarvisSettings;
  memories: MemoryItem[];
  commandLogs: CommandLogEntry[];
  browserMicStatus: BrowserMicPermissionState;
  onUpdateSettings: (patch: Partial<JarvisSettings>) => void;
  onToggleWakeWord: () => void;
  onRequestBrowserMic: () => void;
  onAddMemory: (fact: string, category: MemoryItem['category']) => void;
  onDeleteMemory: (id: string) => void;
  onClearHistory: () => void;
  onTestVoice: () => void;
}

const VOICES: Array<{ id: JarvisVoiceName; label: string }> = [
  { id: 'Charon', label: 'Charon · Deep Tactical (Gemini TTS)' },
  { id: 'Fenrir', label: 'Fenrir · Resonant Baritone (Gemini TTS)' },
  { id: 'Puck', label: 'Puck · Crisp & Energetic (Gemini TTS)' },
  { id: 'Kore', label: 'Kore · Warm & Clear (Gemini TTS)' },
  { id: 'Zephyr', label: 'Zephyr · Calm Neutral (Gemini TTS)' },
  { id: 'browser', label: 'Device Offline SpeechSynthesis (Zero Network)' },
];

export const SettingsAndMemory: React.FC<SettingsAndMemoryProps> = ({
  settings,
  memories,
  commandLogs,
  browserMicStatus,
  onUpdateSettings,
  onToggleWakeWord,
  onRequestBrowserMic,
  onAddMemory,
  onDeleteMemory,
  onClearHistory,
  onTestVoice,
}) => {
  const [newFact, setNewFact] = useState('');
  const [newCat, setNewCat] = useState<MemoryItem['category']>('preference');
  const [wakeInput, setWakeInput] = useState(settings.wakePhrases.join(', '));

  const saveWakePhrases = () => {
    const parsed = wakeInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdateSettings({ wakePhrases: parsed.length > 0 ? parsed : ['Hey Jarvis', 'Jarvis'] });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Voice, Language & Wake-Word Personalization */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-cyan-400" />
          <h2 className="font-display text-base font-semibold text-slate-100">
            Assistant Personalization
          </h2>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label htmlFor="pref-language" className="mb-1.5 block text-slate-300">
              Language Mode
            </label>
            <select
              id="pref-language"
              value={settings.language}
              onChange={(e) => onUpdateSettings({ language: e.target.value as LanguageCode })}
              className="min-h-[42px] w-full rounded-xl border border-slate-700 bg-[#070B13] px-3 text-slate-100"
            >
              <option value="auto">Auto-Detect (English · বাংলা · हिन्दी · Banglish · Hinglish)</option>
              <option value="en">English Only</option>
              <option value="bn">Bengali (বাংলা)</option>
              <option value="hi">Hindi (हिन्दी)</option>
            </select>
          </div>

          <div>
            <label htmlFor="pref-voice" className="mb-1.5 block text-slate-300">
              JARVIS Voice Persona
            </label>
            <div className="flex gap-2">
              <select
                id="pref-voice"
                value={settings.voice}
                onChange={(e) => onUpdateSettings({ voice: e.target.value as JarvisVoiceName })}
                className="min-h-[42px] flex-1 rounded-xl border border-slate-700 bg-[#070B13] px-3 text-slate-100"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onTestVoice}
                className="min-h-[42px] shrink-0 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 font-medium text-cyan-200 hover:bg-cyan-500/25"
              >
                Test Voice
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="pref-personality" className="mb-1.5 block text-slate-300">
              Assistant Personality
            </label>
            <select
              id="pref-personality"
              value={settings.personality}
              onChange={(e) =>
                onUpdateSettings({ personality: e.target.value as JarvisPersonality })
              }
              className="min-h-[42px] w-full rounded-xl border border-slate-700 bg-[#070B13] px-3 text-slate-100"
            >
              <option value="classic">JARVIS Classic (Composed, intelligent, subtly witty)</option>
              <option value="concise">Tactical Concise (Brief cockpit telemetry style)</option>
              <option value="warm">Warm Companion (Friendly and conversational)</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#080D16] p-3">
            <div>
              <div className="font-medium text-slate-200">Auto-Speak Responses</div>
              <div className="text-[11px] text-slate-400">
                Read JARVIS replies aloud automatically after generation
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoSpeakResponses}
              aria-label="Toggle auto-speak responses"
              onClick={() =>
                onUpdateSettings({ autoSpeakResponses: !settings.autoSpeakResponses })
              }
              className={`min-h-[34px] rounded-lg border px-3 font-mono text-[11px] ${
                settings.autoSpeakResponses
                  ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {settings.autoSpeakResponses ? 'On' : 'Off'}
            </button>
          </div>

          {/* Voice-Only Mode (Speak without text wall) */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#080D16] p-3.5">
            <div>
              <div className="font-medium text-slate-200">Voice-Only Mode</div>
              <div className="text-[11px] text-slate-400">
                Speak replies aloud automatically and keep text hidden unless expanded
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.speechOnlyMode}
              aria-label="Toggle voice-only speech mode"
              onClick={() =>
                onUpdateSettings({
                  speechOnlyMode: !settings.speechOnlyMode,
                  autoSpeakResponses: !settings.speechOnlyMode ? true : settings.autoSpeakResponses,
                })
              }
              className={`min-h-[34px] rounded-lg border px-3 font-mono text-[11px] ${
                settings.speechOnlyMode
                  ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {settings.speechOnlyMode ? 'On' : 'Off'}
            </button>
          </div>

          {/* Fast Reply & Instant Voice Listening */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#080D16] p-3.5">
            <div>
              <div className="font-medium text-slate-200">Fast Reply &amp; Low-Latency Listening</div>
              <div className="text-[11px] text-slate-400">
                Use ultra-fast Gemini Flash-Lite responses, VAD auto-stop mic, and low-latency voice playback
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.fastMode}
              aria-label="Toggle fast mode"
              onClick={() => onUpdateSettings({ fastMode: !settings.fastMode })}
              className={`min-h-[34px] rounded-lg border px-3 font-mono text-[11px] ${
                settings.fastMode
                  ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {settings.fastMode ? 'On' : 'Off'}
            </button>
          </div>

          {/* Wake Word Settings */}
          <div className="rounded-xl border border-slate-800 bg-[#080D16] p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-slate-200">
                <Radio className="h-4 w-4 text-cyan-400" />
                <span>Custom Wake-Word Phrases</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.wakeWordEnabled}
                aria-label="Toggle wake-word listener"
                onClick={onToggleWakeWord}
                className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
                  settings.wakeWordEnabled
                    ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                {settings.wakeWordEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                aria-label="Wake-word phrases"
                value={wakeInput}
                onChange={(e) => setWakeInput(e.target.value)}
                className="min-h-[38px] flex-1 rounded-lg border border-slate-700 bg-[#06090F] px-3 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={saveWakePhrases}
                className="min-h-[38px] rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25"
              >
                Apply
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
              <span className="text-[11px] text-slate-400">
                Browser Mic Permission:{' '}
                <strong
                  className={
                    browserMicStatus === 'granted'
                      ? 'text-emerald-300'
                      : browserMicStatus === 'denied' || browserMicStatus === 'unsupported'
                      ? 'text-rose-300'
                      : 'text-amber-300'
                  }
                >
                  {browserMicStatus === 'granted'
                    ? 'Granted'
                    : browserMicStatus === 'denied'
                    ? 'Blocked'
                    : browserMicStatus === 'unsupported'
                    ? 'Unavailable'
                    : 'Prompt Required'}
                </strong>
              </span>
              {browserMicStatus !== 'granted' && browserMicStatus !== 'unsupported' && (
                <button
                  type="button"
                  onClick={onRequestBrowserMic}
                  className="min-h-[32px] rounded-lg border border-amber-400/50 bg-amber-500/15 px-2.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/25"
                >
                  {browserMicStatus === 'denied' ? 'Retry Mic Permission' : 'Grant Mic Access'}
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Microphone is active only while enabled and clearly indicated in the HUD. No hidden recording.
            </p>
          </div>
        </div>
      </section>

      {/* User-Approved Memory & Privacy Controls */}
      <div className="space-y-6">
        <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-cyan-400" />
              <h2 className="font-display text-base font-semibold text-slate-100">
                User-Approved Memory
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {memories.length} stored
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newFact.trim()) return;
              onAddMemory(newFact.trim(), newCat);
              setNewFact('');
            }}
            className="mb-4 flex flex-wrap gap-2"
          >
            <input
              type="text"
              aria-label="Memory fact"
              value={newFact}
              onChange={(e) => setNewFact(e.target.value)}
              placeholder="e.g. Call me Commander, prefer Celsius..."
              className="min-h-[40px] flex-1 rounded-xl border border-slate-700 bg-[#070B13] px-3 text-xs text-slate-100 placeholder:text-slate-500"
            />
            <select
              aria-label="Memory category"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as MemoryItem['category'])}
              className="min-h-[40px] rounded-xl border border-slate-700 bg-[#070B13] px-2.5 text-xs text-slate-200"
            >
              <option value="preference">Preference</option>
              <option value="routine">Routine</option>
              <option value="contact">Contact</option>
              <option value="general">General</option>
            </select>
            <button
              type="submit"
              className="flex min-h-[40px] items-center gap-1 rounded-xl bg-cyan-500 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Save</span>
            </button>
          </form>

          <ul className="max-h-48 divide-y divide-slate-800/80 overflow-y-auto">
            {memories.length === 0 ? (
              <li className="py-3 text-xs text-slate-400">No saved preferences yet.</li>
            ) : (
              memories.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                  <div>
                    <span className="text-slate-200">{m.fact}</span>
                    <span className="ml-2 font-mono text-[11px] text-slate-400">
                      · {m.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete memory ${m.fact}`}
                    onClick={() => onDeleteMemory(m.id)}
                    className="rounded-md p-1.5 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Recent Command History & Privacy Wipe */}
        <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-400" />
              <h2 className="font-display text-base font-semibold text-slate-100">
                Recent Commands &amp; History
              </h2>
            </div>
            <button
              type="button"
              onClick={onClearHistory}
              className="min-h-[36px] rounded-lg border border-rose-500/40 bg-rose-950/25 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-950/45"
            >
              Clear Conversation History
            </button>
          </div>
          {commandLogs.length === 0 ? (
            <p className="text-xs text-slate-400">No recent device or assistant commands logged.</p>
          ) : (
            <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
              {commandLogs.slice(0, 8).map((c) => (
                <li key={c.id} className="flex justify-between gap-2 text-slate-300">
                  <span className="truncate">{c.command}</span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">{c.timestamp}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
