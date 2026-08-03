import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/States'
import { EmptyStateAnimation } from '@/components/lottie/Animations'
import { useToast } from '@/components/ui/Toast'
import { useAiAssistantOptional } from '@/components/ai/AiAssistantContext'
import { FORMATS, LEVELS, SUBJECTS } from '@/config/theme'
import { useAuth } from '@/hooks/useAuth'
import { logEvent } from '@/lib/logEvent'
import { getListingsForExpert, saveListing } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import type { Listing, ListingFormat } from '@/types/db'

const DURATIONS = [30, 45, 60, 90]

interface Draft {
  id?: string
  subject: string
  level: string
  format: string
  price: string
  duration_min: string
  description: string
}

const BLANK: Draft = {
  subject: '',
  level: '',
  format: '',
  price: '',
  duration_min: '60',
  description: '',
}

type DraftErrors = Partial<Record<keyof Draft, string>>

function formatLabel(value: string): string {
  return FORMATS.find((f) => f.value === value)?.label ?? value
}

export default function Listings() {
  const { session, profile } = useAuth()
  const { push } = useToast()
  const assistant = useAiAssistantOptional()
  const expertId = session?.user?.id ?? null

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Listing | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!expertId) return
    setLoading(true)
    setLoadError('')
    try {
      setListings(await getListingsForExpert(expertId))
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'We could not load your listings right now.'
      )
    } finally {
      setLoading(false)
    }
  }, [expertId])

  useEffect(() => {
    void load()
  }, [load])

  const openNew = () => {
    setDraft(BLANK)
    setErrors({})
    setOpen(true)
  }

  const openEdit = (listing: Listing) => {
    setDraft({
      id: listing.id,
      subject: listing.subject,
      level: listing.level,
      format: listing.format,
      price: String(listing.price),
      duration_min: String(listing.duration_min),
      description: listing.description ?? '',
    })
    setErrors({})
    setOpen(true)
  }

  const validate = (): boolean => {
    const next: DraftErrors = {}
    if (!draft.subject) next.subject = 'Pick a subject.'
    if (!draft.level) next.level = 'Pick a level.'
    if (!draft.format) next.format = 'Pick a format.'
    if (!(Number(draft.price) > 0)) next.price = 'Price has to be more than 0.'
    if (!draft.duration_min) next.duration_min = 'Pick a session length.'
    if (draft.description.trim().length < 20) {
      next.description = `Write at least 20 characters - you have ${draft.description.trim().length}.`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!expertId || !validate()) return

    setSaving(true)
    try {
      await saveListing({
        ...(draft.id ? { id: draft.id } : {}),
        expert_id: expertId,
        subject: draft.subject,
        level: draft.level,
        format: draft.format as ListingFormat,
        price: Number(draft.price),
        duration_min: Number(draft.duration_min),
        description: draft.description.trim(),
        is_active: true,
      })
      await logEvent({
        userId: expertId,
        role: 'expert',
        eventType: draft.id ? 'listing_updated' : 'listing_created',
        entity: 'listings',
        status: 'success',
        message: `${draft.subject} - ${formatLabel(draft.format)}`,
      })
      push('success', draft.id ? 'Listing updated.' : 'Listing is live.')
      setOpen(false)
      await load()
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'Could not save the listing.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (listing: Listing) => {
    if (!expertId) return
    const nextActive = !listing.is_active
    setTogglingId(listing.id)
    setListings((current) =>
      current.map((l) => (l.id === listing.id ? { ...l, is_active: nextActive } : l))
    )

    try {
      await saveListing({ id: listing.id, is_active: nextActive })
      await logEvent({
        userId: expertId,
        role: 'expert',
        eventType: nextActive ? 'listing_updated' : 'listing_deactivated',
        entity: 'listings',
        status: 'success',
        message: `${listing.subject} is now ${nextActive ? 'visible' : 'hidden'}`,
      })
    } catch (error) {
      setListings((current) =>
        current.map((l) => (l.id === listing.id ? { ...l, is_active: listing.is_active } : l))
      )
      push('error', error instanceof Error ? error.message : 'Could not change the listing.')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!expertId || !pendingDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('listings').delete().eq('id', pendingDelete.id)
      if (error) throw error
      await logEvent({
        userId: expertId,
        role: 'expert',
        eventType: 'listing_deactivated',
        entity: 'listings',
        status: 'success',
        message: `Deleted ${pendingDelete.subject} - ${formatLabel(pendingDelete.format)}`,
      })
      setListings((current) => current.filter((l) => l.id !== pendingDelete.id))
      push('success', 'Listing deleted.')
      setPendingDelete(null)
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'Could not delete the listing.')
    } finally {
      setDeleting(false)
    }
  }

  const askAssistant = () => {
    const parts = [
      draft.subject && `Subject: ${draft.subject}`,
      draft.level && `Level: ${draft.level}`,
      draft.format && `Format: ${formatLabel(draft.format)}`,
      draft.price && `Price: ${draft.price}`,
      draft.duration_min && `Duration: ${draft.duration_min} minutes`,
      draft.description.trim() && `Current description: ${draft.description.trim()}`,
    ].filter(Boolean)

    assistant.openWith(
      [
        'Help me sharpen this tutoring listing so students understand what they get.',
        parts.length ? parts.join('\n') : 'I have not filled anything in yet.',
        profile?.bio ? `About me: ${profile.bio}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    )
  }

  const renderBody = () => {
    if (loading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )
    }

    if (loadError) return <ErrorState message={loadError} />

    if (listings.length === 0) {
      return (
        <EmptyState
          illustration={<EmptyStateAnimation />}
          title="No listings yet"
          description="A listing is one thing you teach, at one price. Students book straight off it, so most experts start with the subject they teach most."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" />
              Create your first listing
            </Button>
          }
        />
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {listings.map((listing) => (
          <Card key={listing.id} interactive className="flex flex-col">
            <CardBody className="flex flex-1 flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-semibold">{listing.subject}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {listing.level} - {formatLabel(listing.format)}
                  </p>
                </div>
                <Badge className={cn(!listing.is_active && 'text-slate-400')}>
                  {listing.is_active ? 'Visible' : 'Hidden'}
                </Badge>
              </div>

              <p className="tabular font-heading text-lg font-semibold text-expert-teal">
                {formatCurrency(listing.price)}
                <span className="ml-1.5 text-sm font-normal text-slate-500">
                  for {listing.duration_min} min
                </span>
              </p>

              <p className="flex-1 text-sm leading-relaxed text-slate-600">
                {listing.description || 'No description yet.'}
              </p>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={listing.is_active}
                  aria-label={listing.is_active ? 'Hide this listing' : 'Show this listing'}
                  disabled={togglingId === listing.id}
                  onClick={() => handleToggle(listing)}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
                    'transition-colors duration-200 ease-out disabled:opacity-50',
                    listing.is_active ? 'bg-expert-teal' : 'bg-slate-200'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 rounded-full bg-white shadow-sm',
                      'transition-transform duration-200 ease-out',
                      listing.is_active ? 'translate-x-[22px]' : 'translate-x-0.5'
                    )}
                  />
                </button>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(listing)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPendingDelete(listing)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="My listings"
        description="What you teach, how long a session runs, and what it costs."
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New listing
          </Button>
        }
      />

      {renderBody()}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? 'Edit listing' : 'New listing'}
        description="Students see all of this before they book."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {draft.id ? 'Save listing' : 'Publish listing'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Select
                id="subject"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              >
                <option value="">Choose a subject</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.subject}</FieldError>
            </div>

            <div>
              <Label htmlFor="level">Level</Label>
              <Select
                id="level"
                value={draft.level}
                onChange={(e) => setDraft({ ...draft, level: e.target.value })}
              >
                <option value="">Choose a level</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.level}</FieldError>
            </div>

            <div>
              <Label htmlFor="format">Format</Label>
              <Select
                id="format"
                value={draft.format}
                onChange={(e) => setDraft({ ...draft, format: e.target.value })}
              >
                <option value="">Choose a format</option>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.format}</FieldError>
            </div>

            <div>
              <Label htmlFor="duration">Session length</Label>
              <Select
                id="duration"
                value={draft.duration_min}
                onChange={(e) => setDraft({ ...draft, duration_min: e.target.value })}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} minutes
                  </option>
                ))}
              </Select>
              <FieldError>{errors.duration_min}</FieldError>
            </div>

            <div>
              <Label htmlFor="price" hint="USD">
                Price
              </Label>
              <Input
                id="price"
                type="number"
                min={1}
                step={1}
                className="tabular"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="60"
              />
              <FieldError>{errors.price}</FieldError>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="description">Description</Label>
              <Button type="button" variant="ghost" size="sm" onClick={askAssistant}>
                <Sparkles className="h-3.5 w-3.5" />
                Help me write this
              </Button>
            </div>
            <Textarea
              id="description"
              rows={5}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What you cover, what a student should bring, and what they walk away with."
            />
            <FieldError>{errors.description}</FieldError>
          </div>
        </div>
      </Modal>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this listing?"
        description={
          pendingDelete
            ? `${pendingDelete.subject} - ${formatLabel(pendingDelete.format)}. Bookings already made stay put.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600">
          This takes it out of student search for good. If you only want a break from it, flip the
          switch to hidden instead.
        </p>
      </Modal>
    </>
  )
}
