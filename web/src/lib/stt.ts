// Web Speech API types are not fully included in all TypeScript DOM libs;
// we use targeted `any` casts to avoid declaring the full interface tree.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionCtor = new () => any

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

/**
 * Listens for a single utterance and returns the transcript.
 * Resolves with the best-match transcript or rejects on error / no-speech.
 */
export function listenOnce(lang = 'en-US'): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      reject(new Error('Speech recognition is not supported in this browser.'))
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new Ctor()

    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = (event.results[0][0].transcript as string).trim()
      resolve(transcript)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      const error = event.error as string
      if (error === 'no-speech') {
        reject(new Error('No speech detected. Please try again.'))
      } else if (error === 'not-allowed') {
        reject(
          new Error(
            'Microphone access was denied. Please allow microphone access and try again.',
          ),
        )
      } else {
        reject(new Error(`Speech recognition error: ${error}`))
      }
    }

    recognition.onnomatch = () => {
      reject(new Error('Could not recognize speech. Please try again.'))
    }

    recognition.start()
  })
}
