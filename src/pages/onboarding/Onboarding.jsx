import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { completeOnboarding, updateAcademicInfo, updateCareerPreferences, updateEducationLevel } from '../../services/profile'
import {
  getSkillCatalog,
  getUserSkills,
  removeSkill,
  setSkillProficiency,
} from '../../services/skills'
import {
  addInterest,
  getInterestCatalog,
  getUserInterests,
  removeInterest,
} from '../../services/interests'
import { submitAssessment } from '../../services/assessment'
import { generateRecommendations } from '../../services/recommendations'
import TopBar from '../../components/layout/TopBar'
import Footer from '../../components/layout/Footer'
import AcademicStep from './steps/AcademicStep'
import AssessmentStep from './steps/AssessmentStep'
import EducationStep from './steps/EducationStep'
import InterestsStep from './steps/InterestsStep'
import PreferencesStep from './steps/PreferencesStep'
import SkillsStep from './steps/SkillsStep'

const STEPS = [
  { id: 'education', label: 'Education' },
  { id: 'academic', label: 'Academics' },
  { id: 'skills_interests', label: 'Skills & Interests' },
  { id: 'goals', label: 'Goals & Assessment' },
]

function academicComplete(educationLevel, profile) {
  if (!profile) return false
  if (educationLevel === 'college') {
    return Boolean(profile.degree || profile.branch || profile.cgpa != null)
  }
  if (educationLevel === 'job_seeker') {
    return Boolean(profile.experience_years > 0 || profile.academic_strengths)
  }
  return Boolean(profile.subjects || profile.academic_strengths)
}

function preferencesComplete(profile) {
  if (!profile) return false
  return Boolean(
    profile.career_goal ||
      profile.preferred_industry ||
      profile.preferred_role ||
      profile.preferred_location ||
      profile.work_preference,
  )
}

