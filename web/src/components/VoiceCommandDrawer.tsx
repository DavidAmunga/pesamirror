import { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import type { ParsedIntent } from '@/lib/intent'
import { useVoiceCommand } from '@/hooks/use-voice-command'
import { VoiceCommandButton } from '@/components/VoiceCommandButton'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

interface VoiceCommandDrawerProps {
  onVoiceSubmit: (intent: ParsedIntent) => void
}

export function VoiceCommandDrawer({ onVoiceSubmit }: VoiceCommandDrawerProps) {
  const [open, setOpen] = useState(false)

  const voice = useVoiceCommand(onVoiceSubmit, () => setOpen(false))

  // Auto-start listening as soon as the drawer opens
  useEffect(() => {
    if (open && voice.state === 'idle') {
      const t = setTimeout(() => voice.start(), 300)
      return () => clearTimeout(t)
    }
  }, [open]) // voice.start is stable (useCallback); open is the only relevant trigger

  function handleOpenChange(next: boolean) {
    if (!next && voice.state !== 'idle') {
      voice.cancel()
    }
    setOpen(next)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} direction="bottom">
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-3 py-6 text-base font-medium border-dashed hover:border-solid"
          aria-label="Open voice command"
        >
          <Mic className="size-5 shrink-0" />
          Speak a command
        </Button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[85svh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>Voice Command</DrawerTitle>
          <DrawerDescription>
            Say something like &ldquo;send 500 shillings to 0712345678&rdquo;
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto">
          <VoiceCommandButton
            state={voice.state}
            transcript={voice.transcript}
            pendingIntent={voice.pendingIntent}
            errorMessage={voice.errorMessage}
            isSupported={voice.isSupported}
            onStart={voice.start}
            onConfirm={voice.confirm}
            onCancel={voice.cancel}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
