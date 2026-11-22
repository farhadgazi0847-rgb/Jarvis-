import React from 'react';
import {
  Wifi,
  Bluetooth,
  BellOff,
  Play,
  Pause,
  Camera,
  MapPin,
  Settings,
  Smartphone,
  Shield,
  MessageSquare,
  Phone,
  Bell,
} from 'lucide-react';
import type {
  AndroidActionRequest,
  AndroidDeviceState,
  AndroidPermissionKey,
  AndroidPermissionMap,
  BrowserMicPermissionState,
  CommandLogEntry,
  SimulatedNotification,
} from '../types/jarvis';

interface DeviceControlPanelProps {
  deviceState: AndroidDeviceState;
  permissions: AndroidPermissionMap;
  browserMicStatus: BrowserMicPermissionState;
  notifications: SimulatedNotification[];
  commandLogs: CommandLogEntry[];
  onTogglePermission: (key: AndroidPermissionKey) => void;
  onRequestBrowserMic: () => void;
  onUpdateDeviceState: (patch: Partial<AndroidDeviceState>) => void;
  onDispatchCommand: (req: AndroidActionRequest, label: string) => void;
  onReadNotifications: () => void;
}

const PERMISSION_DESCRIPTIONS: Array<{ key: AndroidPermissionKey; label: string; detail: string }> = [
  { key: 'RECORD_AUDIO', label: 'Microphone (RECORD_AUDIO)', detail: 'Voice commands & wake word' },
  { key: 'SEND_SMS', label: 'Send SMS (SEND_SMS)', detail: 'Confirmation required before send' },
  { key: 'CALL_PHONE', label: 'Phone Calls (CALL_PHONE)', detail: 'Confirmation required before dial' },
  { key: 'READ_NOTIFICATIONS', label: 'Notifications Listener', detail: 'Read & summarize alerts' },
  { key: 'SET_ALARM', label: 'Alarms (SET_ALARM)', detail: 'Create clock alarms' },
  { key: 'CAMERA', label: 'Camera (CAMERA)', detail: 'Launch camera capture' },
  { key: 'ACCESS_FINE_LOCATION', label: 'Location (FINE_LOCATION)', detail: 'Maps & local weather' },
  { key: 'READ_CALENDAR', label: 'Calendar (READ_CALENDAR)', detail: 'Schedule briefings' },
];

