import { createContext, useContext, useState, useCallback } from 'react'

const FiltersCtx = createContext(null)

const DEFAULTS = {
  kingdom:  [],
  phylum:   [],
  class:    [],
  order:    [],
  year_min: 2010,
  year_max: 2025,
  grade:    'research',
}

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULTS)

  const set = useCallback((key, value) =>
    setFilters(prev => ({ ...prev, [key]: value })), [])

  // Toggle a value in a taxa array, and clear child levels
  const toggleTaxon = useCallback((level, value) => {
    setFilters(prev => {
      const arr = prev[level]
      const next = arr.includes(value)
        ? arr.filter(v => v !== value)
        : [...arr, value]
      const updated = { ...prev, [level]: next }
      // Clear child levels when parent changes
      const levels = ['kingdom', 'phylum', 'class', 'order']
      const idx = levels.indexOf(level)
      for (let i = idx + 1; i < levels.length; i++) {
        updated[levels[i]] = []
      }
      return updated
    })
  }, [])

  const clearLevel = useCallback((level) => {
    setFilters(prev => {
      const updated = { ...prev, [level]: [] }
      const levels = ['kingdom', 'phylum', 'class', 'order']
      const idx = levels.indexOf(level)
      for (let i = idx + 1; i < levels.length; i++) {
        updated[levels[i]] = []
      }
      return updated
    })
  }, [])

  const reset = useCallback(() => setFilters(DEFAULTS), [])

  return (
    <FiltersCtx.Provider value={{ filters, set, toggleTaxon, clearLevel, reset }}>
      {children}
    </FiltersCtx.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FiltersCtx)
  if (!ctx) throw new Error('useFilters must be inside FiltersProvider')
  return ctx
}

/**
 * Builds query params object from taxa filter arrays.
 * Empty arrays are omitted (= no filter at that level).
 */
export function taxaParams(filters) {
  const p = {}
  if (filters.kingdom.length) p.kingdom = filters.kingdom.join(',')
  if (filters.phylum.length)  p.phylum = filters.phylum.join(',')
  if (filters.class.length)   p.class = filters.class.join(',')
  if (filters.order.length)   p.order = filters.order.join(',')
  p.year_min = filters.year_min
  p.year_max = filters.year_max
  p.grade    = filters.grade
  return p
}