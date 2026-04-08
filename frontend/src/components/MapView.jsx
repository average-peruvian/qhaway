import { useState, useCallback } from 'react'
import DeckGL                  from '@deck.gl/react'
import { H3HexagonLayer }      from '@deck.gl/geo-layers'
import Map                     from 'react-map-gl/maplibre'
import { useFilters, taxaParams } from '../hooks/useFilters'
import { useApi }              from '../hooks/useApi'
import { api }                 from '../lib/api'
 
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
 
const INITIAL_VIEW = {
  longitude: 0, latitude: 20,
  zoom: 1.8, pitch: 0, bearing: 0,
}
 
const METRICS  = ['obs', 'species', 'observers']
const METRIC_LABEL = { obs: 'observaciones', species: 'especies', observers: 'observadores' }
 
// Green ramp matching design system
const COLOR_RANGE = [
  [13,  32, 16],
  [29,  60, 35],
  [45,  90, 55],
  [78, 144, 104],
  [109, 184, 138],
  [196, 255, 218],
]
 
export default function MapView() {
  const { filters }              = useFilters()
  const [metric, setMetric]      = useState('obs')
  const [resolution, setRes]     = useState(3)
  const [hovered, setHovered]    = useState(null)
  const [viewState, setViewState]= useState(INITIAL_VIEW)
  const [showR5Warn, setShowR5Warn] = useState(false)
 
  const hasGeoFilter = filters.eco_ids.length > 0
 
  const handleResolution = (r) => {
    if (r === 5 && !hasGeoFilter) {
      setShowR5Warn(true)
    } else {
      setRes(r)
    }
  }
 
  const params = {
    ...taxaParams(filters),
    metric,
    resolution,
  }
 
  const { data, loading } = useApi(api.mapHex, params)
 
  const layer = data && new H3HexagonLayer({
    id:            'hex',
    data:          data.data,
    getHexagon:    d => d.h3,
    getElevation:  0,
    extruded:      false,
    filled:        true,
    getFillColor:  d => valueToColor(d.value, data.data),
    pickable:      true,
    opacity:       0.85,
    colorRange:    COLOR_RANGE,
    onHover:       info => setHovered(info.object || null),
    updateTriggers:{ getFillColor: data.data },
  })
 
  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      {/* Controls */}
      <div style={s.controls}>
        <span style={s.label}>Métrica</span>
        {METRICS.map(m => (
          <Chip key={m} active={metric === m} onClick={() => setMetric(m)}>
            {METRIC_LABEL[m]}
          </Chip>
        ))}
        <div style={s.divider} />
        <span style={s.label}>Resolución H3</span>
        <Chip active={resolution === 3} onClick={() => handleResolution(3)}>global (r3)</Chip>
        <Chip active={resolution === 5} onClick={() => handleResolution(5)}>regional (r5)</Chip>
        {loading && <span style={s.loadingDot} title="cargando..." />}
      </div>
 
      {/* R5 Warning */}
      {showR5Warn && (
        <div style={s.warnOverlay}>
          <div style={s.warnBox}>
            <div style={s.warnTitle}>⚠ Advertencia ⚠</div>
            <div style={s.warnText}>
              Cargar resolución regional (r5) sin filtros geográficos activos generará una cantidad masiva de celdas H3, lo que puede ralentizar significativamente la página.
            </div>
            <div style={s.warnText}>
              Se recomienda activar el modo investigación o seleccionar ecorregiones primero.
            </div>
            <div style={s.warnActions}>
              <div style={s.warnBtn} onClick={() => setShowR5Warn(false)}>Cancelar</div>
              <div style={{ ...s.warnBtn, ...s.warnBtnDanger }} onClick={() => { setRes(5); setShowR5Warn(false) }}>Acepto el riesgo</div>
            </div>
          </div>
        </div>
      )}
 
      {/* Map */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller
        layers={layer ? [layer] : []}
        style={{ position:'absolute', inset:0, top:44 }}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
 
      {/* Tooltip */}
      {hovered && (
        <div style={s.tooltip}>
          <div style={s.tooltipVal}>{hovered.value?.toLocaleString()}</div>
          <div style={s.tooltipLabel}>{METRIC_LABEL[metric]}</div>
          <div style={s.tooltipCell}>{hovered.h3}</div>
        </div>
      )}
 
      {/* Legend */}
      <div style={s.legend}>
        <div style={s.legendTitle}>{METRIC_LABEL[metric]} / celda H3</div>
        <div style={s.legendBar} />
        <div style={s.legendLabels}><span>mín</span><span>máx</span></div>
      </div>
 
      {/* Cell count */}
      {data && (
        <div style={s.cellCount}>
          {data.n_cells.toLocaleString()} celdas
        </div>
      )}
    </div>
  )
}
 