export const DeviceControlPanel: React.FC<DeviceControlPanelProps> = ({
  deviceState,
  permissions,
  browserMicStatus,
  notifications,
  commandLogs,
  onTogglePermission,
  onRequestBrowserMic,
  onUpdateDeviceState,
  onDispatchCommand,
  onReadNotifications,
}) => {
  return (
    <div className="space-y-6">
      {/* Section 1: Android Device Bridge Quick Controls */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Android Device Control Bridge
            </h2>
            <p className="text-xs text-slate-400">
              Web sandbox simulates hardware toggles &amp; dispatches real tel/sms/maps/web URIs where supported.
            </p>
          </div>
          {deviceState.lastOpenedApp && (
            <span className="font-mono text-xs text-cyan-400">
              Active App: {deviceState.lastOpenedApp}
            </span>
          )}
        </div>

        {/* Interactive Hardware & Media Controls */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() =>
              onDispatchCommand(
                { action: 'adjust_setting', target: 'wifi', value: deviceState.wifiEnabled ? 'off' : 'on' },
                'Toggle Wi-Fi'
              )
            }
            className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
              deviceState.wifiEnabled
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-700 bg-[#080D16] text-slate-400'
            }`}
          >
            <Wifi className="h-4 w-4 shrink-0" />
            <div>
              <div>Wi-Fi</div>
              <div className="font-mono text-[11px] opacity-80">
                {deviceState.wifiEnabled ? 'Connected' : 'Off'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onDispatchCommand(
                {
                  action: 'adjust_setting',
                  target: 'bluetooth',
                  value: deviceState.bluetoothEnabled ? 'off' : 'on',
                },
                'Toggle Bluetooth'
              )
            }
            className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
              deviceState.bluetoothEnabled
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-700 bg-[#080D16] text-slate-400'
            }`}
          >
            <Bluetooth className="h-4 w-4 shrink-0" />
            <div>
              <div>Bluetooth</div>
              <div className="font-mono text-[11px] opacity-80">
                {deviceState.bluetoothEnabled ? 'Paired' : 'Off'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onDispatchCommand(
                {
                  action: 'adjust_setting',
                  target: 'dnd',
                  value: deviceState.doNotDisturb ? 'off' : 'on',
                },
                'Toggle Do Not Disturb'
              )
            }
            className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
              deviceState.doNotDisturb
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                : 'border-slate-700 bg-[#080D16] text-slate-400'
            }`}
          >
            <BellOff className="h-4 w-4 shrink-0" />
            <div>
              <div>Do Not Disturb</div>
              <div className="font-mono text-[11px] opacity-80">
                {deviceState.doNotDisturb ? 'Active' : 'Off'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onDispatchCommand(
                {
                  action: 'control_media',
                  target: 'playback',
                  value: deviceState.mediaPlaying ? 'pause' : 'play',
                },
                deviceState.mediaPlaying ? 'Pause Media' : 'Play Media'
              )
            }
            className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
              deviceState.mediaPlaying
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-700 bg-[#080D16] text-slate-300'
            }`}
          >
            {deviceState.mediaPlaying ? (
              <Pause className="h-4 w-4 shrink-0" />
            ) : (
              <Play className="h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="truncate">{deviceState.mediaPlaying ? 'Playing' : 'Paused'}</div>
              <div className="truncate font-mono text-[11px] opacity-80">
                {deviceState.mediaTrack}
              </div>
            </div>
          </button>
        </div>

        {/* Sliders: Brightness & Volume */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-[#080D16] p-3">
            <div className="mb-1.5 flex justify-between text-xs">
              <label htmlFor="device-brightness" className="text-slate-300">
                Display Brightness
              </label>
              <span className="font-mono text-cyan-400 tabular-nums">{deviceState.brightness}%</span>
            </div>
            <input
              id="device-brightness"
              type="range"
              min={10}
              max={100}
              value={deviceState.brightness}
              onChange={(e) => onUpdateDeviceState({ brightness: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#080D16] p-3">
            <div className="mb-1.5 flex justify-between text-xs">
              <label htmlFor="device-volume" className="text-slate-300">
                Assistant &amp; Media Volume
              </label>
              <span className="font-mono text-cyan-400 tabular-nums">{deviceState.volume}%</span>
            </div>
            <input
              id="device-volume"
              type="range"
              min={0}
              max={100}
              value={deviceState.volume}
              onChange={(e) => onUpdateDeviceState({ volume: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>

        {/* Modular Intent Launchers */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDispatchCommand({ action: 'launch_camera' }, 'Open Camera')}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-[#080D16] px-3 py-2 text-xs text-slate-200 hover:border-cyan-400/60"
          >
            <Camera className="h-3.5 w-3.5 text-cyan-400" />
            <span>Launch Camera</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onDispatchCommand({ action: 'launch_maps', target: 'Dhaka Airport' }, 'Launch Maps')
            }
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-[#080D16] px-3 py-2 text-xs text-slate-200 hover:border-cyan-400/60"
          >
            <MapPin className="h-3.5 w-3.5 text-cyan-400" />
            <span>Launch Google Maps</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onDispatchCommand({ action: 'open_app', target: 'YouTube' }, 'Open YouTube')
            }
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-[#080D16] px-3 py-2 text-xs text-slate-200 hover:border-cyan-400/60"
          >
            <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
            <span>Open YouTube</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onDispatchCommand({ action: 'open_settings', target: 'wifi' }, 'Open Wi-Fi Settings')
            }
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-[#080D16] px-3 py-2 text-xs text-slate-200 hover:border-cyan-400/60"
          >
            <Settings className="h-3.5 w-3.5 text-cyan-400" />
            <span>Phone Settings</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onDispatchCommand(
                { action: 'send_sms', target: '+8801700000000', message: 'Reached safely.' },
                'Send SMS (Sensitive)'
              )
            }
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-xs text-amber-200 hover:border-amber-400/70"
          >
            <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
            <span>Test SMS Gate</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onDispatchCommand(
                { action: 'make_call', target: '+8801700000000' },
                'Place Call (Sensitive)'
              )
            }
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-xs text-amber-200 hover:border-amber-400/70"
          >
            <Phone className="h-3.5 w-3.5 text-amber-400" />
            <span>Test Call Gate</span>
          </button>
        </div>
      </section>

      {/* Section 2: Runtime Permissions & Notification Assistant */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-400" />
            <h3 className="font-display text-base font-semibold text-slate-100">
              Runtime Permissions
            </h3>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Disable any permission to verify that JARVIS strictly respects Android security policies.
          </p>
          <div className="divide-y divide-slate-800/80">
            {PERMISSION_DESCRIPTIONS.map((perm) => {
              const granted = permissions[perm.key];
              const isMic = perm.key === 'RECORD_AUDIO';
              return (
                <div key={perm.key} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-200">{perm.label}</span>
                      {isMic && (
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                            browserMicStatus === 'granted'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : browserMicStatus === 'denied' || browserMicStatus === 'unsupported'
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          Browser:{' '}
                          {browserMicStatus === 'granted'
                            ? 'Granted'
                            : browserMicStatus === 'denied'
                            ? 'Blocked'
                            : browserMicStatus === 'unsupported'
                            ? 'Unavailable'
                            : 'Prompt'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">{perm.detail}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isMic && browserMicStatus !== 'granted' && browserMicStatus !== 'unsupported' && (
                      <button
                        type="button"
                        onClick={onRequestBrowserMic}
                        className="min-h-[34px] rounded-lg border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/25"
                      >
                        {browserMicStatus === 'denied' ? 'Retry Browser Mic' : 'Grant Browser Mic'}
                      </button>
                    )}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={granted}
                      aria-label={`Toggle ${perm.label}`}
                      onClick={() => onTogglePermission(perm.key)}
                      className={`min-h-[34px] shrink-0 rounded-lg border px-3 py-1 font-mono text-[11px] font-medium transition-colors ${
                        granted
                          ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {granted ? 'Granted' : 'Denied'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Notification Assistant + Intent Log */}
        <section className="space-y-6">
          <div className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-cyan-400" />
                <h3 className="font-display text-base font-semibold text-slate-100">
                  Notification Assistant
                </h3>
              </div>
              <button
                type="button"
                onClick={onReadNotifications}
                className="min-h-[36px] rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                Read Aloud
              </button>
            </div>
            {!permissions.READ_NOTIFICATIONS ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                Notification access is disabled. Grant &ldquo;Notifications Listener&rdquo; to let JARVIS read alerts.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800/80">
                {notifications.map((n) => (
                  <li key={n.id} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-medium text-cyan-300">
                        {n.app} · {n.sender}
                      </span>
                      <span className="font-mono tabular-nums">{n.time}</span>
                    </div>
                    <p className="mt-1 text-slate-200">{n.preview}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-slate-100">
              Intent Execution Audit Log
            </h3>
            {commandLogs.length === 0 ? (
              <p className="text-xs text-slate-400">No Android intents dispatched in this session yet.</p>
            ) : (
              <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {commandLogs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-xl border border-slate-800 bg-[#080D16] p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-200">{log.actionSummary}</span>
                      <span
                        className={`font-mono text-[11px] ${
                          log.status === 'executed'
                            ? 'text-emerald-400'
                            : log.status === 'pending'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    {log.intentAction && (
                      <div className="mt-1 font-mono text-[11px] text-slate-400">
                        {log.intentAction} · {log.timestamp}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
