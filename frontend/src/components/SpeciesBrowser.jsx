import { useState, useEffect } from 'react'
import { useFilters, taxaParams } from '../hooks/useFilters'
import { api }        from '../lib/api'

const PAGE_SIZE = 48
const CARD_W = 220
const CARD_IMG_H = 150

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
  const [viewMode, setViewMode] = useState('list')
  const [sortBy, setSortBy]     = useState('obs')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  // Reset page on filter/search/sort change
  const filterKey = JSON.stringify(taxaParams(filters))
  useEffect(() => {
    setPage(1)
    setSelected(null)
  }, [filterKey, debouncedQ, sortBy])

  useEffect(() => {
    setLoading(true)
    api.species({
      ...taxaParams(filters),
      q: debouncedQ, page, page_size: PAGE_SIZE, sort_by: sortBy,
    })
      .then(res => { setItems(res.data ?? []); setTotal(res.total ?? 0) })
      .catch(err => console.error('[species]', err))
      .finally(() => setLoading(false))
  }, [filterKey, debouncedQ, page, sortBy])

  useEffect(() => {
    if (!selected) return
    setDetail(null)
    api.speciesDetail(selected.taxon_id).then(setDetail)
  }, [selected])

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1
  const goTo = p => setPage(Math.max(1, Math.min(p, totalPages)))

  return (
    <div style={s.root}>
      {/* Controls */}
      <div style={s.controls}>
        <div style={s.searchBox}>
          <span style={{ color:'var(--text-3)', fontSize:14 }}>⌕</span>
          <input style={s.searchInput} placeholder="Buscar especie..." value={q} onChange={e => setQ(e.target.value)} />
          {q && <span style={{ color:'var(--text-3)', cursor:'pointer', fontSize:11 }} onClick={() => setQ('')}>✕</span>}
        </div>
        <div style={s.controlGroup}>
          <span style={s.label}>Orden</span>
          {[['obs','obs'],['name','nombre'],['observers','observadores']].map(([v, l]) => (
            <Chip key={v} active={sortBy === v} onClick={() => setSortBy(v)}>{l}</Chip>
          ))}
        </div>
        <div style={s.controlGroup}>
          <Chip active={viewMode === 'list'} onClick={() => setViewMode('list')}>≡ lista</Chip>
          <Chip active={viewMode === 'grid'} onClick={() => setViewMode('grid')}>⊞ grid</Chip>
        </div>
        <span style={s.count}>{loading ? '...' : `${total.toLocaleString()} especies`}</span>
      </div>

      <div style={s.body}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          {/* List / Grid */}
          <div style={viewMode === 'list' ? s.list : s.grid}>
            {items.map(sp => viewMode === 'list'
              ? <ListRow key={sp.taxon_id} sp={sp} active={selected?.taxon_id === sp.taxon_id} onClick={() => setSelected(sp)} />
              : <GridCard key={sp.taxon_id} sp={sp} active={selected?.taxon_id === sp.taxon_id} onClick={() => setSelected(sp)} />
            )}
            {!loading && items.length === 0 && (
              <div style={{ padding:32, color:'var(--text-3)', fontSize:12, textAlign:'center', width:'100%' }}>Sin resultados</div>
            )}
          </div>

          {/* Pagination */}
          <div style={s.pagination}>
            <button style={s.pageBtn} disabled={page <= 1} onClick={() => goTo(1)}>« primera</button>
            <button style={s.pageBtn} disabled={page <= 1} onClick={() => goTo(page - 1)}>← anterior</button>
            <span style={s.pageInfo}>
              pág.{' '}
              <input type="number" style={s.pageInput} value={page} min={1} max={totalPages}
                onKeyDown={e => { if (e.key === 'Enter') goTo(parseInt(e.target.value)) }}
                onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) goTo(v) }}
              />
              {' '}/ {totalPages}
            </span>
            <button style={s.pageBtn} disabled={page >= totalPages} onClick={() => goTo(page + 1)}>siguiente →</button>
            <button style={s.pageBtn} disabled={page >= totalPages} onClick={() => goTo(totalPages)}>última »</button>
          </div>
        </div>

        {selected && <DetailPanel sp={selected} detail={detail} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}

