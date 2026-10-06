package com.wallet.modules

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

/**
 * VoiceModule — Native Android Speech Recognition & Text-To-Speech
 *
 * Implements:
 * 1. SpeechRecognizer: Captures live voice from device microphone, streaming
 *    RMS volume decibels and partial/final speech recognition results.
 * 2. TextToSpeech: Speaks AI responses aloud with device speaker and progress tracking.
 */
class VoiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsInitialized = false
    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())

    private data class PendingSpeak(val text: String, val utteranceId: String, val promise: Promise)
    private val pendingSpeaks = mutableListOf<PendingSpeak>()

    init {
        mainHandler.post {
            try {
                textToSpeech = TextToSpeech(reactContext.applicationContext, this)
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Failed to initialize TextToSpeech", e)
            }
        }
    }

    override fun getName(): String = NAME

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = textToSpeech?.setLanguage(Locale.US)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                textToSpeech?.setLanguage(Locale.getDefault())
            }
            textToSpeech?.setPitch(1.0f)
            textToSpeech?.setSpeechRate(1.05f)

            textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    sendEvent("onTtsStart", Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                    })
                }

                override fun onDone(utteranceId: String?) {
                    sendEvent("onTtsDone", Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                    })
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    sendEvent("onTtsError", Arguments.createMap().apply {
                        putString("utteranceId", utteranceId)
                        putString("error", "Playback error")
                    })
                }
            })
            isTtsInitialized = true

            // Flush any speech requests queued while TTS was initializing
            synchronized(pendingSpeaks) {
                for (pending in pendingSpeaks) {
                    executeSpeak(pending.text, pending.utteranceId, pending.promise)
                }
                pendingSpeaks.clear()
            }
        } else {
            android.util.Log.e(TAG, "TTS Initialization failed with status: $status")
            synchronized(pendingSpeaks) {
                for (pending in pendingSpeaks) {
                    pending.promise.reject("TTS_FAILED", "TTS initialization failed with code $status")
                }
                pendingSpeaks.clear()
            }
        }
    }

    @ReactMethod
    fun isAvailable(promise: Promise) {
        mainHandler.post {
            val isSpeechAvailable = SpeechRecognizer.isRecognitionAvailable(reactContext)
            val map = Arguments.createMap().apply {
                putBoolean("speechRecognition", isSpeechAvailable)
                putBoolean("textToSpeech", isTtsInitialized)
            }
            promise.resolve(map)
        }
    }

    @ReactMethod
    fun startListening(options: ReadableMap?, promise: Promise) {
        mainHandler.post {
            try {
                if (speechRecognizer != null) {
                    try {
                        speechRecognizer?.cancel()
                        speechRecognizer?.destroy()
                    } catch (e: Exception) {}
                    speechRecognizer = null
                }

                try {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)
                } catch (e: Exception) {
                    promise.reject("UNAVAILABLE", "Speech recognizer creation failed: ${e.message}")
                    return@post
                }

                if (speechRecognizer == null) {
                    promise.reject("UNAVAILABLE", "Speech recognition service could not be instantiated")
                    return@post
                }

                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        isListening = true
                        sendEvent("onSpeechStart", null)
                    }

                    override fun onBeginningOfSpeech() {
                        sendEvent("onSpeechBegin", null)
                    }

                    override fun onRmsChanged(rmsdB: Float) {
                        // Normalize rmsdB (-2 to 10 typical) to 0.0 .. 1.0 range
                        val normalized = ((rmsdB + 2.0f) / 12.0f).coerceIn(0.05f, 1.0f).toDouble()
                        val bands = Arguments.createArray().apply {
                            pushDouble(normalized * 0.85)
                            pushDouble((normalized * 1.05).coerceAtMost(1.0))
                            pushDouble(normalized)
                            pushDouble(normalized * 0.95)
                            pushDouble(normalized * 0.75)
                        }
                        val map = Arguments.createMap().apply {
                            putDouble("level", normalized)
                            putArray("bands", bands)
                        }
                        sendEvent("onSpeechVolume", map)
                    }

                    override fun onBufferReceived(buffer: ByteArray?) {}

                    override fun onEndOfSpeech() {
                        isListening = false
                        sendEvent("onSpeechEnd", null)
                    }

                    override fun onError(error: Int) {
                        isListening = false
                        val errorMsg = when (error) {
                            SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                            SpeechRecognizer.ERROR_CLIENT -> "Client side error"
                            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                            SpeechRecognizer.ERROR_NETWORK -> "Network error"
                            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                            SpeechRecognizer.ERROR_NO_MATCH -> "No speech match found"
                            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "RecognitionService busy"
                            SpeechRecognizer.ERROR_SERVER -> "Server error"
                            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input detected"
                            else -> "Speech recognition error: $error"
                        }
                        val map = Arguments.createMap().apply {
                            putInt("errorCode", error)
                            putString("error", errorMsg)
                        }
                        sendEvent("onSpeechError", map)
                    }

                    override fun onResults(results: Bundle?) {
                        isListening = false
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = if (!matches.isNullOrEmpty()) matches[0] else ""
                        val map = Arguments.createMap().apply {
                            putString("text", text)
                            putBoolean("isFinal", true)
                        }
                        sendEvent("onSpeechResults", map)
                    }

                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = if (!matches.isNullOrEmpty()) matches[0] else ""
                        val map = Arguments.createMap().apply {
                            putString("text", text)
                            putBoolean("isFinal", false)
                        }
                        sendEvent("onSpeechPartialResults", map)
                    }

                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
                    putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactContext.packageName)
                    putExtra("android.speech.extra.DICTATION_MODE", true)
                    val lang = options?.getString("language") ?: Locale.getDefault().toLanguageTag()
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                }

                speechRecognizer?.startListening(intent)
                promise.resolve(true)
            } catch (e: Exception) {
                isListening = false
                promise.reject("ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        mainHandler.post {
            try {
                speechRecognizer?.stopListening()
                isListening = false
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun cancelListening(promise: Promise) {
        mainHandler.post {
            try {
                speechRecognizer?.cancel()
                isListening = false
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("ERROR", e.message, e)
            }
        }
    }

    private fun executeSpeak(text: String, utteranceId: String, promise: Promise) {
        try {
            if (isListening) {
                try {
                    speechRecognizer?.cancel()
                    isListening = false
                } catch (e: Exception) {}
            }

            val params = Bundle().apply {
                putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            }

            val result = textToSpeech?.speak(
                text,
                TextToSpeech.QUEUE_FLUSH,
                params,
                utteranceId
            )

            if (result == TextToSpeech.SUCCESS) {
                promise.resolve(true)
            } else {
                promise.reject("TTS_FAILED", "Failed to start speech synthesis, code: $result")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun speak(text: String, utteranceId: String, promise: Promise) {
        mainHandler.post {
            if (!isTtsInitialized || textToSpeech == null) {
                synchronized(pendingSpeaks) {
                    pendingSpeaks.add(PendingSpeak(text, utteranceId, promise))
                }
                return@post
            }
            executeSpeak(text, utteranceId, promise)
        }
    }

    @ReactMethod
    fun stopSpeaking(promise: Promise) {
        mainHandler.post {
            try {
                textToSpeech?.stop()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun invalidate() {
        super.invalidate()
        mainHandler.post {
            try {
                speechRecognizer?.cancel()
                speechRecognizer?.destroy()
                speechRecognizer = null

                textToSpeech?.stop()
                textToSpeech?.shutdown()
                textToSpeech = null
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error cleaning up VoiceModule", e)
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    companion object {
        const val NAME = "VoiceModule"
        private const val TAG = "VoiceModule"
    }
}
