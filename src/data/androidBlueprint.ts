export interface KotlinModuleSpec {
  id: string;
  filename: string;
  title: string;
  layer: string;
  summary: string;
  code: string;
}

export const ANDROID_ARCHITECTURE_SUMMARY = [
  {
    title: '01. Foreground Wake-Word Engine',
    detail:
      'Runs inside a foreground service (FOREGROUND_SERVICE_TYPE_MICROPHONE) with a persistent notification, AudioRecord 16kHz mono PCM ring buffer, and on-device wake-word spotting (Porcupine / Vosk / Sherpa-ONNX) before invoking SpeechRecognizer.',
  },
  {
    title: '02. Multilingual Voice Pipeline',
    detail:
      'Captures Bengali (bn-BD / bn-IN), Hindi (hi-IN), English (en-US), and mixed Banglish/Hinglish via Android SpeechRecognizer or Gemini audio transcription, paired with Android TextToSpeech or Gemini TTS playback.',
  },
  {
    title: '03. Modular Intent & Security Gate',
    detail:
      'Every device command checks ContextCompat.checkSelfPermission at runtime. Sensitive intents (CALL_PHONE, SEND_SMS, NotificationListener) require explicit user confirmation on the Compose HUD before execution.',
  },
  {
    title: '04. Backend Gemini Proxy',
    detail:
      'Keeps GEMINI_API_KEY off the APK binary by routing tool-calling, Google Search grounding, and conversation state through an authenticated HTTPS backend.',
  },
];

