export type ParsedIntent =
  | { type: 'SEND_MONEY'; amount: string; phone: string }
  | { type: 'POCHI'; amount: string; phone: string }
  | { type: 'PAYBILL'; amount: string; business: string; account: string }
  | { type: 'TILL'; amount: string; till: string }
  | { type: 'WITHDRAW'; amount: string; agent: string; store: string }

const AMOUNT_RE = '(\\d+(?:[,.]\\d+)?)'
const PHONE_OR_NAME_RE = '([\\w\\s]+?)'
const NUMBER_RE = '(\\d+)'

/**
 * Parse a free-form English voice transcript into a structured M-Pesa intent.
 *
 * Supported patterns (case-insensitive):
 *   SEND_MONEY : "send 500 [shillings/bob] to 0712345678 [or David]"
 *   POCHI      : "pochi 200 to 0712345678 [or David]"
 *   PAYBILL    : "pay bill 247247 account 1234 [amount] 500"
 *               / "paybill 247247 account 1234 [amount] 500"
 *   TILL       : "pay till 522533 [amount] 500"
 *               / "buy goods 522533 [amount] 500"
 *   WITHDRAW   : "withdraw 1000 agent 123456 store 001"
 */
export function parseIntent(transcript: string): ParsedIntent | null {
  const t = transcript.trim()

  // SEND_MONEY: "send 500 [shillings|bob|kes]? to <phone-or-name>"
  const sendMatch = t.match(
    new RegExp(
      `^send\\s+${AMOUNT_RE}\\s+(?:shillings?|bob|kes)?\\s*to\\s+${PHONE_OR_NAME_RE}$`,
      'i',
    ),
  )
  if (sendMatch) {
    return {
      type: 'SEND_MONEY',
      amount: normalizeAmount(sendMatch[1]),
      phone: sendMatch[2].trim(),
    }
  }

  // POCHI: "pochi 200 to <phone-or-name>"
  const pochiMatch = t.match(
    new RegExp(`^pochi\\s+${AMOUNT_RE}\\s+to\\s+${PHONE_OR_NAME_RE}$`, 'i'),
  )
  if (pochiMatch) {
    return {
      type: 'POCHI',
      amount: normalizeAmount(pochiMatch[1]),
      phone: pochiMatch[2].trim(),
    }
  }

  // PAYBILL: "pay bill <business> account <account> [amount] <amount>"
  //        / "paybill <business> account <account> [amount] <amount>"
  const paybillMatch = t.match(
    new RegExp(
      `^pay\\s*bill\\s+${NUMBER_RE}\\s+account\\s+${NUMBER_RE}\\s+(?:amount\\s+)?${AMOUNT_RE}$`,
      'i',
    ),
  )
  if (paybillMatch) {
    return {
      type: 'PAYBILL',
      amount: normalizeAmount(paybillMatch[3]),
      business: paybillMatch[1],
      account: paybillMatch[2],
    }
  }

  // TILL: "pay till <till> [amount] <amount>"
  //     / "buy goods <till> [amount] <amount>"
  const tillMatch = t.match(
    new RegExp(
      `^(?:pay\\s+till|buy\\s+goods)\\s+${NUMBER_RE}\\s+(?:amount\\s+)?${AMOUNT_RE}$`,
      'i',
    ),
  )
  if (tillMatch) {
    return {
      type: 'TILL',
      amount: normalizeAmount(tillMatch[2]),
      till: tillMatch[1],
    }
  }

  // WITHDRAW: "withdraw <amount> agent <agent> store <store>"
  const withdrawMatch = t.match(
    new RegExp(
      `^withdraw\\s+${AMOUNT_RE}\\s+agent\\s+${NUMBER_RE}\\s+store\\s+${NUMBER_RE}$`,
      'i',
    ),
  )
  if (withdrawMatch) {
    return {
      type: 'WITHDRAW',
      amount: normalizeAmount(withdrawMatch[1]),
      agent: withdrawMatch[2],
      store: withdrawMatch[3],
    }
  }

  return null
}

/** Strip commas from spoken numbers like "1,000" → "1000" */
function normalizeAmount(raw: string): string {
  return raw.replace(/,/g, '')
}

/** Human-readable summary of a parsed intent for TTS confirmation. */
export function describeIntent(intent: ParsedIntent): string {
  switch (intent.type) {
    case 'SEND_MONEY':
      return `Send ${intent.amount} shillings to ${intent.phone}.`
    case 'POCHI':
      return `Pochi ${intent.amount} shillings to ${intent.phone}.`
    case 'PAYBILL':
      return `Pay bill ${intent.business}, account ${intent.account}, amount ${intent.amount} shillings.`
    case 'TILL':
      return `Buy goods at till ${intent.till}, amount ${intent.amount} shillings.`
    case 'WITHDRAW':
      return `Withdraw ${intent.amount} shillings from agent ${intent.agent}, store ${intent.store}.`
  }
}
