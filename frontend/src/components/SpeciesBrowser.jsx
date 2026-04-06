import { useState, useEffect } from 'react'
import { useFilters } from '../hooks/useFilters'
import { api }        from '../lib/api'

const PAGE_SIZE = 48

export default function SpeciesBrowser() {
  const { filters }             = useFilters()
  const [q, setQ]               = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage]         = useState(1)
  const [items, setItems]       = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]     = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'
  const [sortBy, setSortBy]     = useState('obs')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  // Reset page on filter/search/sort change
  useEffect(() => {
    setPage(1)
    setSelected(null)
  }, [filters.kingdom, debouncedQ, sortBy])

  // Fetch
  useEffect(() => {
    setLoading(true)
    api.species({ kingdom: filters.kingdom, q: debouncedQ, page, page_size: PAGE_SIZE, sort_by: sortBy })
      .then(res => {
        setItems(res.data)
        setTotal(res.total ?? 0)
      })
      .finally(() => setLoading(false))
  }, [filters.kingdom, debouncedQ, page, sortBy])

  // Detail
  useEffect(() => {
    if (!selected) return
    setDetail(null)
    api.speciesDetail(selected.taxon_id).then(setDetail)
  }, [selected])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div style={s.root}>
      {/* Controls */}
      <div style={s.controls}>
        <div style={s.searchBox}>
          <span style={{ color:'var(--text-3)', fontSize:14 }}>⌕</span>
          <input
            style={s.searchInput}
            placeholder="Buscar especie..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <span style={{ color:'var(--text-3)', cursor:'pointer', fontSize:11 }} onClick={() => setQ('')}>✕</span>
          )}
        </div>

        <div style={s.controlGroup}>
          <span style={s.label}>Orden</span>
          {[['obs','obs'],['name','nombre'],['observers','observadores']].map(([val, label]) => (
            <Chip key={val} active={sortBy === val} onClick={() => setSortBy(val)}>{label}</Chip>
          ))}
        </div>

        <div style={s.controlGroup}>
          {['list','grid'].map(m => (
            <Chip key={m} active={viewMode === m} onClick={() => setViewMode(m)}>
              {m === 'list' ? '≡ lista' : '⊞ grid'}
            </Chip>
          ))}
        </div>

        <span style={s.count}>
          {loading ? '...' : `${total.toLocaleString()} especies`}
        </span>
      </div>

      <div style={s.body}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* List / Grid */}
          <div style={viewMode === 'list' ? s.list : s.grid}>
            {items.map(sp => viewMode === 'list'
              ? <ListRow key={sp.taxon_id} species={sp} active={selected?.taxon_id === sp.taxon_id} onClick={() => setSelected(sp)} />
              : <GridCard key={sp.taxon_id} species={sp} active={selected?.taxon_id === sp.taxon_id} onClick={() => setSelected(sp)} />
            )}
            {!loading && items.length === 0 && (
              <div style={{ padding:32, color:'var(--text-3)', fontSize:12, textAlign:'center' }}>
                Sin resultados
              </div>
            )}
          </div>

          {/* Pagination */}
          <div style={s.pagination}>
            <button style={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← anterior</button>
            <span style={s.pageInfo}>
              {loading ? '...' : `pág. ${page} / ${totalPages || 1}`}
            </span>
            <button style={s.pageBtn} disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>siguiente →</button>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel species={selected} detail={detail} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  )
}

function ListRow({ species, active, onClick }) {
  return (
    <div style={{ ...s.row, ...(active ? s.rowActive : {}) }} onClick={onClick}>
      <div style={{ flex:3 }}>
        <span style={s.sciname}>{species.name}</span>
        {species.family && <span style={s.family}> · {species.family}</span>}
      </div>
      <div style={s.rowMeta}>
        <span style={s.metaVal}>{species.n_obs?.toLocaleString()}</span>
        <span style={s.metaLabel}>obs</span>
      </div>
      <div style={s.rowMeta}>
        <span style={s.metaVal}>{species.n_observers?.toLocaleString()}</span>
        <span style={s.metaLabel}>obs.</span>
      </div>
      <div style={s.rowMeta}>
        <span style={s.metaVal}>{species.n_cells}</span>
        <span style={s.metaLabel}>celdas</span>
      </div>
      <div style={{ ...s.kingdomTag }}>
        {species.kingdom}
      </div>
    </div>
  )
}

