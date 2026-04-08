import { createContext, useContext, useState, useCallback } from 'react'

const FiltersCtx = createContext(null)

const DEFAULTS = {
  kingdom:  [],
  phylum:   [],
  class:    [],
  order:    [],
  eco_ids:  [],
  year_min: 2010,
  year_max: 2025,
  grade:    'research',
}

// ECO_IDs amazónicos Dinerstein 2017
const AMAZON_ECO_IDS = [480,508,465,466,490,464,484,498,446,570,483,460,512,505,444,565,476,469,496,474,497,463,481,518,507,511,473,482,503,467,493,479]

// Preset "Modo investigación": Arthropoda amazónico
export const RESEARCH_PRESET = {
  kingdom: ['Animalia'],
  phylum:  ['Arthropoda'],
  class:   [],
  order:   [],
  eco_ids: AMAZON_ECO_IDS,
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

  // Toggle research mode preset
  const toggleResearchMode = useCallback(() => {
    setFilters(prev => {
      const isActive = prev.kingdom.includes('Animalia') &&
                       prev.phylum.includes('Arthropoda') &&
                       prev.eco_ids.length === AMAZON_ECO_IDS.length
      if (isActive) return DEFAULTS
      return { ...prev, ...RESEARCH_PRESET }
    })
  }, [])

  // Toggle a single eco_id
  const toggleEcoregion = useCallback((ecoId) => {
    setFilters(prev => {
      const arr = prev.eco_ids
      const next = arr.includes(ecoId)
        ? arr.filter(v => v !== ecoId)
        : [...arr, ecoId]
      return { ...prev, eco_ids: next }
    })
  }, [])

  // Set multiple eco_ids at once (for biome selection)
  const setEcoregions = useCallback((ecoIds) => {
    setFilters(prev => ({ ...prev, eco_ids: ecoIds }))
  }, [])

  return (
    <FiltersCtx.Provider value={{
      filters, set, toggleTaxon, clearLevel, reset,
      toggleResearchMode, toggleEcoregion, setEcoregions,
    }}>
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
 * Builds query params object from all filter arrays.
 */
export function taxaParams(filters) {
  const p = {}
  if (filters.kingdom.length)  p.kingdom  = filters.kingdom.join(',')
  if (filters.phylum.length)   p.phylum   = filters.phylum.join(',')
  if (filters.class.length)    p.class    = filters.class.join(',')
  if (filters.order.length)    p.order    = filters.order.join(',')
  if (filters.eco_ids.length)  p.eco_ids  = filters.eco_ids.join(',')
  p.year_min = filters.year_min
  p.year_max = filters.year_max
  p.grade    = filters.grade
  return p
}