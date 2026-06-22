import { useState, useEffect, useMemo } from 'react'
import DeckGL              from '@deck.gl/react'
import { GeoJsonLayer }    from '@deck.gl/layers'
import Map                 from 'react-map-gl/maplibre'
import { useFilters }      from '../hooks/useFilters'
import { api }             from '../lib/api'
import { MAP_STYLE_NO_LABELS } from '../lib/mapConfig'

const INITIAL_VIEW = {
  longitude: 0, latitude: 10,
  zoom: 1.5, pitch: 0, bearing: 0,
}

// 14 biome colors — muted earth tones
const BIOME_COLORS = {
  1:  [30, 100, 50],    // Tropical moist broadleaf
  2:  [60, 120, 40],    // Tropical dry broadleaf
  3:  [90, 140, 30],    // Tropical coniferous
  4:  [40, 80, 60],     // Temperate broadleaf
  5:  [35, 70, 50],     // Temperate coniferous
  6:  [50, 90, 30],     // Boreal / Taiga
  7:  [100, 120, 50],   // Tropical grasslands
  8:  [80, 100, 60],    // Temperate grasslands
  9:  [70, 80, 40],     // Flooded grasslands
  10: [60, 70, 50],     // Montane grasslands
  11: [90, 80, 40],     // Tundra
  12: [70, 60, 30],     // Mediterranean
  13: [110, 90, 50],    // Deserts
  14: [40, 60, 50],     // Mangroves
}

const SELECTED_COLOR = [45, 92, 63]
const HOVER_COLOR = [122, 170, 110]

export default function EcoregionsView() {
  const { filters, toggleEcoregion } = useFilters()
  const [geojson, setGeojson]        = useState(null)
  const [hovered, setHovered]        = useState(null)
  const [viewState, setViewState]    = useState(INITIAL_VIEW)
  const [loading, setLoading]        = useState(true)

  // Load GeoJSON once
  useEffect(() => {
    setLoading(true)
    api.ecoregionsGeoJson()
      .then(setGeojson)
      .finally(() => setLoading(false))
  }, [])

  const selectedSet = useMemo(() => new Set(filters.eco_ids), [filters.eco_ids])

  const layer = geojson && new GeoJsonLayer({
    id: 'ecoregions',
    data: geojson,
    filled: true,
    stroked: true,
    pickable: true,
    getFillColor: f => {
      const ecoId = f.properties?.eco_id
      if (selectedSet.has(ecoId)) return [...SELECTED_COLOR, 180]
      if (hovered?.properties?.eco_id === ecoId) return [...HOVER_COLOR, 100]
      const biome = f.properties?.biome_num || 1
      return [...(BIOME_COLORS[biome] || [60, 60, 60]), 60]
    },
    getLineColor: f => {
      const ecoId = f.properties?.eco_id
      if (selectedSet.has(ecoId)) return [...SELECTED_COLOR, 255]
      return [100, 120, 90, 100]
    },
    getLineWidth: f => selectedSet.has(f.properties?.eco_id) ? 2 : 0.5,
    lineWidthUnits: 'pixels',
    onClick: info => {
      if (info.object?.properties?.eco_id) {
        toggleEcoregion(info.object.properties.eco_id)
      }
    },
    onHover: info => setHovered(info.object || null),
    updateTriggers: {
      getFillColor: [selectedSet, hovered?.properties?.eco_id],
      getLineColor: [selectedSet],
      getLineWidth: [selectedSet],
    },
  })

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      {/* Controls */}
      <div style={s.controls}>
        <span style={s.label}>Ecorregiones Dinerstein 2017</span>
        {loading && <span style={s.loadingDot} title="cargando..." />}
        <div style={{ flex:1 }} />
        {selectedSet.size > 0 && (
          <span style={s.selectedCount}>{selectedSet.size} seleccionadas</span>
        )}
      </div>

      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller
        layers={layer ? [layer] : []}
        style={{ position:'absolute', inset:0, top:44 }}
      >
        <Map mapStyle={MAP_STYLE_NO_LABELS} />
      </DeckGL>

      {/* Tooltip */}
      {hovered && (
        <div style={s.tooltip}>
          <div style={s.tooltipName}>{hovered.properties?.eco_name}</div>
          <div style={s.tooltipBiome}>{hovered.properties?.biome_name}</div>
          <div style={s.tooltipRealm}>{hovered.properties?.realm}</div>
        </div>
      )}

      {/* Legend */}
      <div style={s.legend}>
        <div style={s.legendTitle}>Biomas</div>
        {Object.entries(BIOME_COLORS).map(([num, rgb]) => (
          <div key={num} style={s.legendItem}>
            <div style={{ ...s.legendSwatch, background:`rgb(${rgb.join(',')})` }} />
            <span style={s.legendLabel}>{BIOME_LABELS[num] || `Bioma ${num}`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const BIOME_LABELS = {
  1: 'Tropical moist broadleaf',
  2: 'Tropical dry broadleaf',
  3: 'Tropical coniferous',
  4: 'Temperate broadleaf',
  5: 'Temperate coniferous',
  6: 'Boreal / Taiga',
  7: 'Tropical grasslands',
  8: 'Temperate grasslands',
  9: 'Flooded grasslands',
  10: 'Montane grasslands',
  11: 'Tundra',
  12: 'Mediterranean',
  13: 'Deserts',
  14: 'Mangroves',
}

const s = {
  controls:  { position:'absolute', top:0, left:0, right:0, zIndex:10, display:'flex', alignItems:'center', gap:8, padding:'6px 16px', background:'var(--topbar-bg)', borderBottom:'1px solid var(--border)', height:44 },
  label:     { fontSize:12, color:'var(--text-2)', fontFamily:'var(--font-display)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' },
  loadingDot:{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', marginLeft:4, opacity:.7 },
  selectedCount: { fontSize:11, color:'var(--accent-glow)', fontFamily:'var(--font-mono)' },

  tooltip:      { position:'absolute', bottom:60, left:20, zIndex:20, background:'rgba(237,235,229,0.95)', border:'1px solid var(--border-2)', padding:'10px 14px', pointerEvents:'none', maxWidth:300 },
  tooltipName:  { fontSize:12, color:'var(--text)', fontWeight:500, marginBottom:2 },
  tooltipBiome: { fontSize:11, color:'var(--text-2)' },
  tooltipRealm: { fontSize:10, color:'var(--text-3)', marginTop:2, fontStyle:'italic' },

  legend:       { position:'absolute', bottom:20, right:20, zIndex:10, background:'rgba(237,235,229,0.9)', border:'1px solid var(--border-2)', padding:'10px 14px', maxHeight:300, overflowY:'auto' },
  legendTitle:  { fontFamily:'var(--font-display)', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-2)', marginBottom:6 },
  legendItem:   { display:'flex', alignItems:'center', gap:6, marginBottom:3 },
  legendSwatch: { width:10, height:10, borderRadius:1, flexShrink:0 },
  legendLabel:  { fontSize:10, color:'var(--text-3)' },
}