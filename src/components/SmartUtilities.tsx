import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Trash2,
  Plus,
  AlarmClock,
  Calendar,
  Calculator,
  Languages,
  StickyNote,
} from 'lucide-react';
import type { AlarmItem, CalendarEventItem, NoteItem, TaskItem } from '../types/jarvis';
import { evaluateMathExpression, formatTimeUntilAlarm } from '../utils/jarvisLogic';

interface SmartUtilitiesProps {
  notes: NoteItem[];
  tasks: TaskItem[];
  alarms: AlarmItem[];
  events: CalendarEventItem[];
  onAddNote: (title: string, content: string) => void;
  onDeleteNote: (id: string) => void;
  onAddTask: (title: string, priority: TaskItem['priority']) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAddAlarm: (label: string, time: string) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
  onAddEvent: (title: string, date: string, time: string, location?: string) => void;
  onDeleteEvent: (id: string) => void;
  onSpeakText: (text: string) => void;
}

export const SmartUtilities: React.FC<SmartUtilitiesProps> = ({
  notes,
  tasks,
  alarms,
  events,
  onAddNote,
  onDeleteNote,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onAddAlarm,
  onToggleAlarm,
  onDeleteAlarm,
  onAddEvent,
  onDeleteEvent,
  onSpeakText,
}) => {
  // Notes state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Tasks state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskItem['priority']>('medium');

  // Alarms state
  const [alarmLabel, setAlarmLabel] = useState('');
  const [alarmTime, setAlarmTime] = useState('07:30');

  // Calendar state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventTime, setEventTime] = useState('14:00');
  const [eventLocation, setEventLocation] = useState('');

  // Calculator state
  const [calcInput, setCalcInput] = useState('(245 * 18) + 90');
  const calcOutcome = evaluateMathExpression(calcInput);

  // Translator state
  const [translateText, setTranslateText] = useState('');
  const [targetLang, setTargetLang] = useState<'en' | 'bn' | 'hi'>('bn');
  const [translating, setTranslating] = useState(false);
  const [translatedOutput, setTranslatedOutput] = useState('');
  const [translateError, setTranslateError] = useState<string | null>(null);

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!translateText.trim()) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await fetch('/api/jarvis/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: translateText, targetLanguage: targetLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation error');
      setTranslatedOutput(data.translatedText || '');
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Smart Task Manager */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-cyan-400" />
            <h2 className="font-display text-base font-semibold text-slate-100">Smart Tasks</h2>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {tasks.filter((t) => !t.completed).length} pending
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!taskTitle.trim()) return;
            onAddTask(taskTitle.trim(), taskPriority);
            setTaskTitle('');
          }}
          className="mb-4 flex flex-wrap gap-2"
        >
          <label htmlFor="new-task-input" className="sr-only">
            New task title
          </label>
          <input
            id="new-task-input"
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Add a task..."
            className="min-h-[40px] flex-1 rounded-xl border border-slate-700 bg-[#070B13] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <select
            aria-label="Task priority"
            value={taskPriority}
            onChange={(e) => setTaskPriority(e.target.value as TaskItem['priority'])}
            className="min-h-[40px] rounded-xl border border-slate-700 bg-[#070B13] px-2.5 text-xs text-slate-200"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            type="submit"
            aria-label="Add task"
            className="flex min-h-[40px] items-center gap-1 rounded-xl bg-cyan-500 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        </form>

        <ul data-testid="tasks-list" className="max-h-56 divide-y divide-slate-800/80 overflow-y-auto">
          {tasks.length === 0 ? (
            <li className="py-3 text-xs text-slate-400">No tasks yet.</li>
          ) : (
            tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {task.completed ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-cyan-400" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                  <span
                    className={`truncate ${
                      task.completed ? 'text-slate-500 line-through' : 'text-slate-200'
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">
                    · {task.priority}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete task ${task.title}`}
                  onClick={() => onDeleteTask(task.id)}
                  className="rounded-md p-1.5 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Alarms & Reminders */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlarmClock className="h-4 w-4 text-cyan-400" />
            <h2 className="font-display text-base font-semibold text-slate-100">
              Alarms &amp; Reminders
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {alarms.filter((a) => a.enabled).length} armed
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!alarmLabel.trim()) return;
            onAddAlarm(alarmLabel.trim(), alarmTime);
            setAlarmLabel('');
          }}
          className="mb-4 flex flex-wrap gap-2"
        >
          <label htmlFor="alarm-label" className="sr-only">
            Alarm label
          </label>
          <input
            id="alarm-label"
            type="text"
            value={alarmLabel}
            onChange={(e) => setAlarmLabel(e.target.value)}
            placeholder="Reminder label..."
            className="min-h-[40px] flex-1 rounded-xl border border-slate-700 bg-[#070B13] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <label htmlFor="alarm-time" className="sr-only">
            Alarm time
          </label>
          <input
            id="alarm-time"
            type="time"
            value={alarmTime}
            onChange={(e) => setAlarmTime(e.target.value)}
            className="min-h-[40px] rounded-xl border border-slate-700 bg-[#070B13] px-2.5 font-mono text-xs text-slate-100"
          />
          <button
            type="submit"
            className="flex min-h-[40px] items-center gap-1 rounded-xl bg-cyan-500 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Set</span>
          </button>
        </form>

        <ul data-testid="alarms-list" className="max-h-56 divide-y divide-slate-800/80 overflow-y-auto">
          {alarms.length === 0 ? (
            <li className="py-3 text-xs text-slate-400">No alarms configured.</li>
          ) : (
            alarms.map((alarm) => (
              <li key={alarm.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                <div>
                  <span className="font-mono text-sm font-semibold text-cyan-300 tabular-nums">
                    {alarm.time}
                  </span>
                  <span className="mx-1.5 text-slate-500" aria-hidden="true">·</span>
                  <span className="text-slate-200">{alarm.label}</span>
                  <span className="ml-2 font-mono text-[11px] text-slate-400">
                    · {formatTimeUntilAlarm(alarm.time)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alarm.enabled}
                    aria-label={`Toggle alarm ${alarm.label}`}
                    onClick={() => onToggleAlarm(alarm.id)}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
                      alarm.enabled
                        ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {alarm.enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete alarm ${alarm.label}`}
                    onClick={() => onDeleteAlarm(alarm.id)}
                    className="rounded-md p-1.5 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Notes Manager */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-3 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-cyan-400" />
          <h2 className="font-display text-base font-semibold text-slate-100">Notes Manager</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!noteTitle.trim()) return;
            onAddNote(noteTitle.trim(), noteContent.trim());
            setNoteTitle('');
            setNoteContent('');
          }}
          className="mb-4 space-y-2"
        >
          <input
            type="text"
            aria-label="Note title"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note title..."
            className="min-h-[40px] w-full rounded-xl border border-slate-700 bg-[#070B13] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Note details"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write note details..."
              className="min-h-[40px] flex-1 rounded-xl border border-slate-700 bg-[#070B13] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[40px] rounded-xl bg-cyan-500 px-3.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Save
            </button>
          </div>
        </form>
        <ul className="max-h-48 divide-y divide-slate-800/80 overflow-y-auto">
          {notes.length === 0 ? (
            <li className="py-3 text-xs text-slate-400">No notes saved.</li>
          ) : (
            notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-2 py-2.5 text-xs">
                <div>
                  <div className="font-medium text-slate-200">{n.title}</div>
                  {n.content && <p className="mt-0.5 text-slate-400">{n.content}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`Delete note ${n.title}`}
                  onClick={() => onDeleteNote(n.id)}
                  className="rounded-md p-1.5 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Calendar Schedule */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-cyan-400" />
          <h2 className="font-display text-base font-semibold text-slate-100">
            Calendar Schedule
          </h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!eventTitle.trim()) return;
            onAddEvent(eventTitle.trim(), eventDate, eventTime, eventLocation.trim() || undefined);
            setEventTitle('');
            setEventLocation('');
          }}
          className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          <input
            type="text"
            aria-label="Event title"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder="Event title..."
            className="min-h-[40px] rounded-xl border border-slate-700 bg-[#070B13] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none sm:col-span-2"
          />
          <input
            type="date"
            aria-label="Event date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="min-h-[40px] rounded-xl border border-slate-700 bg-[#070B13] px-3 font-mono text-xs text-slate-100"
          />
          <input
            type="time"
            aria-label="Event time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            className="min-h-[40px] rounded-xl border border-slate-700 bg-[#070B13] px-3 font-mono text-xs text-slate-100"
          />
          <input
            type="text"
            aria-label="Event location"
            value={eventLocation}
            onChange={(e) => setEventLocation(e.target.value)}
            placeholder="Location (optional)"
            className="min-h-[40px] rounded-xl border border-slate-700 bg-[#070B13] px-3 text-xs text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="min-h-[40px] rounded-xl bg-cyan-500 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Schedule Event
          </button>
        </form>
        <ul className="max-h-48 divide-y divide-slate-800/80 overflow-y-auto">
          {events.length === 0 ? (
            <li className="py-3 text-xs text-slate-400">No upcoming events.</li>
          ) : (
            events.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                <div>
                  <div className="font-medium text-slate-200">{ev.title}</div>
                  <div className="font-mono text-[11px] text-slate-400">
                    {ev.date} · {ev.time}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Delete event ${ev.title}`}
                  onClick={() => onDeleteEvent(ev.id)}
                  className="rounded-md p-1.5 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Precision Calculator */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-cyan-400" />
          <h2 className="font-display text-base font-semibold text-slate-100">Calculator</h2>
        </div>
        <label htmlFor="jarvis-calc-input" className="sr-only">
          Arithmetic expression
        </label>
        <input
          id="jarvis-calc-input"
          type="text"
          value={calcInput}
          onChange={(e) => setCalcInput(e.target.value)}
          placeholder="e.g. (245 * 18) + sqrt(144)"
          className="min-h-[42px] w-full rounded-xl border border-slate-700 bg-[#070B13] px-3 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
        />
        <div className="mt-3 rounded-xl border border-slate-800 bg-[#080D16] p-3">
          {calcOutcome.ok ? (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Result</span>
              <span
                data-testid="calculator-result"
                className="font-mono text-2xl font-semibold text-cyan-300 tabular-nums"
              >
                {calcOutcome.formatted}
              </span>
            </div>
          ) : (
            <p className="text-xs text-rose-300">{calcOutcome.error}</p>
          )}
        </div>
      </section>

      {/* Multilingual Translator */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Languages className="h-4 w-4 text-cyan-400" />
          <h2 className="font-display text-base font-semibold text-slate-100">
            Multilingual Translator
          </h2>
        </div>
        <form onSubmit={handleTranslate} className="space-y-3">
          <textarea
            rows={2}
            aria-label="Text to translate"
            value={translateText}
            onChange={(e) => setTranslateText(e.target.value)}
            placeholder="Enter English, বাংলা, हिन्दी, Banglish, or Hinglish..."
            className="w-full rounded-xl border border-slate-700 bg-[#070B13] p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              aria-label="Target language"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as 'en' | 'bn' | 'hi')}
              className="min-h-[40px] rounded-xl border border-slate-700 bg-[#070B13] px-3 text-xs text-slate-200"
            >
              <option value="bn">Translate to বাংলা (Bengali)</option>
              <option value="hi">Translate to हिन्दी (Hindi)</option>
              <option value="en">Translate to English</option>
            </select>
            <button
              type="submit"
              disabled={translating || !translateText.trim()}
              className="min-h-[40px] rounded-xl bg-cyan-500 px-4 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
            >
              {translating ? 'Translating...' : 'Translate'}
            </button>
          </div>
        </form>
        {translateError && <p className="mt-2 text-xs text-rose-300">{translateError}</p>}
        {translatedOutput && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-[#080D16] p-3 text-xs text-slate-200">
            <div className="mb-1 flex justify-between text-slate-400">
              <span>Translation</span>
              <button
                type="button"
                onClick={() => onSpeakText(translatedOutput)}
                className="text-cyan-300 hover:underline"
              >
                Speak
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{translatedOutput}</p>
          </div>
        )}
      </section>
    </div>
  );
};