/* ── List row ────────────────────────────────────────────────────────────── */
function ListRow({ sp, active, onClick }) {
  return (
    <div style={{ ...s.row, ...(active ? s.rowActive : {}) }} onClick={onClick}>
      {sp.photo_url
        ? <img src={sp.photo_url} alt="" style={s.rowThumb} />
        : <div style={s.rowThumbEmpty}>◯</div>}
      <div style={{ flex:3, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
          <span style={s.sciname}>{sp.name}</span>
          {sp.family && <span style={s.family}> · {sp.family}</span>}
        </div>
        {sp.vernacular_name && <div style={s.vernacular}>{sp.vernacular_name}</div>}
      </div>
      <div style={s.rowMeta}><span style={s.metaVal}>{sp.n_obs?.toLocaleString()}</span><span style={s.metaLabel}>obs</span></div>
      <div style={s.rowMeta}><span style={s.metaVal}>{sp.n_observers?.toLocaleString()}</span><span style={s.metaLabel}>obs.</span></div>
      <div style={s.rowMeta}><span style={s.metaVal}>{sp.n_cells}</span><span style={s.metaLabel}>celdas</span></div>
      <div style={s.kingdomTag}>{sp.kingdom}</div>
    </div>
  )
}

/* ── Grid card ───────────────────────────────────────────────────────────── */
function GridCard({ sp, active, onClick }) {
  return (
    <div style={{ ...s.card, ...(active ? s.cardActive : {}) }} onClick={onClick}>
      <div style={s.cardImgWrap}>
        {sp.photo_url
          ? <img src={sp.photo_url} alt="" style={s.cardPhoto} />
          : <div style={s.cardImgEmpty}>◯</div>}
        <div style={s.cardOverlay}>
          <span style={s.cardObs}>{sp.n_obs?.toLocaleString()} obs</span>
        </div>
      </div>
      <div style={s.cardText}>
        {sp.vernacular_name && <div style={s.cardVernacular}>{sp.vernacular_name}</div>}
        <div style={s.sciname}>{sp.name}</div>
        {sp.family && <div style={s.cardFamily}>{sp.family}</div>}
      </div>
    </div>
  )
}

/* ── Detail panel ────────────────────────────────────────────────────────── */
function DetailPanel({ sp, detail, onClose }) {
  return (
    <div style={s.panel}>
      <div style={s.panelHeader}>
        <div>
          <div style={s.panelSciname}>{sp.name}</div>
          {(detail?.vernacular_name || sp.vernacular_name) && (
            <div style={s.panelVernac}>{detail?.vernacular_name || sp.vernacular_name}</div>
          )}
        </div>
        <div style={s.closeBtn} onClick={onClose}>✕</div>
      </div>

      {(detail?.photo_url || sp.photo_url)
        ? <>
            <img src={detail?.photo_url || sp.photo_url} alt={sp.name} style={s.panelImg} />
            <div style={s.attribution}>
              {(detail?.photo_attribution || sp.photo_attribution) && <span>© {detail?.photo_attribution || sp.photo_attribution}</span>}
              {(detail?.photo_license || sp.photo_license) && <span style={s.license}>{detail?.photo_license || sp.photo_license}</span>}
            </div>
          </>
        : <div style={s.panelImgEmpty}>sin imagen</div>}

      <div style={s.panelStats}>
        {[
          ['Observaciones',   detail?.n_obs?.toLocaleString()],
          ['Observadores',    detail?.n_observers?.toLocaleString()],
          ['Primer registro', detail?.first_year],
          ['Último registro', detail?.last_year],
          ['Celdas H3',       sp.n_cells],
        ].map(([label, val]) => (
          <div key={label} style={s.statRow}>
            <span style={{ color:'var(--text-3)' }}>{label}</span>
            <span style={{ color:'var(--text)' }}>{val ?? '–'}</span>
          </div>
        ))}
      </div>

      <div style={s.taxonomy}>
        {['kingdom','phylum','class','order','family','genus'].map(rank =>
          detail?.[rank] ? (
            <div key={rank} style={s.taxonRow}>
              <span style={s.taxonRank}>{rank}</span>
              <span style={s.taxonVal}>{detail[rank]}</span>
            </div>
          ) : null
        )}
      </div>

      {detail?.description && (
        <div style={s.descBlock}>
          <div style={s.descLabel}>Descripción</div>
          <div style={s.descText}>{detail.description}</div>
          {(detail.desc_source || detail.desc_license) && (
            <div style={s.descAttrib}>
              {detail.desc_source && <span>Fuente: {detail.desc_source}</span>}
              {detail.desc_license && <span style={s.license}>{detail.desc_license}</span>}
            </div>
          )}
        </div>
      )}

      <a href={`https://www.inaturalist.org/observations?taxon_id=${sp.taxon_id}`}
        target="_blank" rel="noopener noreferrer" style={s.inatLink}>
        Ver en iNaturalist →
      </a>

      {!detail && <div style={{ fontSize:11, color:'var(--text-3)', padding:'20px 0' }}>cargando...</div>}
    </div>
  )
}

function Chip({ children, active, onClick }) {
  return <div onClick={onClick} style={{ ...s.chip, ...(active ? s.chipActive : {}) }}>{children}</div>
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const s = {
  root:     { display:'flex', flexDirection:'column', height:'100%' },
  controls: { display:'flex', alignItems:'center', gap:12, padding:'6px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface)', flexShrink:0, flexWrap:'wrap' },
  searchBox:{ display:'flex', alignItems:'center', gap:8, border:'1px solid var(--border-2)', padding:'4px 10px', width:240 },
  searchInput:{ background:'none', border:'none', outline:'none', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', width:'100%' },
  controlGroup: { display:'flex', alignItems:'center', gap:4 },
  label:    { fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginRight:2 },
  chip:     { display:'inline-flex', alignItems:'center', padding:'3px 8px', border:'1px solid var(--border-2)', borderColor:'var(--border-2)', fontSize:11, color:'var(--text-2)', cursor:'pointer', background:'transparent' },
  chipActive:{ borderColor:'var(--accent)', color:'var(--accent-glow)', background:'rgba(78,144,104,0.08)' },
  count:    { fontSize:11, color:'var(--text-3)', marginLeft:'auto' },

  body: { flex:1, display:'flex', overflow:'hidden' },

  // List
  list:     { flex:1, overflowY:'auto' },
  row:      { display:'flex', alignItems:'center', gap:12, padding:'6px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s' },
  rowActive:{ background:'rgba(78,144,104,0.06)' },
  rowThumb: { width:48, height:36, objectFit:'cover', borderRadius:2, flexShrink:0, background:'var(--surface-2)' },
  rowThumbEmpty: { width:48, height:36, borderRadius:2, flexShrink:0, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'var(--accent)', opacity:0.15 },
  rowMeta:  { display:'flex', flexDirection:'column', alignItems:'flex-end', minWidth:60 },
  metaVal:  { fontSize:12, color:'var(--text)', fontFamily:'var(--font-mono)' },
  metaLabel:{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  kingdomTag:{ fontSize:9, color:'var(--text-3)', border:'1px solid var(--border-2)', padding:'1px 6px', letterSpacing:'0.06em', textTransform:'uppercase', minWidth:60, textAlign:'center' },
  sciname:  { fontFamily:'var(--font-serif)', fontStyle:'italic', fontSize:12, color:'var(--text)' },
  family:   { fontSize:11, color:'var(--text-3)' },
  vernacular: { fontFamily:'var(--font-display)', fontSize:10, fontWeight:600, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.04em', marginTop:1 },

  // Grid — flexbox con ancho fijo
  grid:     { flex:1, overflowY:'auto', padding:16, display:'flex', flexWrap:'wrap', gap:12, alignContent:'flex-start', justifyContent:'center' },
  card:     { width:CARD_W, flexShrink:0, flexGrow:0, background:'var(--surface)', border:'1px solid var(--border)', cursor:'pointer' },
  cardActive:{ borderColor:'var(--accent)' },
  cardImgWrap: { width:CARD_W, height:CARD_IMG_H, background:'var(--surface-2)', position:'relative', overflow:'hidden' },
  cardPhoto:{ width:CARD_W, height:CARD_IMG_H, objectFit:'cover', display:'block' },
  cardImgEmpty: { width:CARD_W, height:CARD_IMG_H, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:'var(--accent)', opacity:0.15 },
  cardOverlay: { position:'absolute', bottom:0, left:0, right:0, padding:'16px 8px 6px', background:'linear-gradient(transparent, rgba(0,0,0,0.7))', display:'flex', justifyContent:'space-between', alignItems:'flex-end' },
  cardObs:  { fontSize:10, color:'#c0d4c0', fontFamily:'var(--font-mono)' },
  cardText: { padding:'8px 10px 10px' },
  cardVernacular: { fontFamily:'var(--font-display)', fontSize:12, fontWeight:600, color:'var(--text)', lineHeight:1.3, marginBottom:2 },
  cardFamily: { fontSize:10, color:'var(--text-3)', marginTop:2 },

  // Pagination
  pagination: { display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px', borderTop:'1px solid var(--border)', background:'var(--surface)', flexShrink:0 },
  pageBtn:  { background:'none', border:'1px solid var(--border-2)', color:'var(--text-2)', fontFamily:'var(--font-mono)', fontSize:11, padding:'3px 10px', cursor:'pointer' },
  pageInfo: { fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)' },
  pageInput:{ background:'var(--surface-2)', border:'1px solid var(--border-2)', color:'var(--text)', fontFamily:'var(--font-mono)', fontSize:11, padding:'2px 4px', width:50, textAlign:'center', outline:'none' },

  // Detail
  panel:       { width:280, borderLeft:'1px solid var(--border)', overflowY:'auto', background:'var(--surface)', padding:16, flexShrink:0 },
  panelHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 },
  panelSciname:{ fontFamily:'var(--font-serif)', fontStyle:'italic', fontSize:15, color:'var(--text)', lineHeight:1.3 },
  panelVernac: { fontFamily:'var(--font-display)', fontSize:11, fontWeight:600, letterSpacing:'0.05em', color:'var(--text-2)', textTransform:'uppercase', marginTop:3 },
  closeBtn:    { fontSize:12, color:'var(--text-3)', cursor:'pointer', padding:4 },
  panelImg:    { width:'100%', aspectRatio:'4/3', objectFit:'cover', marginBottom:4 },
  panelImgEmpty: { width:'100%', aspectRatio:'4/3', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--text-3)', marginBottom:14 },
  attribution: { display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text-3)', marginBottom:14, padding:'2px 0' },
  license:     { fontSize:9, color:'var(--text-3)', opacity:0.7 },
  panelStats:  { marginBottom:14 },
  statRow:     { display:'flex', justifyContent:'space-between', fontSize:11, lineHeight:2, borderBottom:'1px solid var(--border)' },
  taxonomy:    { marginBottom:14 },
  taxonRow:    { display:'flex', gap:8, fontSize:11, lineHeight:1.9 },
  taxonRank:   { color:'var(--text-3)', width:60, textTransform:'uppercase', fontSize:10, letterSpacing:'0.08em' },
  taxonVal:    { color:'var(--text-2)', fontStyle:'italic', fontFamily:'var(--font-serif)' },
  descBlock:   { borderTop:'1px solid var(--border)', paddingTop:12 },
  descLabel:   { fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 },
  descText:    { fontSize:11, color:'var(--text-2)', lineHeight:1.7 },
  descAttrib:  { display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text-3)', marginTop:6, opacity:0.7 },
  inatLink:    { display:'block', fontSize:11, color:'var(--accent-glow)', textDecoration:'none', borderTop:'1px solid var(--border)', paddingTop:12, marginTop:12 },
}