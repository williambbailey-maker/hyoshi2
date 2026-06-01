import Sheet from './Sheet'
import { supabase } from '../lib/supabase'

export default function AccountSheet({ open, onClose, email }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="sheet-title">Account</h2>
      <p className="account-email">Signed in as</p>
      <p style={{ fontSize: 16, marginBottom: 4 }}>{email}</p>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
        <button className="btn danger" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </Sheet>
  )
}