// ── Helpers ────────────────────────────────────────────────────────────────
function valueToColor(value, allData) {
  if (!allData?.length || !value) return [13, 32, 16, 60]
  const max = Math.max(...allData.map(d => d.value))
  const t   = Math.pow(value / max, 0.4)   // power scale para ver más detalle en rangos bajos
  const i   = Math.min(Math.floor(t * (COLOR_RANGE.length - 1)), COLOR_RANGE.length - 1)
  return [...COLOR_RANGE[i], 200]
}
 
function Chip({ children, active, onClick }) {
  return (
    <div onClick={onClick} style={{ ...s.chip, ...(active ? s.chipActive : {}) }}>
      {children}
    </div>
  )
}
 
// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  controls:  { position:'absolute', top:0, left:0, right:0, zIndex:10, display:'flex', alignItems:'center', gap:8, padding:'6px 16px', background:'var(--surface)', borderBottom:'1px solid var(--border)', height:44 },
  label:     { fontSize:10, color:'var(--text-3)', letterSpacing:'0.1em', textTransform:'uppercase', marginRight:2 },
  divider:   { width:1, height:16, background:'var(--border-2)', margin:'0 4px' },
  chip:      { display:'inline-flex', alignItems:'center', padding:'3px 9px', border:'1px solid var(--border-2)', borderColor:'var(--border-2)', fontSize:11, color:'var(--text-2)', cursor:'pointer', background:'transparent' },
  chipActive:{ borderColor:'var(--accent)', color:'var(--accent-glow)', background:'rgba(78,144,104,0.08)' },
  loadingDot:{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', marginLeft:4, animation:'pulse 1.2s ease-in-out infinite', opacity:.7 },
 
  tooltip:      { position:'absolute', bottom:60, left:20, zIndex:20, background:'rgba(13,18,14,0.95)', border:'1px solid var(--border-2)', padding:'10px 14px', pointerEvents:'none' },
  tooltipVal:   { fontFamily:'var(--font-mono)', fontSize:20, fontWeight:500, color:'var(--accent-glow)' },
  tooltipLabel: { fontSize:11, color:'var(--text-2)', marginTop:2 },
  tooltipCell:  { fontSize:10, color:'var(--text-3)', marginTop:4, fontFamily:'var(--font-mono)' },
 
  legend:      { position:'absolute', bottom:20, right:20, zIndex:10, background:'rgba(13,18,14,0.9)', border:'1px solid var(--border-2)', padding:'10px 14px' },
  legendTitle: { fontFamily:'var(--font-display)', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-2)', marginBottom:8 },
  legendBar:   { height:6, width:120, background:'linear-gradient(to right, #0d2010, #2d6040, #4e9068, #6db88a, #c4ffda)', borderRadius:1 },
  legendLabels:{ display:'flex', justifyContent:'space-between', width:120, marginTop:4, fontSize:10, color:'var(--text-3)' },
 
  cellCount: { position:'absolute', bottom:20, left:20, zIndex:10, fontSize:10, color:'var(--text-3)', background:'rgba(13,18,14,0.8)', border:'1px solid var(--border)', padding:'5px 10px' },
 
  warnOverlay: { position:'absolute', inset:0, zIndex:50, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' },
  warnBox:     { background:'var(--surface)', border:'1px solid var(--border-2)', padding:'24px 28px', maxWidth:400 },
  warnTitle:   { fontFamily:'var(--font-display)', fontSize:14, fontWeight:600, color:'var(--warm)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 },
  warnText:    { fontSize:12, color:'var(--text-2)', lineHeight:1.7, marginBottom:10 },
  warnActions: { display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 },
  warnBtn:     { padding:'6px 14px', fontSize:11, fontFamily:'var(--font-mono)', border:'1px solid var(--border-2)', color:'var(--text-2)', cursor:'pointer', background:'transparent' },
  warnBtnDanger: { borderColor:'var(--warm-dim)', color:'var(--warm)' },
}