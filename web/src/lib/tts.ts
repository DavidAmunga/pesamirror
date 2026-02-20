const PREFERRED_FEMININE_VOICES = [
  'Samantha',              // iOS / macOS — warm US female
  'Karen',                 // iOS / macOS AU female
  'Victoria',              // iOS US female
  'Moira',                 // iOS IE female
  'Tessa',                 // iOS ZA female
  'Google UK English Female',
  'Microsoft Zira',        // Windows
  'Microsoft Jenny',       // Windows
  'Google US English',     // Chrome Android (tends to be female)
]

function selectVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const langPrefix = lang.toLowerCase().split('-')[0]
  const langVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(langPrefix),
  )
  const pool = langVoices.length ? langVoices : voices

  for (const name of PREFERRED_FEMININE_VOICES) {
    const match = pool.find((v) => v.name.includes(name))
    if (match) return match
  }

  // Fallback: any voice with "female" in the name
  const female = pool.find((v) => v.name.toLowerCase().includes('female'))
  if (female) return female

  return null
}

export function speak(text: string, lang = 'en-US'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis is not supported in this browser.'))
      return
    }

    cancelSpeech()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.88
    utterance.pitch = 1.08

    // Voices may load asynchronously — try immediately then retry once on voiceschanged
    const trySetVoice = () => {
      const voice = selectVoice(lang)
      if (voice) utterance.voice = voice
    }
    trySetVoice()
    // Re-attempt voice selection once voices finish loading (async on some browsers)
    window.speechSynthesis.onvoiceschanged = () => {
      trySetVoice()
      window.speechSynthesis.onvoiceschanged = null
    }

    utterance.onend = () => resolve()
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') {
        resolve()
      } else {
        reject(new Error(`Speech synthesis error: ${event.error}`))
      }
    }

    window.speechSynthesis.speak(utterance)
  })
}

export function cancelSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
