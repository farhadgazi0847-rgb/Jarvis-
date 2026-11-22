import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Mic,
  Volume2,
  VolumeX,
  ExternalLink,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileText,
  Zap,
} from 'lucide-react';
import type { ChatMessage, LanguageCode } from '../types/jarvis';

interface ChatConsoleProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (val: string) => void;
  onSendMessage: (text?: string) => void;
  onSpeakMessage: (text: string) => void;
  onConfirmAction: (messageId: string, approved: boolean) => void;
  isThinking: boolean;
  micActive: boolean;
  onToggleMic: () => void;
  selectedLanguage: LanguageCode;
  interimTranscript: string;
  autoSpeakResponses: boolean;
  speechOnlyMode: boolean;
  fastMode: boolean;
  onToggleAutoSpeak: () => void;
  onToggleSpeechOnly: () => void;
  onToggleFastMode: () => void;
}

const QUICK_PROMPTS: Record<LanguageCode, string[]> = {
  auto: [
    'Give me a daily briefing & tech news',
    'আজকের আবহাওয়া কেমন এবং ১টি রিমাইন্ডার সেট করো',
    'आज की ताज़ा खबरें बताओ',
    'Open Google Maps to Dhaka Airport',
    'Send SMS to Alex saying I am running 10 minutes late',
  ],
  en: [
    'Give me a daily briefing & top news',
    'Calculate (245 * 18) + 90 and save as a note',
    'Open Google Maps to nearest coffee shop',
    'Send SMS to Alex saying I am on my way',
  ],
  bn: [
    'আজকের গুরুত্বপূর্ণ বিশ্ব সংবাদ সংক্ষেপে বলো',
    'আমাকে মনে করিয়ে দাও সন্ধ্যা ৭টায় মিটিং আছে',
    'Google Maps এ ঢাকা এয়ারপোর্ট দেখাও',
    'অ্যালেক্সকে এসএমএস পাঠাও আমি ১০ মিনিটে আসছি',
  ],
  hi: [
    'आज की मुख्य खबरें और मौसम बताओ',
    'शाम 6 बजे का अलार्म सेट करो',
    'Google Maps पर नई दिल्ली रेलवे स्टेशन खोलो',
    'राहुल को कॉल करो',
  ],
};

