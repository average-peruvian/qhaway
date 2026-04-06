import { createContext, useContext, useState } from 'react'

const FiltersCtx = createContext(null)

const DEFAULTS = {
  kingdom:  'all',
  year_min: 2010,
  year_max: 2025,
  grade:    'research',   // 'research' | 'all'
}

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULTS)

  const set = (key, value) =>
    setFilters(prev => ({ ...prev, [key]: value }))

  const reset = () => setFilters(DEFAULTS)

  return (
    <FiltersCtx.Provider value={{ filters, set, reset }}>
      {children}
    </FiltersCtx.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FiltersCtx)
  if (!ctx) throw new Error('useFilters must be inside FiltersProvider')
  return ctx
}