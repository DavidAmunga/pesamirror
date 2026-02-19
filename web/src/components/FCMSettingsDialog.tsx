import * as React from 'react'
import { Copy, Eye, EyeOff, Settings, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ServiceAccount } from '@/lib/fcm'
import { clearFCMConfig, isFCMConfigEncrypted, loadFCMConfig, saveFCMConfig } from '@/lib/fcm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

const SA_PLACEHOLDER = `{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "firebase-adminsdk-...@your-project.iam.gserviceaccount.com",
  ...
}`

const REDACTED = '*** REDACTED ***'

/** Redact private_key value in JSON string for display. */
function redactPrivateKey(jsonStr: string): string {
  try {
    const m = jsonStr.match(/"private_key"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)
    if (!m) return jsonStr
    return jsonStr.replace(m[0], `"private_key": "${REDACTED}"`)
  } catch {
    return jsonStr
  }
}

interface Props {
  children?: React.ReactNode
}

export function FCMSettingsDialog({ children }: Props) {
  const [open, setOpen] = React.useState(false)
  const [saJson, setSaJson] = React.useState('')
  const [deviceToken, setDeviceToken] = React.useState('')
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [maskCredentials, setMaskCredentials] = React.useState(true)
  const [saveLoading, setSaveLoading] = React.useState(false)

  const hasEncryptedOtherSession = open && isFCMConfigEncrypted() && !loadFCMConfig()

  React.useEffect(() => {
    if (!open) return
    const stored = loadFCMConfig()
    if (stored) {
      setSaJson(JSON.stringify(stored.serviceAccount, null, 2))
      setDeviceToken(stored.deviceToken)
      setMaskCredentials(true)
    } else {
      setSaJson('')
      setDeviceToken('')
      setMaskCredentials(false)
    }
    setSaved(false)
    setError(null)
  }, [open])

  const hasStoredConfig = Boolean(saJson.trim() && deviceToken.trim())
  const displaySaJson = maskCredentials ? redactPrivateKey(saJson) : saJson

  function handleClearCredentials() {
    if (!confirm('Remove saved FCM credentials from this device? You can add them again later.')) return
    clearFCMConfig()
    setSaJson('')
    setDeviceToken('')
    setMaskCredentials(false)
    setError(null)
  }

  async function handleSave() {
    setError(null)
    let sa: ServiceAccount
    try {
      sa = JSON.parse(saJson) as ServiceAccount
    } catch {
      setError('Invalid JSON — check the format and try again.')
      return
    }
    if (!sa.project_id || !sa.private_key || !sa.client_email) {
      setError(
        'Service account must have project_id, private_key, and client_email.',
      )
      return
    }
    if (!sa.private_key.includes('BEGIN PRIVATE KEY')) {
      setError('private_key does not look like a PEM key.')
      return
    }
    if (!deviceToken.trim()) {
      setError('Device token is required. Copy it from the Android app.')
      return
    }
    setSaveLoading(true)
    try {
      await saveFCMConfig({ serviceAccount: sa, deviceToken: deviceToken.trim() })
      setSaved(true)
      setTimeout(() => setOpen(false), 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaveLoading(false)
    }
  }

  function handleCopyRedacted() {
    const redacted = redactPrivateKey(saJson)
    if (!redacted.trim()) return
    navigator.clipboard.writeText(redacted).then(
      () => toast.success('Redacted JSON copied (private key hidden).'),
      () => toast.error('Could not copy.'),
    )
  }

  const canSave = saJson.trim() && deviceToken.trim()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="FCM settings"
            className="text-muted-foreground cursor-pointer hover:text-foreground"
          >
            <Settings className="size-5" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remote Push Settings</DialogTitle>
          <DialogDescription>
            Sends triggers via{' '}
            <a
              href="https://firebase.google.com/docs/cloud-messaging"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Firebase Cloud Messaging
            </a>
            . Stateless — FCM wakes the Android app even when it&apos;s killed.
          </DialogDescription>
        </DialogHeader>

        {hasEncryptedOtherSession && (
          <div className="flex items-start justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
            <p className="text-muted-foreground flex-1">
              Credentials from another tab or session aren’t available here.
              Paste below to save in this tab, or clear saved data.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive shrink-0 hover:bg-destructive/10"
              onClick={() => {
                if (confirm('Remove saved FCM data from this device?')) {
                  clearFCMConfig()
                  setSaJson('')
                  setDeviceToken('')
                  setError(null)
                }
              }}
            >
              <Trash2 className="size-3.5 mr-1" />
              Clear
            </Button>
          </div>
        )}
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Credentials are stored only on this device and encrypted at rest.
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="sa-json">Service Account JSON</Label>
              <div className="flex items-center gap-1">
                {hasStoredConfig && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-8 gap-1.5 px-2 text-xs"
                    onClick={handleCopyRedacted}
                    title="Copy JSON with private key redacted"
                  >
                    <Copy className="size-3.5" />
                    Copy redacted
                  </Button>
                )}
                {hasStoredConfig && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-8 gap-1.5 px-2 text-xs"
                    onClick={() => setMaskCredentials((m) => !m)}
                  >
                    {maskCredentials ? (
                      <>
                        <Eye className="size-3.5" />
                        Reveal
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3.5" />
                        Mask
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <textarea
              id="sa-json"
              rows={7}
              placeholder={SA_PLACEHOLDER}
              value={displaySaJson}
              onChange={(e) => {
                if (!maskCredentials) {
                  setSaJson(e.target.value)
                  setError(null)
                }
              }}
              readOnly={maskCredentials}
              spellCheck={false}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none resize-none disabled:opacity-90"
            />
            <p className="text-muted-foreground text-xs">
              Firebase Console → Project Settings → Service accounts → Generate
              new private key.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="device-token">Device Token</Label>
            <input
              id="device-token"
              type="text"
              placeholder="Paste the FCM token from the Android app"
              value={deviceToken}
              onChange={(e) => {
                setDeviceToken(e.target.value)
                setError(null)
              }}
              autoComplete="off"
              spellCheck={false}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none"
            />
            <p className="text-muted-foreground text-xs">
              Shown in the Android app under Remote Push settings — tap Copy
              Token.
            </p>
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
            {hasStoredConfig && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 sm:w-auto"
                onClick={handleClearCredentials}
              >
                <Trash2 className="size-4 mr-1.5" />
                Clear credentials
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!canSave || saveLoading}
              className="w-full sm:flex-1"
            >
              {saveLoading ? 'Saving…' : saved ? 'Saved!' : 'Save'}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
