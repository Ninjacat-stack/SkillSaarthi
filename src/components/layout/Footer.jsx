import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logo from '../../assets/skillsaarthi_logo.webp'

const SUPPORT_EMAIL = 'skillsaarthi.support@gmail.com'
const SUPPORT_SUBJECT = 'SkillSaarthi Support Request'
const SUPPORT_BODY = `Hello SkillSaarthi Team,

I need assistance regarding:

[Please describe your issue or query here.]

Thank you.`

function openSupportGmail() {
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(SUPPORT_SUBJECT)}&body=${encodeURIComponent(SUPPORT_BODY)}`
  const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}&body=${encodeURIComponent(SUPPORT_BODY)}`
  const win = window.open(gmailUrl, '_blank', 'noopener,noreferrer')
  if (!win) {
    window.location.href = mailtoUrl
  }
}

export default function Footer() {
  const { user } = useAuth()

  return (
    <footer className="bg-deep">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <img src={logo} alt="skillsaarthi logo" className="h-16 w-48 rounded-lg object-cover" />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Personalized career guidance, skill building, and learning roadmaps — for free,
            for everyone.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-white">Learn</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {user ? (
              <>
                <li><Link to="/home" className="hover:text-white">Home</Link></li>
                <li><Link to="/dashboard" className="hover:text-white">Dashboard</Link></li>
                <li><Link to="/onboarding" className="hover:text-white">Manage my profile</Link></li>
                <li><Link to="/assessment" className="hover:text-white">Retake assessment</Link></li>
                <li><Link to="/github" className="hover:text-white">GitHub analysis</Link></li>
                <li><Link to="/internships" className="hover:text-white">Internships</Link></li>
                <li><Link to="/community" className="hover:text-white">Community</Link></li>
              </>
            ) : (
              <>
                <li><Link to="/signup" className="hover:text-white">Get started</Link></li>
                <li><Link to="#subjects" className="hover:text-white">Explore subjects</Link></li>
              </>
            )}
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-white">Account</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {user ? (
              <li>
                <Link to="/dashboard" className="hover:text-white">My dashboard</Link>
              </li>
            ) : (
              <>
                <li><Link to="/signup" className="hover:text-white">Create account</Link></li>
                <li><Link to="/login" className="hover:text-white">Login</Link></li>
              </>
            )}
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-white">About</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li><Link to="/" className="hover:text-white">Our mission</Link></li>
            <li>
              <button
                type="button"
                onClick={openSupportGmail}
                className="inline-flex items-center gap-1.5 text-left hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-deep rounded"
                aria-label="Contact Support via Gmail"
              >
                Contact Support
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white">Gmail</span>
              </button>
            </li>
            <li className="pt-1">
              <span className="text-xs text-slate-500 cursor-default select-text">
                {SUPPORT_EMAIL}
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <p className="mx-auto max-w-7xl px-6 py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} skillsaarthi. Inspired by the warmth of free education.
        </p>
      </div>
    </footer>
  )
}