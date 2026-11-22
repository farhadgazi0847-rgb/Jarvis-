import React, { useState } from 'react';
import { Search, Newspaper, CloudSun, ExternalLink, Image as ImageIcon, Sunrise } from 'lucide-react';
import type { GroundingSource, LanguageCode, TaskItem, AlarmItem, CalendarEventItem } from '../types/jarvis';

interface SearchAndBriefingProps {
  language: LanguageCode;
  tasks: TaskItem[];
  alarms: AlarmItem[];
  events: CalendarEventItem[];
  autoSpeakResponses: boolean;
  onRunBriefing: () => void;
  onSpeakText: (text: string) => void;
}

export const SearchAndBriefing: React.FC<SearchAndBriefingProps> = ({
  language,
  tasks,
  alarms,
  events,
  autoSpeakResponses,
  onRunBriefing,
  onSpeakText,
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'web' | 'news' | 'weather'>('web');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    summary: string;
    sources: GroundingSource[];
    googleSearchUrl: string;
    googleImagesUrl: string;
  } | null>(null);

  const executeSearch = async (overrideQuery?: string, overrideMode?: 'web' | 'news' | 'weather') => {
    const q = (overrideQuery ?? query).trim();
    const m = overrideMode ?? mode;
    if (!q) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jarvis/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, mode: m, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Search request failed.');
      }
      setResult(data);
      if (autoSpeakResponses && data.summary) {
        onSpeakText(data.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete search.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  };

  const pendingTasksCount = tasks.filter((t) => !t.completed).length;
  const activeAlarmsCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6">
      {/* Daily Briefing Card */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Daily Intelligence Briefing
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {pendingTasksCount} open tasks · {activeAlarmsCount} active alarms · {events.length} scheduled events
            </p>
          </div>
          <button
            type="button"
            onClick={onRunBriefing}
            className="flex min-h-[42px] items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 whitespace-nowrap hover:bg-cyan-400"
          >
            <Sunrise className="h-4 w-4" />
            <span>Generate Daily Briefing</span>
          </button>
        </div>
      </section>

      {/* Live Internet Search Engine */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Internet Search Engine
            </h2>
            <p className="text-xs text-slate-400">
              Powered by live Google Search grounding with verified source URLs.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-[#070B13] p-1">
            <button
              type="button"
              onClick={() => setMode('web')}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                mode === 'web'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Web</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('news')}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                mode === 'news'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Newspaper className="h-3.5 w-3.5" />
              <span>News</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('weather')}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                mode === 'weather'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CloudSun className="h-3.5 w-3.5" />
              <span>Weather</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="jarvis-web-search" className="sr-only">
            Search the internet
          </label>
          <input
            id="jarvis-web-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'weather'
                ? 'Enter city for live weather (e.g., Dhaka, Kolkata, New Delhi)...'
                : mode === 'news'
                ? 'Enter news topic (e.g., AI breakthroughs, cricket match)...'
                : 'Search websites, facts, or recent information...'
            }
            className="min-h-[44px] flex-1 rounded-xl border border-slate-700/80 bg-[#070B13] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 whitespace-nowrap hover:bg-cyan-400 disabled:opacity-40"
          >
            <Search className="h-4 w-4" />
            <span>{loading ? 'Searching...' : 'Search'}</span>
          </button>
        </form>

        {/* Quick presets */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setQuery('Current weather in Dhaka');
              setMode('weather');
              executeSearch('Current weather in Dhaka', 'weather');
            }}
            className="rounded-lg border border-slate-800 bg-[#080D16] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/40"
          >
            Dhaka Weather
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('Latest technology and space exploration news today');
              setMode('news');
              executeSearch('Latest technology and space exploration news today', 'news');
            }}
            className="rounded-lg border border-slate-800 bg-[#080D16] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/40"
          >
            Tech &amp; Space News
          </button>
        </div>

        {error && (
          <div className="mt-4 space-y-3 rounded-xl border border-rose-500/40 bg-rose-950/25 p-3 text-xs text-rose-200">
            <p>{error}</p>
            {query.trim() && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-[#080D16] px-3 py-1.5 text-xs font-medium text-cyan-300 hover:border-cyan-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Google Search in Browser</span>
                </a>
                <a
                  href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-[#080D16] px-3 py-1.5 text-xs font-medium text-cyan-300 hover:border-cyan-400"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Open Google Images</span>
                </a>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-4 border-t border-cyan-500/15 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-cyan-300">Search Summary</h3>
              <button
                type="button"
                onClick={() => onSpeakText(result.summary)}
                className="text-xs font-medium text-cyan-300 hover:underline"
              >
                Speak Summary
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {result.summary}
            </p>

            {/* Real Source Links & Image Search Launch */}
            <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-3">
              <a
                href={result.googleSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-[#080D16] px-3 py-1.5 text-xs font-medium text-cyan-300 hover:border-cyan-400"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Web Results in Browser</span>
              </a>
              <a
                href={result.googleImagesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-[#080D16] px-3 py-1.5 text-xs font-medium text-cyan-300 hover:border-cyan-400"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Open Image Search Results</span>
              </a>
            </div>

            {result.sources.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-xs text-slate-400">Retrieved Source Links</p>
                <ul className="space-y-1.5">
                  {result.sources.map((src, i) => (
                    <li key={i}>
                      <a
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span>{src.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