export const ANDROID_BLUEPRINT_FILES: KotlinModuleSpec[] = [
  {
    id: 'manifest',
    filename: 'AndroidManifest.xml',
    title: 'Permissions & Foreground Service Declaration',
    layer: 'Manifest & Privacy',
    summary:
      'Declares runtime permissions, foreground service microphone type for Android 14+, NotificationListenerService, and package visibility queries.',
    code: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.jarvis.assistant">

    <!-- Network & Voice -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Optional Device Control (Requested only when user enables feature) -->
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.SEND_SMS" />
    <uses-permission android:name="com.android.alarm.permission.SET_ALARM" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_CALENDAR" />
    <uses-permission android:name="android.permission.WRITE_CALENDAR" />

    <queries>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
    </queries>

    <application
        android:name=".JarvisApplication"
        android:allowBackup="false"
        android:label="JARVIS AI">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Persistent Wake-Word Foreground Service (User-Controlled) -->
        <service
            android:name=".voice.JarvisWakeWordService"
            android:exported="false"
            android:foregroundServiceType="microphone" />

        <!-- Explicit Permission Notification Reader -->
        <service
            android:name=".device.JarvisNotificationListener"
            android:exported="true"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
    </application>
</manifest>`,
  },
  {
    id: 'wakeword',
    filename: 'JarvisWakeWordService.kt',
    title: 'Low-Battery Wake-Word Foreground Service',
    layer: 'Wake-Word Architecture',
    summary:
      'Listens for "Hey Jarvis" / "Jarvis" using 16kHz PCM frames only when explicitly enabled, displays a persistent privacy notification, and stops immediately when toggled off.',
    code: `package com.jarvis.assistant.voice

import android.Manifest
import android.app.*
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.*

class JarvisWakeWordService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var audioRecord: AudioRecord? = null
    @Volatile private var isListening = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopWakeWordLoop()
            stopSelf()
            return START_NOT_STICKY
        }

        val hasMic = ContextCompat.checkSelfPermission(
            this, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasMic) {
            stopSelf()
            return START_NOT_STICKY
        }

        createNotificationChannel()
        val notification = buildPersistentNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        startWakeWordLoop()
        return START_STICKY
    }

    private fun startWakeWordLoop() {
        if (isListening) return
        isListening = true

        val sampleRate = 16000
        val frameSize = 512 // 32ms low-power frame
        val minBuf = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(frameSize * 4)

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            minBuf
        )

        audioRecord?.startRecording()
        serviceScope.launch {
            val buffer = ShortArray(frameSize)
            while (isActive && isListening) {
                val read = audioRecord?.read(buffer, 0, frameSize) ?: 0
                if (read > 0) {
                    // Energy gate avoids running wake-word inference during silence
                    val rms = computeRms(buffer, read)
                    if (rms > SILENCE_RMS_THRESHOLD) {
                        val detected = WakeWordEngine.processFrame(buffer) // Porcupine / Sherpa-ONNX
                        if (detected) {
                            onWakeWordDetected()
                        }
                    }
                }
            }
        }
    }

    private fun onWakeWordDetected() {
        val launchIntent = Intent(ACTION_WAKE_TRIGGERED).apply {
            setPackage(packageName)
        }
        sendBroadcast(launchIntent)
    }

    private fun stopWakeWordLoop() {
        isListening = false
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
    }

    override fun onDestroy() {
        stopWakeWordLoop()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun computeRms(samples: ShortArray, count: Int): Double {
        var sum = 0.0
        for (i in 0 until count) sum += samples[i] * samples[i]
        return kotlin.math.sqrt(sum / count)
    }

    private fun buildPersistentNotification(): Notification {
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, JarvisWakeWordService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("JARVIS Wake-Word Active")
            .setContentText("Listening locally for \"Hey Jarvis\". Tap Pause to disable.")
            .setOngoing(true)
            .addAction(0, "Pause Mic", stopIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "JARVIS Voice Wake", NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "jarvis_wake_channel"
        const val NOTIFICATION_ID = 4042
        const val ACTION_STOP = "com.jarvis.assistant.STOP_WAKE"
        const val ACTION_WAKE_TRIGGERED = "com.jarvis.assistant.WAKE_TRIGGERED"
        private const val SILENCE_RMS_THRESHOLD = 320.0
    }
}`,
  },
  {
    id: 'controller',
    filename: 'AndroidDeviceController.kt',
    title: 'Modular Android Intent & Permission Controller',
    layer: 'Device Control',
    summary:
      'Executes approved Android actions (Apps, Settings, SMS, Calls, Alarms, Maps, Media, Camera) with strict runtime permission validation and confirmation gating.',
    code: `package com.jarvis.assistant.device

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.Uri
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings
import android.view.KeyEvent
import androidx.core.content.ContextCompat

sealed class DeviceResult {
    data class Executed(val summary: String) : DeviceResult()
    data class NeedsConfirmation(val prompt: String, val pendingAction: () -> DeviceResult) : DeviceResult()
    data class MissingPermission(val permission: String) : DeviceResult()
    data class Failed(val reason: String) : DeviceResult()
}

class AndroidDeviceController(private val context: Context) {

    fun openApp(packageName: String): DeviceResult {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: return DeviceResult.Failed("Application $packageName is not installed.")
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launchIntent)
        return DeviceResult.Executed("Opened $packageName")
    }

    fun openSettings(section: String): DeviceResult {
        val action = when (section.lowercase()) {
            "wifi", "wi-fi" -> Settings.ACTION_WIFI_SETTINGS
            "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
            "display", "brightness" -> Settings.ACTION_DISPLAY_SETTINGS
            "sound", "volume" -> Settings.ACTION_SOUND_SETTINGS
            else -> Settings.ACTION_SETTINGS
        }
        context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return DeviceResult.Executed("Navigated to $section settings")
    }

    fun requestSms(phoneOrName: String, body: String): DeviceResult {
        if (!hasPermission(Manifest.permission.SEND_SMS)) {
            return DeviceResult.MissingPermission(Manifest.permission.SEND_SMS)
        }
        return DeviceResult.NeedsConfirmation(
            prompt = "Send SMS to $phoneOrName: \"$body\"?",
            pendingAction = {
                val smsIntent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$phoneOrName")).apply {
                    putExtra("sms_body", body)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(smsIntent)
                DeviceResult.Executed("Opened SMS composer for $phoneOrName")
            }
        )
    }

    fun requestCall(phoneNumber: String): DeviceResult {
        if (!hasPermission(Manifest.permission.CALL_PHONE)) {
            return DeviceResult.MissingPermission(Manifest.permission.CALL_PHONE)
        }
        return DeviceResult.NeedsConfirmation(
            prompt = "Place phone call to $phoneNumber?",
            pendingAction = {
                val callIntent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$phoneNumber"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(callIntent)
                DeviceResult.Executed("Calling $phoneNumber")
            }
        )
    }

    fun setAlarm(hour: Int, minute: Int, label: String): DeviceResult {
        if (!hasPermission("com.android.alarm.permission.SET_ALARM")) {
            return DeviceResult.MissingPermission("SET_ALARM")
        }
        val alarmIntent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
            putExtra(AlarmClock.EXTRA_HOUR, hour)
            putExtra(AlarmClock.EXTRA_MINUTES, minute)
            putExtra(AlarmClock.EXTRA_MESSAGE, label)
            putExtra(AlarmClock.EXTRA_SKIP_UI, false)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(alarmIntent)
        return DeviceResult.Executed("Alarm set for %02d:%02d".format(hour, minute))
    }

    fun launchMaps(query: String): DeviceResult {
        val uri = Uri.parse("geo:0,0?q=\${Uri.encode(query)}")
        val mapIntent = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage("com.google.android.apps.maps")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(mapIntent)
        return DeviceResult.Executed("Launched Maps for \"$query\"")
    }

    fun controlMedia(command: String): DeviceResult {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val keyCode = when (command.lowercase()) {
            "play", "pause", "toggle" -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
            "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
            "previous" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
            else -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
        }
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
        return DeviceResult.Executed("Media command executed: $command")
    }

    fun launchCamera(): DeviceResult {
        if (!hasPermission(Manifest.permission.CAMERA)) {
            return DeviceResult.MissingPermission(Manifest.permission.CAMERA)
        }
        context.startActivity(
            Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        return DeviceResult.Executed("Camera opened")
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}`,
  },
  {
    id: 'voice',
    filename: 'JarvisVoicePipeline.kt',
    title: 'Multilingual SpeechRecognizer & TextToSpeech',
    layer: 'Bengali / Hindi / English Voice',
    summary:
      'Supports Bengali, Hindi, English, and offline fallback speech synthesis + recognition with language switching.',
    code: `package com.jarvis.assistant.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import java.util.Locale

class JarvisVoicePipeline(
    private val context: Context,
    private val onTranscript: (String) -> Unit,
    private val onError: (String) -> Unit
) : TextToSpeech.OnInitListener {

    private val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
    private var tts: TextToSpeech? = TextToSpeech(context, this)
    private var ttsReady = false

    fun startListening(languageTag: String = "bn-BD") {
        // Supports "bn-BD", "bn-IN", "hi-IN", "en-US"
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false)
        }

        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (!text.isNullOrBlank()) onTranscript(text)
            }
            override fun onError(error: Int) = onError("SpeechRecognizer error code: $error")
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        recognizer.startListening(intent)
    }

    fun speak(text: String, languageCode: String) {
        if (!ttsReady) return
        val locale = when (languageCode) {
            "bn" -> Locale("bn", "BD")
            "hi" -> Locale("hi", "IN")
            else -> Locale.US
        }
        tts?.language = locale
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "jarvis_utterance")
    }

    override fun onInit(status: Int) {
        ttsReady = (status == TextToSpeech.SUCCESS)
    }

    fun release() {
        recognizer.destroy()
        tts?.shutdown()
    }
}`,
  },
  {
    id: 'compose',
    filename: 'JarvisHudScreen.kt',
    title: 'Jetpack Compose Holographic Core HUD',
    layer: 'UI / Jetpack Compose',
    summary:
      'Draws the animated circular JARVIS core with rotating arcs, audio amplitude rings, and thumb-accessible microphone CTA in Jetpack Compose.',
    code: `package com.jarvis.assistant.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

