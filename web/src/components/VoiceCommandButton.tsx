import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, Loader2, Mic, MicOff, XCircle } from 'lucide-react'
import type { ParsedIntent } from '@/lib/intent'
import type { VoiceCommandState } from '@/hooks/use-voice-command'
import { describeIntent } from '@/lib/intent'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VoiceCommandButtonProps {
  state: VoiceCommandState
  transcript: string
  pendingIntent: ParsedIntent | null
  errorMessage: string
  isSupported: boolean
  onStart: () => void
  onConfirm: () => void
  onCancel: () => void
}

export function VoiceCommandButton({
  state,
  transcript,
  pendingIntent,
  errorMessage,
  isSupported,
  onStart,
  onConfirm,
  onCancel,
}: VoiceCommandButtonProps) {
  const isListening = state === 'listening' || state === 'awaiting_confirmation'
  const isActive =
    state === 'listening' ||
    state === 'processing' ||
    state === 'confirming' ||
    state === 'awaiting_confirmation'

  const confirmationHint =
    state === 'awaiting_confirmation'
      ? 'Say “yes” to send or “no” to cancel'
      : 'Listening for confirmation...'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Voice command
        </span>
        {!isSupported && (
          <span className="text-xs text-muted-foreground">
            Not supported in this browser
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        {/* Main mic button */}
        <motion.button
          type="button"
          onClick={state === 'idle' || state === 'error' ? onStart : undefined}
          disabled={!isSupported || isActive}
          className={cn(
            'relative flex h-16 w-16 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none',
            isListening && 'border-destructive bg-destructive/10 text-destructive',
            (state === 'processing' || state === 'confirming') &&
              'border-primary bg-primary/10 text-primary',
            state === 'error' &&
              'border-destructive bg-destructive/10 text-destructive cursor-pointer',
            state === 'idle' &&
              'border-border bg-background text-foreground hover:bg-accent cursor-pointer',
          )}
          whileTap={state === 'idle' || state === 'error' ? { scale: 0.92 } : {}}
          animate={isListening ? { scale: [1, 1.05, 1] } : {}}
          transition={
            isListening
              ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
              : {}
          }
          aria-label={state === 'idle' ? 'Start voice command' : stateLabel(state)}
        >
          {/* Pulse ring when listening */}
          {isListening && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-destructive"
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}

          <AnimatePresence mode="wait">
            <motion.span
              key={state}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
            >
              {state === 'processing' || state === 'confirming' ? (
                <Loader2 className="size-7 animate-spin" />
              ) : state === 'error' ? (
                <MicOff className="size-7" />
              ) : (
                <Mic className="size-7" />
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        {/* Status label */}
        <AnimatePresence mode="wait">
          <motion.p
            key={state + errorMessage}
            className="text-center text-sm text-muted-foreground"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {stateLabel(state)}
          </motion.p>
        </AnimatePresence>

        {/* Transcript (what was heard for the command) */}
        {transcript && state !== 'idle' && (
          <p className="text-xs text-muted-foreground italic text-center max-w-xs">
            &ldquo;{transcript}&rdquo;
          </p>
        )}

        {/* Confirmation panel — shown while system reads and then listens for yes/no */}
        <AnimatePresence>
          {(state === 'confirming' || state === 'awaiting_confirmation') &&
            pendingIntent && (
              <motion.div
                className="w-full rounded-lg border bg-card p-4 space-y-3"
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm font-medium text-center">
                  {describeIntent(pendingIntent)}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  {confirmationHint}
                </p>
                {/* Tap fallback for noisy environments */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    className="flex-1 gap-2"
                    onClick={onConfirm}
                  >
                    <CheckCircle className="size-4" />
                    Yes, send
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={onCancel}
                  >
                    <XCircle className="size-4" />
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        {/* Error panel */}
        <AnimatePresence>
          {state === 'error' && errorMessage && (
            <motion.div
              className="w-full rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-sm text-destructive">{errorMessage}</p>
              <button
                type="button"
                className="mt-2 text-xs text-destructive underline"
                onClick={onStart}
              >
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function stateLabel(state: VoiceCommandState): string {
  switch (state) {
    case 'idle':
      return 'Tap to speak'
    case 'listening':
      return 'Listening...'
    case 'processing':
      return 'Processing...'
    case 'confirming':
      return 'Reading back...'
    case 'awaiting_confirmation':
      return 'Say “yes” or “no”'
    case 'error':
      return 'Tap to try again'
  }
}
