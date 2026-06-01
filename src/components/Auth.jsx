import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Passwordless email OTP: enter email -> Supabase sends a 6-digit code ->
// type the code -> verifyOtp creates the session in the app's own storage.
// This works inside the installed iPhone PWA (no Safari hop / link redirect).
export default function Auth() {
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'sending' | 'verifying'
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function sendCode(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus('sending')
    setMessage('')
    setIsError(false)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    })
    setStatus('idle')
    if (error) {
      setIsError(true)
      setMessage(error.message)
    } else {
      setStep('code')
      setMessage(`We sent a 6-digit code to ${trimmed}.`)
    }
  }

  async function verify(e) {
    e.preventDefault()
    const token = code.trim()
    if (token.length < 6) return
    setStatus('verifying')
    setMessage('')
    setIsError(false)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    })
    if (error) {
      setStatus('idle')
      setIsError(true)
      setMessage(error.message)
    }
    // On success, App's onAuthStateChange swaps to the app automatically.
  }

  async function resend() {
    setStatus('sending')
    setMessage('')
    setIsError(false)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setStatus('idle')
    setIsError(!!error)
    setMessage(error ? error.message : 'New code sent.')
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">Hyoshi</div>
        <p className="tag">Your tasks, in sync everywhere.</p>

        {step === 'email' ? (
          <form onSubmit={sendCode}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'sending'}
            />
            <button
              type="submit"
              className="btn primary"
              style={{ width: '100%' }}
              disabled={status === 'sending' || !email.trim()}
            >
              {status === 'sending' ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="——————"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={status === 'verifying'}
              autoFocus
              className="otp-input"
            />
            <button
              type="submit"
              className="btn primary"
              style={{ width: '100%' }}
              disabled={status === 'verifying' || code.length < 6}
            >
              {status === 'verifying' ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <div className="auth-links">
              <button
                type="button"
                className="linkbtn"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setMessage('')
                  setIsError(false)
                }}
              >
                ← Change email
              </button>
              <button
                type="button"
                className="linkbtn"
                onClick={resend}
                disabled={status === 'sending'}
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        {message && <p className={`auth-msg ${isError ? 'err' : 'ok'}`}>{message}</p>}
      </div>
    </div>
  )
}