function GridCard({ species, active, onClick }) {
  return (
    <div style={{ ...s.card, ...(active ? s.cardActive : {}) }} onClick={onClick}>
      <div style={s.cardImg}>
        <div style={s.cardImgPlaceholder}>◯</div>
      </div>
      <div style={s.cardBody}>
        <div style={s.sciname}>{species.name}</div>
        <div style={s.meta}>
          <span style={s.metaStat}><b>{species.n_obs?.toLocaleString()}</b> obs</span>
          <span style={s.metaStat}>{species.n_cells} celdas</span>
        </div>
      </div>
    </div>
  )
}

function DetailPanel({ species, detail, onClose }) {
  return (
    <div style={s.panel}>
      <div style={s.panelHeader}>
        <div>
          <div style={s.panelSciname}>{species.name}</div>
          {detail?.vernacular_name && <div style={s.panelVernac}>{detail.vernacular_name}</div>}
        </div>
        <div style={s.closeBtn} onClick={onClose}>✕</div>
      </div>

      {detail?.photo_url
        ? <img src={detail.photo_url} alt={species.name} style={s.panelImg} />
        : <div style={s.panelImgPlaceholder}>sin imagen</div>
      }

      <div style={s.panelStats}>
        {[
          ['Observaciones',  detail?.n_obs?.toLocaleString()],
          ['Observadores',   detail?.n_observers?.toLocaleString()],
          ['Primer registro',detail?.first_year],
          ['Último registro',detail?.last_year],
          ['Celdas H3',      species.n_cells],
        ].map(([label, val]) => (
          <div key={label} style={s.statRow}>
            <span style={{ color:'var(--text-3)' }}>{label}</span>
            <span style={{ color:'var(--text)' }}>{val ?? '–'}</span>
          </div>
        ))}
      </div>

      <div style={s.taxonomy}>
        {['kingdom','phylum','class','order','family','genus'].map(rank => (
          detail?.[rank] ? (
            <div key={rank} style={s.taxonRow}>
              <span style={s.taxonRank}>{rank}</span>
              <span style={s.taxonVal}>{detail[rank]}</span>
            </div>
          ) : null
        ))}
      </div>

      {detail?.description && (
        <div style={s.description}>{detail.description}</div>
      )}

      {!detail && (
        <div style={{ fontSize:11, color:'var(--text-3)', padding:'20px 0' }}>cargando...</div>
      )}
    </div>
  )
}

