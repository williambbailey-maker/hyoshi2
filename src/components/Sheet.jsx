import { useEffect, useState } from 'react'

// Reusable slide-up sheet with a frosted backdrop. Stays mounted briefly after
// closing so the slide-down animation can play.
export default function Sheet({ open, onClose, children }) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
    } else {
      const t = setTimeout(() => setMounted(false), 320)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!mounted) return null

  return (
    <>
      <div className={`sheet-bg ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`sheet ${open ? 'open' : ''}`}>
        <div className="grip" />
        {children}
      </div>
    </>
  )
}
