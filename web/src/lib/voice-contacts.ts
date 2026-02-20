import { encryptPlaintext, decryptPlaintext, isEncryptedBlob } from './crypto-storage'
import type { EncryptedBlob } from './crypto-storage'

export type VoiceContact = { name: string; phone: string }

const STORAGE_KEY = 'pesamirror_voice_contacts'
const STORAGE_KEY_PASSPHRASE = 'pesamirror_voice_contacts_key'
const SESSION_KEY = 'pesamirror_voice_contacts_plain'

// In-memory cache for synchronous access within the current session
let _cache: VoiceContact[] | null = null

function randomPassphrase(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Synchronous read — uses in-memory cache populated by initVoiceContacts(). */
export function getVoiceContacts(): VoiceContact[] {
  if (_cache !== null) return _cache
  try {
    const session =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(SESSION_KEY)
        : null
    if (session) {
      _cache = JSON.parse(session) as VoiceContact[]
      return _cache
    }
  } catch {
    // ignore
  }
  return []
}

/**
 * Initialise contacts from encrypted localStorage.
 * Must be awaited once on app start before any sync reads matter for new sessions.
 */
export async function initVoiceContacts(): Promise<void> {
  if (_cache !== null) return

  // Fast path: session already holds decrypted data
  if (typeof sessionStorage !== 'undefined') {
    const session = sessionStorage.getItem(SESSION_KEY)
    if (session) {
      try {
        _cache = JSON.parse(session) as VoiceContact[]
        return
      } catch {
        // ignore corrupt session
      }
    }
  }

  // Decrypt from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const passphrase = localStorage.getItem(STORAGE_KEY_PASSPHRASE)

    if (raw && passphrase && isEncryptedBlob(raw)) {
      const decrypted = await decryptPlaintext(
        JSON.parse(raw) as EncryptedBlob,
        passphrase,
      )
      _cache = JSON.parse(decrypted) as VoiceContact[]
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, decrypted)
      }
      return
    }

    // Migrate any plain (legacy) contacts to encrypted storage
    if (raw && !isEncryptedBlob(raw)) {
      const legacy = JSON.parse(raw) as VoiceContact[]
      await persistContacts(legacy)
      return
    }
  } catch {
    // ignore decrypt failures
  }

  _cache = []
}

async function persistContacts(contacts: VoiceContact[]): Promise<void> {
  const plain = JSON.stringify(contacts)

  let passphrase = localStorage.getItem(STORAGE_KEY_PASSPHRASE)
  if (!passphrase) {
    passphrase = randomPassphrase()
    localStorage.setItem(STORAGE_KEY_PASSPHRASE, passphrase)
  }

  const blob = await encryptPlaintext(plain, passphrase)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, plain)
  }
  _cache = contacts
}

export async function saveVoiceContact(contact: VoiceContact): Promise<void> {
  const contacts = getVoiceContacts()
  const normalized = normalizePhone(contact.phone)
  const existing = contacts.findIndex(
    (c) => c.name.toLowerCase() === contact.name.toLowerCase(),
  )
  const updated = [...contacts]
  if (existing >= 0) {
    updated[existing] = { name: contact.name, phone: normalized }
  } else {
    updated.push({ name: contact.name, phone: normalized })
  }
  await persistContacts(updated)
}

export async function deleteVoiceContact(name: string): Promise<void> {
  const contacts = getVoiceContacts().filter(
    (c) => c.name.toLowerCase() !== name.toLowerCase(),
  )
  await persistContacts(contacts)
}

export async function clearVoiceContacts(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_KEY_PASSPHRASE)
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY)
  }
  _cache = []
}

/**
 * Resolve a voice query to a phone number.
 * Returns the phone if the query is numeric, or looks up by name from cache.
 */
export function resolvePhoneOrName(query: string): string | null {
  const cleaned = query.trim()
  if (isPhoneNumber(cleaned)) return normalizePhone(cleaned)

  const contacts = getVoiceContacts()
  const lower = cleaned.toLowerCase()

  const exact = contacts.find((c) => c.name.toLowerCase() === lower)
  if (exact) return exact.phone

  const partial = contacts.find((c) => c.name.toLowerCase().startsWith(lower))
  if (partial) return partial.phone

  const queryWords = lower.split(/\s+/)
  const overlap = contacts.find((c) => {
    const nameWords = c.name.toLowerCase().split(/\s+/)
    return queryWords.every((w) => nameWords.some((nw) => nw.startsWith(w)))
  })
  if (overlap) return overlap.phone

  return null
}

function isPhoneNumber(s: string): boolean {
  return /^[+\d\s\-()]{7,15}$/.test(s)
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '')
  if (p.startsWith('+254')) p = '0' + p.slice(4)
  return p
}