export const ChatConsole: React.FC<ChatConsoleProps> = ({
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onSpeakMessage,
  onConfirmAction,
  isThinking,
  micActive,
  onToggleMic,
  selectedLanguage,
  interimTranscript,
  autoSpeakResponses,
  speechOnlyMode,
  fastMode,
  onToggleAutoSpeak,
  onToggleSpeechOnly,
  onToggleFastMode,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [revealedTextIds, setRevealedTextIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking]);

  const prompts = QUICK_PROMPTS[selectedLanguage] || QUICK_PROMPTS.auto;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isThinking) return;
    onSendMessage(inputValue);
  };

  return (
    <section
      aria-label="JARVIS Conversation Console"
      className="flex h-full min-h-[520px] min-w-0 flex-col rounded-2xl border border-cyan-500/20 bg-[#0C121E]"
    >
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 px-4 py-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-wide text-slate-100">
            Assistant Feed
          </h2>
          <p className="text-xs text-slate-400">
            Multilingual Voice &amp; Intent Engine · English · বাংলা · हिन्दी
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={autoSpeakResponses}
            onClick={onToggleAutoSpeak}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              autoSpeakResponses
                ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-700 bg-[#080D16] text-slate-400 hover:text-slate-200'
            }`}
          >
            {autoSpeakResponses ? (
              <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            <span>Auto-Speak: {autoSpeakResponses ? 'On' : 'Off'}</span>
          </button>
          <button
            type="button"
            aria-pressed={speechOnlyMode}
            onClick={onToggleSpeechOnly}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              speechOnlyMode
                ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                : 'border-slate-700 bg-[#080D16] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span>Voice-Only: {speechOnlyMode ? 'On' : 'Off'}</span>
          </button>
          <button
            type="button"
            aria-pressed={fastMode}
            onClick={onToggleFastMode}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              fastMode
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                : 'border-slate-700 bg-[#080D16] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Fast: {fastMode ? 'On' : 'Off'}</span>
          </button>
          <span className="font-mono text-xs text-cyan-400 tabular-nums">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>
      </div>

      {/* Scrollable conversation timeline */}
      <div
        data-testid="chat-timeline"
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <article
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'border border-cyan-400/30 bg-cyan-500/15 text-slate-100'
                    : msg.error
                    ? 'border border-rose-500/40 bg-rose-950/30 text-rose-200'
                    : 'border border-slate-700/80 bg-[#101827] text-slate-200'
                }`}
              >
                {/* Clean unboxed metadata header */}
                <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px] text-slate-400">
                  <span className="font-mono font-medium text-cyan-400">
                    {isUser ? 'You' : 'JARVIS'}
                    {msg.detectedLanguage ? (
                      <span className="text-slate-400">
                        {' '}
                        · {msg.detectedLanguage === 'bn' ? 'বাংলা' : msg.detectedLanguage === 'hi' ? 'हिन्दी' : 'English'}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums">{msg.timestamp}</span>
                </div>

                {/* Body prose or compact spoken-audio summary */}
                {!isUser && msg.spokenOnly && !revealedTextIds[msg.id] ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
                    <Volume2 className="h-4 w-4 shrink-0 text-cyan-400" />
                    <span>Spoken aloud automatically (Voice-Only response)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedTextIds((prev) => ({ ...prev, [msg.id]: true }))
                      }
                      className="ml-auto inline-flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-0.5 text-[11px] text-cyan-300 hover:bg-cyan-500/15"
                    >
                      <FileText className="h-3 w-3" />
                      <span>Show Text</span>
                    </button>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">
                    {msg.text}
                    {!isUser && msg.spokenOnly && revealedTextIds[msg.id] && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedTextIds((prev) => ({ ...prev, [msg.id]: false }))
                          }
                          className="text-[11px] text-slate-400 hover:text-cyan-300"
                        >
                          Hide Text
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tool executions list */}
                {msg.toolEvents && msg.toolEvents.length > 0 && (
                  <div className="mt-2.5 border-t border-cyan-500/15 pt-2 text-xs text-cyan-300">
                    {msg.toolEvents.map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 py-0.5">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grounding Search Source Links */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 border-t border-slate-700/70 pt-2.5">
                    <p className="mb-1.5 font-mono text-[11px] text-slate-400">Verified Sources</p>
                    <ul className="space-y-1">
                      {msg.sources.slice(0, 5).map((src, idx) => (
                        <li key={idx}>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[260px] sm:max-w-[380px]">
                              {src.title}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sensitive Action Confirmation Gate */}
                {msg.pendingConfirmation && (
                  <div
                    data-testid="sensitive-confirmation-card"
                    className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/25 p-3"
                  >
                    <div className="flex items-start gap-2 text-xs text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <div>
                        <p className="font-semibold text-amber-300">Confirmation Required</p>
                        <p className="mt-0.5 text-slate-200">{msg.pendingConfirmation.explanation}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-400">
                          Intent: {msg.pendingConfirmation.intentSpec.androidAction} ·{' '}
                          {msg.pendingConfirmation.intentSpec.uriOrPackage}
                        </p>
                      </div>
                    </div>

                    {msg.confirmationStatus === 'pending' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onConfirmAction(msg.id, true)}
                          className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-300"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>Confirm &amp; Execute</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onConfirmAction(msg.id, false)}
                          className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Cancel Action</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                        {msg.confirmationStatus === 'approved' ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approved and dispatched
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400">
                            <XCircle className="h-3.5 w-3.5" /> Cancelled by user
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Replay / Speak button for assistant messages */}
                {!isUser && !msg.error && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onSpeakMessage(msg.text)}
                      aria-label={`Speak JARVIS response from ${msg.timestamp}`}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>{autoSpeakResponses || msg.spokenOnly ? 'Replay Voice' : 'Read Aloud'}</span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {isThinking && (
          <div className="flex items-start">
            <div className="rounded-2xl border border-cyan-500/20 bg-[#101827] px-4 py-3 text-xs font-mono text-cyan-300">
              JARVIS is analyzing intent and tools...
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Quick Prompts Row */}
      <div className="flex gap-2 overflow-x-auto border-t border-cyan-500/10 px-4 py-2.5">
        {prompts.map((prompt, i) => (
          <button
            key={i}
            type="button"
            disabled={isThinking}
            onClick={() => onSendMessage(prompt)}
            className="shrink-0 rounded-lg border border-cyan-500/20 bg-[#0A101B] px-3 py-1.5 text-xs text-slate-300 whitespace-nowrap transition-colors hover:border-cyan-400/50 hover:text-cyan-200 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Live voice interim preview */}
      {interimTranscript && (
        <div className="border-t border-amber-500/20 bg-amber-950/20 px-4 py-1.5 text-xs text-amber-200">
          Hearing: &ldquo;{interimTranscript}&rdquo;
        </div>
      )}

      {/* Message Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-cyan-500/15 p-3"
      >
        <button
          type="button"
          onClick={onToggleMic}
          aria-label={micActive ? 'Stop voice input' : 'Start voice input'}
          className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border transition-colors ${
            micActive
              ? 'border-amber-400 bg-amber-500/20 text-amber-300'
              : 'border-cyan-500/25 bg-[#090E18] text-cyan-300 hover:border-cyan-400/60'
          }`}
        >
          <Mic className="h-4 w-4" />
        </button>

        <label htmlFor="jarvis-chat-input" className="sr-only">
          Command or question for JARVIS
        </label>
        <input
          id="jarvis-chat-input"
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask JARVIS in English, বাংলা, हिन्दी, Banglish, or Hinglish..."
          className="min-h-[44px] flex-1 rounded-xl border border-slate-700/80 bg-[#070B13] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!inputValue.trim() || isThinking}
          aria-label="Send command"
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 whitespace-nowrap transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </section>
  );
};
