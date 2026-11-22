export type LanguageCode = 'auto' | 'en' | 'bn' | 'hi';
export type DetectedLanguage = 'en' | 'bn' | 'hi';

export type AssistantCoreState =
  | 'idle'
  | 'wake_listening'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'awaiting_confirmation'
  | 'error';

export type JarvisVoiceName = 'Charon' | 'Fenrir' | 'Puck' | 'Kore' | 'Zephyr' | 'browser';
export type JarvisPersonality = 'classic' | 'concise' | 'warm';

export type AndroidPermissionKey =
  | 'RECORD_AUDIO'
  | 'SEND_SMS'
  | 'CALL_PHONE'
  | 'READ_NOTIFICATIONS'
  | 'SET_ALARM'
  | 'CAMERA'
  | 'ACCESS_FINE_LOCATION'
  | 'READ_CALENDAR';

export type AndroidPermissionMap = Record<AndroidPermissionKey, boolean>;

export type BrowserMicPermissionState =
  | 'checking'
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported';

export type AndroidActionType =
  | 'open_app'
  | 'open_settings'
  | 'send_sms'
  | 'make_call'
  | 'control_media'
  | 'adjust_setting'
  | 'read_notifications'
  | 'open_website'
  | 'launch_maps'
  | 'launch_camera';

export interface AndroidActionRequest {
  action: AndroidActionType;
  target?: string;
  message?: string;
  value?: string;
  reason?: string;
}

export interface AndroidIntentSpec {
  androidAction: string;
  uriOrPackage: string;
  extrasSummary: string;
  isSensitive: boolean;
  requiredPermission: AndroidPermissionKey | null;
  webLaunchUrl?: string;
}

export interface PendingActionConfirmation {
  id: string;
  request: AndroidActionRequest;
  intentSpec: AndroidIntentSpec;
  explanation: string;
  createdAt: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  detectedLanguage?: DetectedLanguage;
  sources?: GroundingSource[];
  toolEvents?: string[];
  pendingConfirmation?: PendingActionConfirmation;
  confirmationStatus?: 'pending' | 'approved' | 'denied';
  spokenOnly?: boolean;
  error?: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface AlarmItem {
  id: string;
  label: string;
  time: string; // HH:MM 24h
  enabled: boolean;
  triggeredToday?: boolean;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location?: string;
}

export interface MemoryItem {
  id: string;
  fact: string;
  category: 'preference' | 'contact' | 'routine' | 'general';
  createdAt: string;
}

export interface CommandLogEntry {
  id: string;
  command: string;
  actionSummary: string;
  status: 'executed' | 'blocked_permission' | 'denied_by_user' | 'pending';
  timestamp: string;
  intentAction?: string;
}

export interface SimulatedNotification {
  id: string;
  app: string;
  sender: string;
  preview: string;
  time: string;
  read: boolean;
}

export interface AndroidDeviceState {
  wifiEnabled: boolean;
  bluetoothEnabled: boolean;
  doNotDisturb: boolean;
  brightness: number; // 0-100
  volume: number; // 0-100
  mediaPlaying: boolean;
  mediaTrack: string;
  lastOpenedApp: string | null;
}

export interface JarvisSettings {
  language: LanguageCode;
  voice: JarvisVoiceName;
  personality: JarvisPersonality;
  wakeWordEnabled: boolean;
  wakePhrases: string[];
  autoSpeakResponses: boolean;
  speechOnlyMode: boolean;
  fastMode: boolean;
  offlineFallbackEnabled: boolean;
}
