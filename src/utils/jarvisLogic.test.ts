import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMathExpression,
  detectLanguageHint,
  matchesWakeWord,
  evaluateDeviceCommandPolicy,
  formatTimeUntilAlarm,
  resolveSpeechRecognitionLocale,
  normalizeAudioMimeType,
  classifyMicrophoneFailure,
  detectSpeechIntent,
  shouldAutoSpeak,
  prepareSpeechText,
  measureSpeechEnergy,
} from './jarvisLogic';
import type { AndroidPermissionMap } from '../types/jarvis';

const ALL_GRANTED: AndroidPermissionMap = {
  RECORD_AUDIO: true,
  SEND_SMS: true,
  CALL_PHONE: true,
  READ_NOTIFICATIONS: true,
  SET_ALARM: true,
  CAMERA: true,
  ACCESS_FINE_LOCATION: true,
  READ_CALENDAR: true,
};

test('evaluateMathExpression handles standard arithmetic, parentheses, and sqrt', () => {
  const r1 = evaluateMathExpression('245 * 18 + 90');
  assert.equal(r1.ok, true);
  if (r1.ok) assert.equal(r1.result, 4500);

  const r2 = evaluateMathExpression('(10 + 5) * 2 ^ 3 - sqrt(81)');
  assert.equal(r2.ok, true);
  if (r2.ok) assert.equal(r2.result, 111);
});

test('evaluateMathExpression rejects division by zero and invalid expressions', () => {
  const zero = evaluateMathExpression('10 / (5 - 5)');
  assert.equal(zero.ok, false);

  const unsafe = evaluateMathExpression('process.exit()');
  assert.equal(unsafe.ok, false);
});

test('detectLanguageHint recognizes Bengali, Hindi, Banglish, Hinglish, and English', () => {
  assert.equal(detectLanguageHint('আজকের আবহাওয়া কেমন?').code, 'bn');
  assert.equal(detectLanguageHint('आज का मौसम कैसा है?').code, 'hi');
  const banglish = detectLanguageHint('ami kemon acho jarvis');
  assert.equal(banglish.code, 'bn');
  assert.equal(banglish.mixedHint, 'banglish');
  const hinglish = detectLanguageHint('bhai mujhe weather batao');
  assert.equal(hinglish.code, 'hi');
  assert.equal(hinglish.mixedHint, 'hinglish');
  assert.equal(detectLanguageHint('Open Google Maps for Dhaka').code, 'en');
});

test('matchesWakeWord detects Hey Jarvis, Jarvis, and JS and extracts trailing command', () => {
  const m1 = matchesWakeWord('Hey Jarvis, set an alarm for 7 AM', ['Hey Jarvis', 'Jarvis', 'JS']);
  assert.equal(m1.matched, true);
  assert.equal(m1.phrase, 'hey jarvis');
  assert.equal(m1.remainder, 'set an alarm for 7 am');

  const m2 = matchesWakeWord('JS what is the time', ['Hey Jarvis', 'Jarvis', 'JS']);
  assert.equal(m2.matched, true);
  assert.equal(m2.phrase, 'js');
  assert.equal(m2.remainder, 'what is the time');

  const m3 = matchesWakeWord('Turn on the living room lights', ['Hey Jarvis', 'Jarvis', 'JS']);
  assert.equal(m3.matched, false);
});

test('evaluateDeviceCommandPolicy enforces permissions and sensitive confirmations', () => {
  const smsAllowed = evaluateDeviceCommandPolicy(
    { action: 'send_sms', target: '+8801700000000', message: 'On my way' },
    ALL_GRANTED
  );
  assert.equal(smsAllowed.allowed, true);
  assert.equal(smsAllowed.requiresConfirmation, true);
  assert.equal(smsAllowed.intentSpec.androidAction, 'android.intent.action.SENDTO');

  const smsBlocked = evaluateDeviceCommandPolicy(
    { action: 'send_sms', target: 'Alex', message: 'Hi' },
    { ...ALL_GRANTED, SEND_SMS: false }
  );
  assert.equal(smsBlocked.allowed, false);
  assert.equal(smsBlocked.missingPermission, 'SEND_SMS');

  const mapsSafe = evaluateDeviceCommandPolicy(
    { action: 'launch_maps', target: 'Dhaka Airport' },
    ALL_GRANTED
  );
  assert.equal(mapsSafe.allowed, true);
  assert.equal(mapsSafe.requiresConfirmation, false);
  assert.ok(mapsSafe.intentSpec.webLaunchUrl?.includes('google.com/maps'));
});

