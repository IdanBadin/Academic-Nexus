import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { VerifiedBadge } from '@/components/ui/Badge'
import { FieldError, Input, Label, Textarea } from '@/components/ui/Field'
import { ErrorState, LoadingBlock } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { SUBJECTS } from '@/config/theme'
import { useAuth } from '@/hooks/useAuth'
import { logEvent } from '@/lib/logEvent'
import { updateProfile } from '@/lib/queries'
import { cn } from '@/lib/utils'

const BIO_MAX = 600

export default function ProfileEditor() {
  const { session, profile, loading, refreshProfile } = useAuth()
  const { push } = useToast()

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name ?? '')
    setBio(profile.bio ?? '')
    setAvatarUrl(profile.avatar_url ?? '')
    setSubjects(profile.subjects ?? [])
  }, [profile])

  const toggleSubject = (subject: string) => {
    setSubjects((current) =>
      current.includes(subject)
        ? current.filter((s) => s !== subject)
        : [...current, subject]
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const userId = session?.user?.id
    if (!userId) return

    if (!fullName.trim()) {
      setNameError('Students need a name to book you.')
      return
    }
    setNameError('')

    setSaving(true)
    try {
      await updateProfile(userId, {
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        subjects,
      })
      await refreshProfile()
      await logEvent({
        userId,
        role: 'expert',
        eventType: 'profile_updated',
        entity: 'profiles',
        status: 'success',
        message: `${subjects.length} subjects listed`,
      })
      push('success', 'Profile saved.')
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingBlock label="Loading your profile" />
  if (!profile) {
    return <ErrorState message="We could not load your profile. Refresh the page and try again." />
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="This is what a student sees before they decide to book you."
      />

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Preview" description="Updates as you type." />
          <CardBody className="flex flex-col items-center gap-3 pt-4">
            <Avatar name={fullName || 'Your name'} url={avatarUrl || null} size="xl" />
            <p className="font-heading text-base font-semibold">{fullName || 'Your name'}</p>
            {profile.is_verified ? (
              <VerifiedBadge />
            ) : (
              <p className="text-center text-xs leading-relaxed text-slate-500">
                Not verified yet. The Academic Nexus team checks your ID and credentials by hand.
                Verified experts get a badge on every listing and show up higher in student search.
              </p>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Basics" />
            <CardBody className="space-y-4 pt-4">
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dana Levy"
                />
                <FieldError>{nameError}</FieldError>
              </div>

              <div>
                <Label htmlFor="avatar_url" hint="optional">
                  Photo URL
                </Label>
                <Input
                  id="avatar_url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Leave it blank and we show your initials instead.
                </p>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={6}
                  maxLength={BIO_MAX}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What you teach, who you usually teach, and how a session with you runs."
                />
                <p className="tabular mt-1.5 text-xs text-slate-500">
                  {bio.length} / {BIO_MAX} characters
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Subjects"
              description="Pick everything you are comfortable teaching. Students filter by these."
            />
            <CardBody className="pt-4">
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((subject) => {
                  const active = subjects.includes(subject)
                  return (
                    <button
                      key={subject}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleSubject(subject)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-sm font-medium',
                        'transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97]',
                        active
                          ? 'border-expert-teal bg-expert-teal text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      {subject}
                    </button>
                  )
                })}
              </div>
              {subjects.length === 0 && (
                <p className="mt-3 text-sm text-slate-500">
                  Nothing picked yet. Without a subject you will not turn up in search.
                </p>
              )}
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
