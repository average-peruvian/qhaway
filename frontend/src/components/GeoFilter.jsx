import { useState, useEffect, useMemo } from 'react'
import { useFilters } from '../hooks/useFilters'
import { api } from '../lib/api'

export default function GeoFilter() {
  const { filters, toggleEcoregion, setEcoregions } = useFilters()
  const [meta, setMeta] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.ecoregions().then(setMeta)
  }, [])

  // Group ecoregions by biome
  const biomes = useMemo(() => {
    if (!meta) return []
    const map = {}
    for (const eco of meta) {
      const key = eco.biome_num
      if (!map[key]) map[key] = { biome_num: key, biome_name: eco.biome_name, ecos: [] }
      map[key].ecos.push(eco)
    }
    return Object.values(map).sort((a, b) => a.biome_num - b.biome_num)
  }, [meta])

  if (!meta) return <div style={s.loading}>cargando...</div>

  const selectedSet = new Set(filters.eco_ids)

  const toggleBiome = (biome) => {
    const biomeEcoIds = biome.ecos.map(e => e.eco_id)
    const allSelected = biomeEcoIds.every(id => selectedSet.has(id))
    if (allSelected) {
      // Deselect all in this biome
      setEcoregions(filters.eco_ids.filter(id => !biomeEcoIds.includes(id)))
    } else {
      // Select all in this biome
      const merged = new Set([...filters.eco_ids, ...biomeEcoIds])
      setEcoregions([...merged])
    }
  }

  return (
    <div>
      {biomes.map(biome => {
        const isExpanded = expanded === biome.biome_num
        const biomeEcoIds = biome.ecos.map(e => e.eco_id)
        const selectedCount = biomeEcoIds.filter(id => selectedSet.has(id)).length
        const allSelected = selectedCount === biomeEcoIds.length && selectedCount > 0

        return (
          <div key={biome.biome_num}>
            <div style={s.biomeHeader}>
              {/* Biome checkbox */}
              <span
                style={{ ...s.checkbox, ...(allSelected ? s.checkboxChecked : selectedCount > 0 ? s.checkboxPartial : {}) }}
                onClick={() => toggleBiome(biome)}
              >
                {allSelected ? '✓' : selectedCount > 0 ? '–' : ''}
              </span>
              {/* Biome name + expand */}
              <span style={s.biomeName} onClick={() => setExpanded(isExpanded ? null : biome.biome_num)}>
                {biome.biome_name}
              </span>
              <span style={s.biomeCount}>{biome.ecos.length}</span>
              <span style={s.expandArrow} onClick={() => setExpanded(isExpanded ? null : biome.biome_num)}>
                {isExpanded ? '▾' : '▸'}
              </span>
            </div>

            {isExpanded && (
              <div style={s.ecoList}>
                {biome.ecos.map(eco => {
                  const checked = selectedSet.has(eco.eco_id)
                  return (
                    <div
                      key={eco.eco_id}
                      style={{ ...s.ecoItem, ...(checked ? s.ecoChecked : {}) }}
                      onClick={() => toggleEcoregion(eco.eco_id)}
                    >
                      <span style={{ ...s.checkbox, ...(checked ? s.checkboxChecked : {}) }}>
                        {checked ? '✓' : ''}
                      </span>
                      <span style={s.ecoName}>{eco.eco_name}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {selectedSet.size > 0 && (
        <div style={s.clearAll} onClick={() => setEcoregions([])}>
          limpiar selección ({selectedSet.size})
        </div>
      )}
    </div>
  )
}

const s = {
  loading:   { fontSize:11, color:'var(--text-3)', padding:'8px 0' },

  biomeHeader: { display:'flex', alignItems:'center', gap:5, padding:'4px 0', cursor:'pointer', userSelect:'none' },
  checkbox:    { width:13, height:13, border:'1px solid var(--border-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, flexShrink:0, color:'var(--accent-glow)', cursor:'pointer' },
  checkboxChecked: { borderColor:'var(--accent)', background:'rgba(78,144,104,0.15)' },
  checkboxPartial: { borderColor:'var(--accent-dim)', background:'rgba(78,144,104,0.08)' },
  biomeName:   { flex:1, fontSize:10, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' },
  biomeCount:  { fontSize:9, color:'var(--text-3)', fontFamily:'var(--font-mono)' },
  expandArrow: { fontSize:9, color:'var(--text-3)', width:12, textAlign:'center', cursor:'pointer' },

  ecoList:   { maxHeight:160, overflowY:'auto', marginBottom:4 },
  ecoItem:   { display:'flex', alignItems:'center', gap:5, padding:'2px 0 2px 16px', cursor:'pointer', fontSize:10, color:'var(--text-2)' },
  ecoChecked:{ color:'var(--accent-glow)' },
  ecoName:   { flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },

  clearAll:  { fontSize:10, color:'var(--text-3)', cursor:'pointer', padding:'6px 0 0', textDecoration:'underline' },
}