@Composable
fun JarvisCoreCanvas(isListening: Boolean, audioLevel: Float, modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "coreRotation")
    val outerAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(18000, easing = LinearEasing)),
        label = "outerAngle"
    )
    val innerAngle by infiniteTransition.animateFloat(
        initialValue = 360f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(11000, easing = LinearEasing)),
        label = "innerAngle"
    )

    val cyan = Color(0xFF06B6D4)
    val amber = Color(0xFFF59E0B)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF06090F)),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(220.dp)) {
            val baseRadius = size.minDimension / 2f
            drawArc(
                color = cyan.copy(alpha = 0.65f),
                startAngle = outerAngle,
                sweepAngle = 240f,
                useCenter = false,
                style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round)
            )
            drawArc(
                color = if (isListening) amber else cyan.copy(alpha = 0.45f),
                startAngle = innerAngle,
                sweepAngle = 190f,
                useCenter = false,
                topLeft = androidx.compose.ui.geometry.Offset(24.dp.toPx(), 24.dp.toPx()),
                size = androidx.compose.ui.geometry.Size(
                    size.width - 48.dp.toPx(),
                    size.height - 48.dp.toPx()
                ),
                style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
            )
            drawCircle(
                color = cyan.copy(alpha = 0.14f + (audioLevel * 0.25f)),
                radius = baseRadius * (0.42f + audioLevel * 0.12f)
            )
        }
    }
}`,
  },
];