test('formatTimeUntilAlarm calculates upcoming duration accurately', () => {
  const ref = new Date('2026-11-22T10:00:00');
  assert.equal(formatTimeUntilAlarm('11:30', ref), 'in 1h 30m');
  assert.equal(formatTimeUntilAlarm('09:30', ref), 'in 23h 30m');
});

test('resolveSpeechRecognitionLocale and normalizeAudioMimeType handle edge cases', () => {
  assert.equal(resolveSpeechRecognitionLocale('bn', 'en-US'), 'bn-BD');
  assert.equal(resolveSpeechRecognitionLocale('hi', 'en-US'), 'hi-IN');
  assert.equal(resolveSpeechRecognitionLocale('auto', 'bn-IN'), 'bn-BD');
  assert.equal(resolveSpeechRecognitionLocale('auto', 'hi-IN'), 'hi-IN');
  assert.equal(resolveSpeechRecognitionLocale('auto', 'en-GB'), 'en-US');

  assert.equal(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normalizeAudioMimeType('audio/mp4; codecs=mp4a.40.2'), 'audio/mp4');
  assert.equal(normalizeAudioMimeType(''), 'audio/webm');
});

test('classifyMicrophoneFailure differentiates permission denial, iframe policy block, service fallback, and device missing', () => {
  const denied = classifyMicrophoneFailure('NotAllowedError', { isEmbeddedFrame: true });
  assert.equal(denied.kind, 'permission_denied');
  assert.equal(denied.canRetryPermission, true);
  assert.equal(denied.shouldFallbackToRecorder, false);

  const frameBlocked = classifyMicrophoneFailure('NotAllowedError', { frameAllowsMic: false });
  assert.equal(frameBlocked.kind, 'frame_blocked');
  assert.equal(frameBlocked.canRetryPermission, true);

  const insecure = classifyMicrophoneFailure('SecurityError', { isSecureContext: false });
  assert.equal(insecure.kind, 'insecure_context');
  assert.equal(insecure.canRetryPermission, false);

  const fallback = classifyMicrophoneFailure('audio-capture');
  assert.equal(fallback.kind, 'service_fallback');
  assert.equal(fallback.shouldFallbackToRecorder, true);

  const missing = classifyMicrophoneFailure('NotFoundError');
  assert.equal(missing.kind, 'no_device');
  assert.equal(missing.shouldFallbackToRecorder, false);
});

test('detectSpeechIntent and shouldAutoSpeak trigger voice output for Banglish, Bengali, Hindi, and Voice-Only mode', () => {
  assert.equal(detectSpeechIntent('Ajker news shonao text korbe na'), true);
  assert.equal(detectSpeechIntent('Ami ekta golpo sunte chai'), true);
  assert.equal(detectSpeechIntent('আজকের খবর শোনাও'), true);
  assert.equal(detectSpeechIntent('आज की खबर सुनाओ'), true);
  assert.equal(detectSpeechIntent('Calculate 12 * 12'), false);

  const normalAuto = shouldAutoSpeak(
    { autoSpeakResponses: true, speechOnlyMode: false },
    'What is the time?'
  );
  assert.equal(normalAuto.autoSpeak, true);
  assert.equal(normalAuto.speechOnly, false);

  const explicitSpeech = shouldAutoSpeak(
    { autoSpeakResponses: false, speechOnlyMode: false },
    'Ami kisu sunte chai, voice e bolo'
  );
  assert.equal(explicitSpeech.autoSpeak, true);
  assert.equal(explicitSpeech.speechOnly, true);

  const globalVoiceOnly = shouldAutoSpeak(
    { autoSpeakResponses: false, speechOnlyMode: true },
    'Hello Jarvis'
  );
  assert.equal(globalVoiceOnly.autoSpeak, true);
  assert.equal(globalVoiceOnly.speechOnly, true);
});

test('prepareSpeechText strips markdown/URLs cleanly and measureSpeechEnergy detects voice activity', () => {
  const clean = prepareSpeechText('**Result:** Value is `512`. See https://example.com/details for more.', 100);
  assert.equal(clean, 'Result: Value is 512. See for more.');

  const quiet = measureSpeechEnergy([2, 4, 3, 5, 2, 0, 1, 2]);
  assert.equal(quiet.isSpeech, false);

  const loud = measureSpeechEnergy([90, 110, 85, 100, 95, 80, 75, 88]);
  assert.equal(loud.isSpeech, true);
  assert.ok(loud.level > 0.3);
});