export default function Onboarding() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const profileRef = useRef(profile)

  const [ready, setReady] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [educationLevel, setEducationLevel] = useState(profile?.education_level || '')
  const [skillCatalog, setSkillCatalog] = useState([])
  const [userSkills, setUserSkills] = useState({})
  const [interestCatalog, setInterestCatalog] = useState([])
  const [userInterests, setUserInterests] = useState({})
  const [skillsInterestsTab, setSkillsInterestsTab] = useState('skills')
  const [goalsSubStep, setGoalsSubStep] = useState('preferences')

  useEffect(() => {
    let mounted = true

    Promise.all([
      getSkillCatalog(),
      getUserSkills(user.$id),
      getInterestCatalog(),
      getUserInterests(user.$id),
    ])
      .then(([skills, mySkills, interests, myInterests]) => {
        if (!mounted) return
        const skillMap = Object.fromEntries(
          mySkills.map((entry) => [entry.skill_id, entry.proficiency]),
        )
        const interestSet = Object.fromEntries(
          myInterests.map((entry) => [entry.interest_id, true]),
        )
        setSkillCatalog(skills)
        setUserSkills(skillMap)
        setInterestCatalog(interests)
        setUserInterests(interestSet)

        const snapshot = profileRef.current
        const level = snapshot?.education_level || ''
        setEducationLevel(level)

        let initialStep = 0
        if (level) {
          const hasSkills = Object.keys(skillMap).length > 0
          const hasInterests = Object.keys(interestSet).length > 0
          if (!academicComplete(level, snapshot)) {
            initialStep = 1
          } else if (!hasSkills || !hasInterests) {
            initialStep = 2
          } else if (!preferencesComplete(snapshot) || !(snapshot?.assessment_score > 0)) {
            initialStep = 3
          } else {
            initialStep = 2
          }
        }
        if (Object.keys(skillMap).length > 0 && Object.keys(interestSet).length === 0) {
          setSkillsInterestsTab('interests')
        }
        if (preferencesComplete(snapshot) && !(snapshot?.assessment_score > 0)) {
          setGoalsSubStep('assessment')
        }
        setStep(initialStep)
        setReady(true)
      })
      .catch(() => {
        if (mounted) {
          setReady(true)
        }
      })

    return () => {
      mounted = false
    }
  }, [user.$id])

  const handleError = useCallback((err) => {
    setError(err?.message || 'Something went wrong. Please try again.')
  }, [])

  const advance = useCallback(() => {
    setError('')
    setStep((current) => Math.min(STEPS.length - 1, current + 1))
  }, [])

  const skip = useCallback(() => {
    advance()
  }, [advance])

  const saveEducation = useCallback(
    async (value) => {
      setSaving(true)
      try {
        await updateEducationLevel(user.$id, value)
        setEducationLevel(value)
        await refreshProfile(user.$id)
        advance()
      } catch (err) {
        handleError(err)
      } finally {
        setSaving(false)
      }
    },
    [advance, handleError, refreshProfile, user.$id],
  )

  const saveAcademic = useCallback(
    async (data) => {
      setSaving(true)
      try {
        await updateAcademicInfo(user.$id, data)
        await refreshProfile(user.$id)
        advance()
      } catch (err) {
        handleError(err)
      } finally {
        setSaving(false)
      }
    },
    [advance, handleError, refreshProfile, user.$id],
  )

  const saveSkills = useCallback(
    async (skills) => {
      setSaving(true)
      try {
        await Promise.all(skills.removed.map((skillId) => removeSkill(user.$id, skillId)))
        await Promise.all(Object.entries(skills.updated).map(([skillId, proficiency]) => setSkillProficiency(user.$id, skillId, proficiency)))
        setUserSkills((current) => {
          const next = { ...current }
          skills.removed.forEach((skillId) => delete next[skillId])
          Object.entries(skills.updated).forEach(([skillId, proficiency]) => {
            next[skillId] = proficiency
          })
          return next
        })
        // Stay in same step but switch tab to interests so user completes both without extra click
        if (Object.keys(skills.updated).length > 0 || skills.removed.length > 0) {
          setSkillsInterestsTab('interests')
        }
      } catch (err) {
        handleError(err)
      } finally {
        setSaving(false)
      }
    },
    [handleError, user.$id],
  )

  const saveInterests = useCallback(
    async (interests) => {
      setSaving(true)
      try {
        await Promise.all(interests.removed.map((interestId) => removeInterest(user.$id, interestId)))
        await Promise.all(interests.added.map((interestId) => addInterest(user.$id, interestId)))
        setUserInterests((current) => {
          const next = { ...current }
          interests.removed.forEach((interestId) => delete next[interestId])
          interests.added.forEach((interestId) => {
            next[interestId] = true
          })
          return next
        })
        // Only advance when both skills and interests have at least one entry, otherwise stay to complete
        const hasSkills = Object.keys({ ...userSkills, ...Object.fromEntries(Object.entries(interests.updated || {})) }).length > 0
        // advance after interests saved
        advance()
      } catch (err) {
        handleError(err)
      } finally {
        setSaving(false)
      }
    },
    [advance, handleError, user.$id, userSkills],
  )

  const saveSkillsInterestsContinue = useCallback(() => {
    const hasSkills = Object.keys(userSkills).length > 0
    const hasInterests = Object.keys(userInterests).length > 0
    if (!hasSkills || !hasInterests) {
      setError('Add at least one skill and one interest to continue.')
      return
    }
    advance()
  }, [advance, userSkills, userInterests])

  const savePreferences = useCallback(
    async (data) => {
      setSaving(true)
      try {
        await updateCareerPreferences(user.$id, data)
        await refreshProfile(user.$id)
        setGoalsSubStep('assessment')
      } catch (err) {
        handleError(err)
      } finally {
        setSaving(false)
      }
    },
    [handleError, refreshProfile, user.$id],
  )

  const finish = useCallback(
    async (responses) => {
      setSaving(true)
      try {
        await submitAssessment(user.$id, responses)
        await completeOnboarding(user.$id)
        await refreshProfile(user.$id)
        try {
          await generateRecommendations(6)
        } catch {}
        navigate('/home')
      } catch (err) {
        handleError(err)
        setSaving(false)
      }
    },
    [handleError, navigate, refreshProfile, user.$id],
  )

  const finishLater = useCallback(async () => {
    setSaving(true)
    try {
      await completeOnboarding(user.$id)
      await refreshProfile(user.$id)
      try {
        await generateRecommendations(6)
      } catch {}
      navigate('/home')
    } catch (err) {
      handleError(err)
      setSaving(false)
    }
  }, [handleError, navigate, refreshProfile, user.$id])

  const stepComplete = useMemo(() => {
    const skillsDone = Object.keys(userSkills).length > 0
    const interestsDone = Object.keys(userInterests).length > 0
    return STEPS.map((item) => {
      switch (item.id) {
        case 'education':
          return Boolean(educationLevel)
        case 'academic':
          return academicComplete(educationLevel, profile)
        case 'skills_interests':
          return skillsDone && interestsDone
        case 'goals':
          return preferencesComplete(profile) && Boolean(profile?.assessment_score > 0)
        default:
          return false
      }
    })
  }, [profile, educationLevel, userSkills, userInterests])

  const stepContent = useMemo(() => {
    switch (STEPS[step].id) {
      case 'education':
        return <EducationStep value={educationLevel} saving={saving} onSelect={saveEducation} />
      case 'academic':
        return <AcademicStep educationLevel={educationLevel} initial={profile} saving={saving} onSave={saveAcademic} onSkip={skip} />
      case 'skills_interests':
        return (
          <div>
            <div className="mx-auto mb-6 flex max-w-xl rounded-full border border-line bg-white p-1">
              <button
                type="button"
                onClick={() => setSkillsInterestsTab('skills')}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${skillsInterestsTab === 'skills' ? 'bg-brand text-white' : 'text-ink-muted hover:bg-surface-hover'}`}
              >
                Skills ({Object.keys(userSkills).length})
              </button>
              <button
                type="button"
                onClick={() => setSkillsInterestsTab('interests')}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${skillsInterestsTab === 'interests' ? 'bg-brand text-white' : 'text-ink-muted hover:bg-surface-hover'}`}
              >
                Interests ({Object.keys(userInterests).length})
              </button>
            </div>
            {skillsInterestsTab === 'skills' ? (
              <SkillsStep catalog={skillCatalog} selected={userSkills} saving={saving} onSave={saveSkills} onSkip={skip} />
            ) : (
              <InterestsStep catalog={interestCatalog} selected={userInterests} saving={saving} onSave={saveInterests} onSkip={skip} />
            )}
          </div>
        )
      case 'goals':
        return goalsSubStep === 'preferences' ? (
          <PreferencesStep initial={profile} saving={saving} onSave={savePreferences} onSkip={() => setGoalsSubStep('assessment')} />
        ) : (
          <AssessmentStep saving={saving} onComplete={finish} onSkip={finishLater} />
        )
      default:
        return null
    }
  }, [
    step,
    educationLevel,
    saving,
    profile,
    skillCatalog,
    userSkills,
    interestCatalog,
    userInterests,
    skillsInterestsTab,
    goalsSubStep,
    saveEducation,
    saveAcademic,
    saveSkills,
    saveInterests,
    saveSkillsInterestsContinue,
    savePreferences,
    finish,
    finishLater,
    skip,
  ])

  return (
    <div className="min-h-screen">
      <TopBar />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <header className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.08em]">Let&apos;s set up your profile</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Career onboarding</h1>
          <p className="mt-3 text-lg text-ink-muted">
            {ready
              ? 'A few short steps so we can personalise your career matches and roadmap.'
              : 'Loading your profile…'}
          </p>
        </header>

        {ready && (
          <>
            <ol className="mx-auto mt-8 flex max-w-2xl items-center gap-2">
              {STEPS.map((item, index) => {
                const done = stepComplete[index]
                const active = index === step
                return (
                  <li key={item.id} className="flex flex-1 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(index)}
                      className="flex flex-1 items-center gap-2 text-left"
                      aria-label={`Go to ${item.label} step`}
                      aria-current={active ? 'step' : undefined}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${
                          done
                            ? 'bg-brand text-white'
                            : active
                              ? 'border-2 border-brand bg-brand-soft text-brand-deep'
                              : 'border border-line bg-white text-ink-soft'
                        }`}
                      >
                        {done ? '✓' : index + 1}
                      </span>
                      <span
                        className={`hidden text-xs font-bold sm:block ${
                          done || active ? 'text-ink' : 'text-ink-soft'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                    {index < STEPS.length - 1 && (
                      <span
                        className={`h-0.5 flex-1 ${
                          stepComplete[index] ? 'bg-brand' : 'bg-line'
                        }`}
                      />
                    )}
                  </li>
                )
              })}
            </ol>

            {error && (
              <p className="mx-auto mt-6 max-w-xl rounded-md bg-danger-soft px-4 py-3 text-center text-sm text-danger">
                {error}
              </p>
            )}

            <div className="mt-10">{stepContent}</div>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
