import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Passwordless email magic-link login. One email = one account.
export default function Auth() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [message, setMessage] = useState('')

  async function sendLink(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus('sending')
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('sent')
      setMessage(`Check ${trimmed} for a sign-in link. Open it on this device.`)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">Flow</div>
        <p className="tag">Your tasks, in sync everywhere.</p>
        <form onSubmit={sendLink}>
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
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
        {message && (
          <p className={`auth-msg ${status === 'error' ? 'err' : 'ok'}`}>{message}</p>
        )}
      </div>
    </div>
  )
}
