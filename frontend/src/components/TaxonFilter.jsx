import { useState, useEffect } from 'react'
import { useFilters } from '../hooks/useFilters'
import { api } from '../lib/api'

const LEVELS = [
  { key: 'kingdom', label: 'Reino' },
  { key: 'phylum',  label: 'Filo' },
  { key: 'class',   label: 'Clase' },
  { key: 'order',   label: 'Orden' },
]

export default function TaxonFilter() {
  const { filters, toggleTaxon, clearLevel } = useFilters()
  const [options, setOptions] = useState(null)
  const [expanded, setExpanded] = useState('kingdom')

  // Fetch options whenever taxa selections change
  useEffect(() => {
    const params = {}
    if (filters.kingdom.length) params.kingdom = filters.kingdom.join(',')
    if (filters.phylum.length)  params.phylum  = filters.phylum.join(',')
    if (filters.class.length)   params.class   = filters.class.join(',')
    if (filters.grade !== 'all') params.grade   = filters.grade
    api.taxonOptions(params).then(setOptions)
  }, [filters.kingdom, filters.phylum, filters.class, filters.grade])

  if (!options) return <div style={s.loading}>cargando...</div>

  return (
    <div>
      {LEVELS.map(({ key, label }) => {
        const items = options[key] || []
        const selected = filters[key]
        const isExpanded = expanded === key
        const hasParent = key === 'kingdom' || filters[LEVELS[LEVELS.findIndex(l => l.key === key) - 1]?.key]?.length > 0

        return (
          <div key={key} style={{ opacity: hasParent ? 1 : 0.35 }}>
            {/* Level header */}
            <div
              style={s.levelHeader}
              onClick={() => hasParent && setExpanded(isExpanded ? null : key)}
            >
              <span style={s.levelArrow}>{isExpanded ? '▾' : '▸'}</span>
              <span style={s.levelLabel}>{label}</span>
              {selected.length > 0 && (
                <>
                  <span style={s.levelCount}>{selected.length}</span>
                  <span style={s.clearBtn} onClick={e => { e.stopPropagation(); clearLevel(key) }}>✕</span>
                </>
              )}
            </div>

            {/* Options list */}
            {isExpanded && hasParent && (
              <div style={s.optionsList}>
                {items.slice(0, 30).map(opt => {
                  const checked = selected.includes(opt.value)
                  return (
                    <div
                      key={opt.value}
                      style={{ ...s.option, ...(checked ? s.optionChecked : {}) }}
                      onClick={() => toggleTaxon(key, opt.value)}
                    >
                      <span style={{ ...s.checkbox, ...(checked ? s.checkboxChecked : {}) }}>
                        {checked ? '✓' : ''}
                      </span>
                      <span style={s.optionName}>{opt.value}</span>
                      <span style={s.optionCount}>{opt.n?.toLocaleString()}</span>
                    </div>
                  )
                })}
                {items.length > 30 && (
                  <div style={s.moreHint}>+{items.length - 30} más</div>
                )}
                {items.length === 0 && (
                  <div style={s.moreHint}>sin datos</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const s = {
  loading:    { fontSize:11, color:'var(--text-3)', padding:'8px 0' },
  levelHeader:{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', cursor:'pointer', userSelect:'none' },
  levelArrow: { fontSize:10, color:'var(--text-3)', width:12 },
  levelLabel: { fontSize:10, color:'var(--text-3)', letterSpacing:'0.1em', textTransform:'uppercase', flex:1 },
  levelCount: { fontSize:9, color:'var(--accent-glow)', background:'rgba(78,144,104,0.15)', padding:'1px 5px', borderRadius:2 },
  clearBtn:   { fontSize:9, color:'var(--text-3)', cursor:'pointer', padding:'0 2px' },

  optionsList:{ maxHeight:180, overflowY:'auto', marginBottom:4 },
  option:     { display:'flex', alignItems:'center', gap:6, padding:'3px 0 3px 14px', cursor:'pointer', fontSize:11, color:'var(--text-2)' },
  optionChecked: { color:'var(--accent-glow)' },
  checkbox:   { width:14, height:14, border:'1px solid var(--border-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, flexShrink:0, color:'var(--accent-glow)' },
  checkboxChecked: { borderColor:'var(--accent)', background:'rgba(78,144,104,0.15)' },
  optionName: { flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  optionCount:{ fontSize:9, color:'var(--text-3)', fontFamily:'var(--font-mono)' },
  moreHint:   { fontSize:10, color:'var(--text-3)', padding:'4px 14px', fontStyle:'italic' },
}