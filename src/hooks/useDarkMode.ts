import { useState, useEffect } from 'react'

export function useDarkMode(defaultDark = true) {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('hf-dark-mode')
    return stored !== null ? stored === 'true' : defaultDark
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('hf-dark-mode', String(dark))
  }, [dark])

  return { dark, toggle: () => setDark(d => !d) }
}
