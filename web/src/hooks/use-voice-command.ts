import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParsedIntent } from '@/lib/intent'
import { describeIntent, parseIntent } from '@/lib/intent'
import { isSpeechRecognitionSupported, listenOnce } from '@/lib/stt'
import { cancelSpeech, speak } from '@/lib/tts'
import {
  initVoiceContacts,
  resolvePhoneOrName,
  saveVoiceContact,
} from '@/lib/voice-contacts'

export type VoiceCommandState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'confirming'
  | 'awaiting_confirmation'
  | 'error'

interface UseVoiceCommandResult {
  state: VoiceCommandState
  transcript: string
  pendingIntent: ParsedIntent | null
  errorMessage: string
  isSupported: boolean
  start: () => void
  confirm: () => void
  cancel: () => void
}

export function useVoiceCommand(
  onVoiceSubmit: (intent: ParsedIntent) => void,
  onDismiss?: () => void,
): UseVoiceCommandResult {
  const [state, setState] = useState<VoiceCommandState>('idle')
  const [transcript, setTranscript] = useState('')
  const [pendingIntent, setPendingIntent] = useState<ParsedIntent | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const pendingIntentRef = useRef<ParsedIntent | null>(null)
  const transcriptRef = useRef('')

  const isSupported = isSpeechRecognitionSupported()

  // Ensure contacts are decrypted and cached before the first voice command
  useEffect(() => {
    initVoiceContacts().catch(() => {})
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setTranscript('')
    setPendingIntent(null)
    pendingIntentRef.current = null
    transcriptRef.current = ''
    setErrorMessage('')
  }, [])

  const setError = useCallback((msg: string) => {
    setState('error')
    setErrorMessage(msg)
    speak(msg).catch(() => {})
  }, [])

  const executeConfirm = useCallback(
    (intent: ParsedIntent, raw: string) => {
      // Auto-save named contact for future voice lookups
      const nameMatch = raw.match(/to\s+([a-z\s]+?)(?:\s*$)/i)
      const rawName = nameMatch?.[1]?.trim()
      if (
        rawName &&
        !/^\d/.test(rawName) &&
        (intent.type === 'SEND_MONEY' || intent.type === 'POCHI')
      ) {
        saveVoiceContact({ name: rawName, phone: intent.phone }).catch(() => {})
      }

      cancelSpeech()
      speak('Perfect, sending now via remote push.').catch(() => {})
      reset()
      onDismiss?.()
      onVoiceSubmit(intent)
    },
    [reset, onVoiceSubmit, onDismiss],
  )

  const start = useCallback(async () => {
    if (!isSupported) {
      setError(
        'Voice commands are not supported in this browser. Try Chrome or Safari.',
      )
      return
    }

    cancelSpeech()
    setState('listening')
    setTranscript('')
    setPendingIntent(null)
    pendingIntentRef.current = null
    transcriptRef.current = ''
    setErrorMessage('')

    // Step 1: capture the main command
    let raw: string
    try {
      raw = await listenOnce('en-US')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not capture audio.')
      return
    }

    setTranscript(raw)
    transcriptRef.current = raw
    setState('processing')

    const intent = parseIntent(raw)
    if (!intent) {
      setError(
        "Sorry, I didn't catch that. Try: send 500 shillings to 0712345678.",
      )
      return
    }

    // Resolve contact name → phone for SEND_MONEY / POCHI
    if (intent.type === 'SEND_MONEY' || intent.type === 'POCHI') {
      const resolved = resolvePhoneOrName(intent.phone)
      if (resolved) {
        intent.phone = resolved
      } else if (!/^\d/.test(intent.phone.replace(/[\s\-()+]/g, ''))) {
        setError(
          `I couldn't find "${intent.phone}" in your contacts. Add them first, or say a phone number directly.`,
        )
        return
      }
    }

    setPendingIntent(intent)
    pendingIntentRef.current = intent
    setState('confirming')

    // Step 2: read back the confirmation
    const description = describeIntent(intent)
    try {
      await speak(`${description} Say yes to confirm, or no to cancel.`)
    } catch {
      // TTS unavailable — on-screen buttons serve as fallback
    }

    // Step 3: hands-free — listen for "yes" or "no"
    setState('awaiting_confirmation')
    let response: string
    try {
      response = await listenOnce('en-US')
    } catch {
      setState('confirming')
      speak("I couldn't hear you. Tap yes or no on screen.").catch(() => {})
      return
    }

    if (
      /^(yes|yeah|yep|yup|confirm|send|do it|go|ok|okay)/i.test(
        response.trim(),
      )
    ) {
      executeConfirm(intent, raw)
    } else {
      speak('Okay, no problem. Cancelled.').catch(() => {})
      reset()
      onDismiss?.()
    }
  }, [isSupported, setError, executeConfirm, reset, onDismiss])

  // Tap fallback — used when hands-free confirmation fails
  const confirm = useCallback(() => {
    const intent = pendingIntentRef.current
    const raw = transcriptRef.current
    if (!intent) return
    cancelSpeech()
    executeConfirm(intent, raw)
  }, [executeConfirm])

  const cancel = useCallback(() => {
    cancelSpeech()
    speak('Okay, cancelled.').catch(() => {})
    reset()
    onDismiss?.()
  }, [reset, onDismiss])

  return {
    state,
    transcript,
    pendingIntent,
    errorMessage,
    isSupported,
    start,
    confirm,
    cancel,
  }
}
