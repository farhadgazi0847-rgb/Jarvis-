# JARVIS AI — Natural Voice, Dynamic Multilingual & Wake-Word Enhancement

Implement natural human-like voice synthesis (Kore), robust wake-word listening ("Hey Jarvis", "Jarvis", "JS") with VAD silence auto-stop, and dynamic multilingual auto-detection across Bengali, Hindi, English, Banglish, and Hinglish.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Confirmed Voice Persona**: `Kore` (Warm & clear natural human-like voice persona for Gemini TTS).
> - **Confirmed Wake Word & Mic**: "Hey Jarvis", "Jarvis", and "JS" triggers with silence auto-stop and auto-submit.
> - **Confirmed Language Detection**: Dynamic auto-detection for Bengali, Hindi, English, Banglish, and Hinglish without locking to a single language.

## 1. Overview & Core Concept

- **What It Does**: Upgrades JARVIS AI to deliver ultra-natural speech responses using the `Kore` warm voice persona, seamless dynamic multilingual detection (Bengali, Hindi, English, Banglish, Hinglish), and reliable wake-word detection ("Hey Jarvis", "Jarvis", "JS") with automatic VAD silence submission.
- **Key Value**: Human-like conversational experience without robotic delivery, hands-free wake-word activation, and zero friction in speech recognition and auto-language replies.

## 2. User Experience & Visual Design

- **Visual Theme**: Iron Man holographic dark black background (`#06090F`), electric cyan/blue HUD elements, animated circular AI core, and responsive audio waveform visualizer.
- **Natural Voice & Audio Feed**: Auto-speak responses enabled by default with human-like warmth (`Kore`), plus clean audio waveform animation during speech and listening.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Default voice persona updated to `Kore` for warmth and natural intonation.
- **Decision 2**: Expanded wake-word matching to include `"Hey Jarvis"`, `"Jarvis"`, and `"JS"` for fast hands-free operation.

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│               JARVIS AI Frontend (React)               │
│  - Wake-Word Listeners ("Hey Jarvis", "Jarvis", "JS")  │
│  - SpeechRecognition + VAD Silence Auto-Submit         │
│  - Audio Visualizer & Kore TTS Player                  │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
                ▼                        ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│ /api/jarvis/chat          │    │ /api/jarvis/tts           │
│ - Dynamic Lang Detect     │    │ - Kore Warm Voice Persona │
│ - Gemini Flash-Lite Fast  │    │ - Clean Speech Text Prep  │
└───────────────────────────┘    └───────────────────────────┘
```
