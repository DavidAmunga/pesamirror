import * as React from 'react'
import { BookUser, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import type { VoiceContact } from '@/lib/voice-contacts'
import {
  clearVoiceContacts,
  deleteVoiceContact,
  getVoiceContacts,
  initVoiceContacts,
  saveVoiceContact,
} from '@/lib/voice-contacts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type FormState = { name: string; phone: string }
const EMPTY_FORM: FormState = { name: '', phone: '' }

export function VoiceContactsDialog() {
  const [open, setOpen] = React.useState(false)
  const [contacts, setContacts] = React.useState<Array<VoiceContact>>([])
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [editing, setEditing] = React.useState<string | null>(null) 
  const [formVisible, setFormVisible] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      cancelForm()
      return
    }
    setLoading(true)
    initVoiceContacts()
      .then(() => {
        setContacts(getVoiceContacts())
      })
      .catch(() => toast.error('Could not load contacts.'))
      .finally(() => setLoading(false))
  }, [open])

  function startAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormVisible(true)
  }

  function startEdit(contact: VoiceContact) {
    setEditing(contact.name)
    setForm({ name: contact.name, phone: contact.phone })
    setFormError(null)
    setFormVisible(true)
  }

  function cancelForm() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormVisible(false)
  }

  async function handleSave() {
    const name = form.name.trim()
    const phone = form.phone.trim()

    if (!name) {
      setFormError('Name is required.')
      return
    }
    if (!phone) {
      setFormError('Phone number is required.')
      return
    }
    if (!/^[+\d\s\-()]{7,15}$/.test(phone)) {
      setFormError('Enter a valid phone number (e.g. 0712345678).')
      return
    }

    // Prevent duplicate names when adding (not when editing the same contact)
    const duplicate = contacts.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() && c.name !== editing,
    )
    if (duplicate) {
      setFormError(`A contact named "${name}" already exists.`)
      return
    }

    setSaving(true)
    try {
      // If editing, remove the old name first so rename works correctly
      if (editing && editing.toLowerCase() !== name.toLowerCase()) {
        await deleteVoiceContact(editing)
      }
      await saveVoiceContact({ name, phone })
      setContacts(getVoiceContacts())
      cancelForm()
      toast.success(editing ? 'Contact updated.' : 'Contact saved.')
    } catch {
      toast.error('Could not save contact.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Remove "${name}" from voice contacts?`)) return
    try {
      await deleteVoiceContact(name)
      setContacts(getVoiceContacts())
      if (editing === name) cancelForm()
      toast.success('Contact removed.')
    } catch {
      toast.error('Could not remove contact.')
    }
  }

  async function handlePickFromDevice() {
    type ContactsAPI = { select: (props: Array<string>, opts: { multiple: boolean }) => Promise<Array<{ name: Array<string>; tel: Array<string> }>> }
    const contactsApi = (navigator as unknown as { contacts?: ContactsAPI }).contacts
    if (!contactsApi?.select) {
      toast.error('Contacts Picker is not supported in this browser.')
      return
    }
    try {
      const results = await contactsApi.select(['name', 'tel'], { multiple: true })
      let added = 0
      for (const r of results) {
        const name = r.name[0]?.trim()
        const phone = r.tel[0]?.trim()
        if (name && phone) {
          await saveVoiceContact({ name, phone })
          added++
        }
      }
      setContacts(getVoiceContacts())
      if (added > 0) toast.success(`${added} contact${added > 1 ? 's' : ''} imported.`)
    } catch {
      toast.error('Could not import contacts.')
    }
  }

  async function handleClearAll() {
    if (
      !confirm(
        'Remove all voice contacts from this device? This cannot be undone.',
      )
    )
      return
    try {
      await clearVoiceContacts()
      setContacts([])
      cancelForm()
      toast.success('All voice contacts cleared.')
    } catch {
      toast.error('Could not clear contacts.')
    }
  }

  const isFormOpen = formVisible

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Voice contacts"
          className="text-muted-foreground cursor-pointer hover:text-foreground"
        >
          <BookUser className="size-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Voice Contacts</DialogTitle>
          <DialogDescription>
            Contacts used for voice commands. Stored encrypted on this device.
          </DialogDescription>
        </DialogHeader>

        {/* Contact list */}
        <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Loading…
            </p>
          )}
          {!loading && contacts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <UserRound className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
              <p className="text-xs text-muted-foreground">
                Add contacts so you can say &ldquo;send 500 to David&rdquo;.
              </p>
            </div>
          )}
          {!loading &&
            contacts.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.phone}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => startEdit(c)}
                    aria-label={`Edit ${c.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(c.name)}
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
        </div>

        {/* Add / Edit form */}
        {isFormOpen ? (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {editing ? `Editing "${editing}"` : 'New contact'}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="vc-name">Name</Label>
              <input
                id="vc-name"
                type="text"
                placeholder="e.g. David"
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }))
                  setFormError(null)
                }}
                autoComplete="off"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vc-phone">Phone</Label>
              <input
                id="vc-phone"
                type="tel"
                placeholder="e.g. 0712345678"
                value={form.phone}
                onChange={(e) => {
                  setForm((f) => ({ ...f, phone: e.target.value }))
                  setFormError(null)
                }}
                autoComplete="off"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none"
              />
            </div>
            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : editing ? 'Update' : 'Add'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={cancelForm}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={startAdd}
            >
              <Plus className="size-3.5" />
              Add contact
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={handlePickFromDevice}
            >
              <BookUser className="size-3.5" />
              Import
            </Button>
          </div>
        )}

        {contacts.length > 0 && !isFormOpen && (
          <button
            type="button"
            className="w-full text-xs text-destructive/70 hover:text-destructive text-center transition-colors"
            onClick={handleClearAll}
          >
            Clear all contacts
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