function Chip({ children, active, onClick }) {
  return (
    <div onClick={onClick} style={{ ...s.chip, ...(active ? s.chipActive : {}) }}>
      {children}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = {
  root:     { display:'flex', flexDirection:'column', height:'100%' },
  controls: { display:'flex', alignItems:'center', gap:12, padding:'6px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface)', flexShrink:0, flexWrap:'wrap' },
  searchBox:{ display:'flex', alignItems:'center', gap:8, border:'1px solid var(--border-2)', padding:'4px 10px', width:240 },
  searchInput:{ background:'none', border:'none', outline:'none', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', width:'100%' },
  controlGroup: { display:'flex', alignItems:'center', gap:4 },
  label:    { fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginRight:2 },
  chip:     { display:'inline-flex', alignItems:'center', padding:'3px 8px', border:'1px solid var(--border-2)', fontSize:11, color:'var(--text-2)', cursor:'pointer' },
  chipActive:{ borderColor:'var(--accent)', color:'var(--accent-glow)', background:'rgba(78,144,104,0.08)' },
  count:    { fontSize:11, color:'var(--text-3)', marginLeft:'auto' },

  body: { flex:1, display:'flex', overflow:'hidden' },

  // List view
  list: { flex:1, overflowY:'auto' },
  row:  { display:'flex', alignItems:'center', gap:16, padding:'8px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s' },
  rowActive: { background:'rgba(78,144,104,0.06)', borderColor:'var(--accent)' },
  rowMeta:  { display:'flex', flexDirection:'column', alignItems:'flex-end', minWidth:60 },
  metaVal:  { fontSize:12, color:'var(--text)', fontFamily:'var(--font-mono)' },
  metaLabel:{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  kingdomTag:{ fontSize:9, color:'var(--text-3)', border:'1px solid var(--border-2)', padding:'1px 6px', letterSpacing:'0.06em', textTransform:'uppercase', minWidth:60, textAlign:'center' },

  // Grid view
  grid: { flex:1, overflowY:'auto', padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:10, alignContent:'start' },
  card:       { background:'var(--surface)', border:'1px solid var(--border)', cursor:'pointer', overflow:'hidden' },
  cardActive: { borderColor:'var(--accent)' },
  cardImg:    { aspectRatio:'4/3', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center' },
  cardImgPlaceholder: { fontSize:28, color:'var(--accent)', opacity:0.15 },
  cardBody:   { padding:'8px 10px 10px' },
  meta:       { display:'flex', gap:8, marginTop:4 },
  metaStat:   { fontSize:10, color:'var(--text-3)' },

  // Pagination
  pagination: { display:'flex', alignItems:'center', justifyContent:'center', gap:16, padding:'8px', borderTop:'1px solid var(--border)', background:'var(--surface)', flexShrink:0 },
  pageBtn:    { background:'none', border:'1px solid var(--border-2)', color:'var(--text-2)', fontFamily:'var(--font-mono)', fontSize:11, padding:'3px 10px', cursor:'pointer' },
  pageInfo:   { fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)', minWidth:100, textAlign:'center' },

  sciname:  { fontFamily:'var(--font-serif)', fontStyle:'italic', fontSize:12, color:'var(--text)' },
  family:   { fontSize:11, color:'var(--text-3)' },

  // Detail panel
  panel:       { width:280, borderLeft:'1px solid var(--border)', overflowY:'auto', background:'var(--surface)', padding:16, flexShrink:0 },
  panelHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 },
  panelSciname:{ fontFamily:'var(--font-serif)', fontStyle:'italic', fontSize:15, color:'var(--text)', lineHeight:1.3 },
  panelVernac: { fontFamily:'var(--font-display)', fontSize:11, fontWeight:600, letterSpacing:'0.05em', color:'var(--text-2)', textTransform:'uppercase', marginTop:3 },
  closeBtn:    { fontSize:12, color:'var(--text-3)', cursor:'pointer', padding:4 },
  panelImg:    { width:'100%', aspectRatio:'4/3', objectFit:'cover', marginBottom:14 },
  panelImgPlaceholder: { width:'100%', aspectRatio:'4/3', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--text-3)', marginBottom:14 },
  panelStats:  { marginBottom:14 },
  statRow:     { display:'flex', justifyContent:'space-between', fontSize:11, lineHeight:2, borderBottom:'1px solid var(--border)' },
  taxonomy:    { marginBottom:14 },
  taxonRow:    { display:'flex', gap:8, fontSize:11, lineHeight:1.9 },
  taxonRank:   { color:'var(--text-3)', width:60, textTransform:'uppercase', fontSize:10, letterSpacing:'0.08em' },
  taxonVal:    { color:'var(--text-2)', fontStyle:'italic', fontFamily:'var(--font-serif)' },
  description: { fontSize:11, color:'var(--text-2)', lineHeight:1.7, borderTop:'1px solid var(--border)', paddingTop:12 },
}