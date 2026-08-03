import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { ErrorState, LoadingBlock } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { WEEKDAYS } from '@/config/theme'
import { useAuth } from '@/hooks/useAuth'
import { logEvent } from '@/lib/logEvent'
import { addAvailability, getAvailability, removeAvailability } from '@/lib/queries'
import { formatTime } from '@/lib/utils'
import type { Availability } from '@/types/db'

/** "09:30:00" and "09:30" both become 570. */
function toMinutes(time: string): number {
  const [h, m] = time.split(':')
  return Number(h) * 60 + Number(m ?? 0)
}

export default function AvailabilityManager() {
  const { session } = useAuth()
  const { push } = useToast()
  const expertId = session?.user?.id ?? null

  const [slots, setSlots] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [openDay, setOpenDay] = useState<number | null>(null)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [formError, setFormError] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!expertId) return
    setLoading(true)
    setLoadError('')
    try {
      setSlots(await getAvailability(expertId))
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'We could not load your weekly hours right now.'
      )
    } finally {
      setLoading(false)
    }
  }, [expertId])

  useEffect(() => {
    void load()
  }, [load])

  const openForm = (weekday: number) => {
    setOpenDay(weekday)
    setStart('09:00')
    setEnd('10:00')
    setFormError('')
  }

  const handleAdd = async (weekday: number) => {
    if (!expertId) return

    const startMin = toMinutes(start)
    const endMin = toMinutes(end)

    if (!start || !end) {
      setFormError('Fill in both times.')
      return
    }
    if (endMin <= startMin) {
      setFormError('The end time has to come after the start time.')
      return
    }

    const clash = slots.find(
      (slot) =>
        slot.weekday === weekday &&
        startMin < toMinutes(slot.end_time) &&
        endMin > toMinutes(slot.start_time)
    )
    if (clash) {
      setFormError(
        `That runs into ${formatTime(clash.start_time)} - ${formatTime(clash.end_time)}. Pick a gap outside it.`
      )
      return
    }

    setFormError('')
    setAdding(true)
    try {
      await addAvailability({
        expert_id: expertId,
        weekday,
        start_time: start,
        end_time: end,
      })
      await logEvent({
        userId: expertId,
        role: 'expert',
        eventType: 'availability_added',
        entity: 'availability',
        status: 'success',
        message: `${WEEKDAYS[weekday]} ${start} to ${end}`,
      })
      push('success', `Added ${WEEKDAYS[weekday]} ${formatTime(start)} - ${formatTime(end)}.`)
      setOpenDay(null)
      await load()
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'Could not add that window.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (slot: Availability) => {
    if (!expertId) return
    setRemovingId(slot.id)
    const previous = slots
    setSlots((current) => current.filter((s) => s.id !== slot.id))

    try {
      await removeAvailability(slot.id)
      await logEvent({
        userId: expertId,
        role: 'expert',
        eventType: 'availability_removed',
        entity: 'availability',
        status: 'success',
        message: `${WEEKDAYS[slot.weekday]} ${slot.start_time} to ${slot.end_time}`,
      })
    } catch (error) {
      setSlots(previous)
      push('error', error instanceof Error ? error.message : 'Could not remove that window.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Availability"
        description="These are the weekly windows students pick from. They repeat every week until you change them."
      />

      {loading ? (
        <LoadingBlock label="Loading your weekly hours" />
      ) : loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {WEEKDAYS.map((day, weekday) => {
            const daySlots = slots
              .filter((slot) => slot.weekday === weekday)
              .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))

            return (
              <Card key={day} className="flex flex-col">
                <CardBody className="flex flex-1 flex-col gap-3 p-4">
                  <h3 className="font-heading text-sm font-semibold">{day}</h3>

                  <div className="flex flex-1 flex-col gap-2">
                    {daySlots.length === 0 && (
                      <p className="text-xs text-slate-400">Nothing set.</p>
                    )}
                    {daySlots.map((slot) => (
                      <span
                        key={slot.id}
                        className="tabular flex items-center justify-between gap-2 rounded-full border border-expert-teal/30 bg-expert-teal/10 px-3 py-1 text-xs font-medium text-expert-teal"
                      >
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        <button
                          type="button"
                          onClick={() => handleRemove(slot)}
                          disabled={removingId === slot.id}
                          aria-label={`Remove ${day} ${formatTime(slot.start_time)} to ${formatTime(slot.end_time)}`}
                          className="-mr-1 rounded-full p-0.5 transition-colors duration-150 hover:bg-expert-teal/20 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {openDay === weekday ? (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="time"
                          aria-label="Start time"
                          value={start}
                          onChange={(e) => setStart(e.target.value)}
                          className="h-9 px-2 text-xs"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <Input
                          type="time"
                          aria-label="End time"
                          value={end}
                          onChange={(e) => setEnd(e.target.value)}
                          className="h-9 px-2 text-xs"
                        />
                      </div>
                      {formError && (
                        <p role="alert" className="text-xs leading-relaxed text-status-red">
                          {formError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" loading={adding} onClick={() => handleAdd(weekday)}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenDay(null)}
                          disabled={adding}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => openForm(weekday)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
