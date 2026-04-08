import { useRef, useEffect, useState } from 'react'
import * as Plot from '@observablehq/plot'
import { useFilters, taxaParams } from '../hooks/useFilters'
import { useApi }     from '../hooks/useApi'
import { api }        from '../lib/api'

// ── Temporal ──────────────────────────────────────────────────────────────
export function Temporal() {
  const { filters }              = useFilters()
  const [granularity, setGran]   = useState('monthly')
  const containerRef             = useRef(null)

  const params = {
    ...taxaParams(filters),
    granularity,
  }
  const { data, loading } = useApi(api.temporal, params)

  useEffect(() => {
    if (!data?.data?.length || !containerRef.current) return
    const el = containerRef.current
    el.innerHTML = ''

    const rows = data.data.map(d => ({
      ...d,
      date: new Date(d.date + (granularity === 'monthly' ? '-01' : '')),
    }))

    const chart = Plot.plot({
      style:      { background: 'transparent', color: '#6e8e6e', fontFamily: 'IBM Plex Mono' },
      width:      el.clientWidth,
      height:     el.clientHeight - 20,
      marginLeft: 60,
      x:          { label: null, grid: true },
      y:          { label: 'observaciones', grid: true },
      marks: [
        Plot.areaY(rows, { x: 'date', y: 'n_obs', fill: '#4e9068', fillOpacity: 0.15 }),
        Plot.lineY(rows, { x: 'date', y: 'n_obs', stroke: '#4e9068', strokeWidth: 1.5 }),
      ],
    })

    el.appendChild(chart)
    return () => chart.remove()
  }, [data, granularity])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={s.controls}>
        <span style={s.label}>Granularidad</span>
        {['monthly', 'yearly'].map(g => (
          <Chip key={g} active={granularity === g} onClick={() => setGran(g)}>{g}</Chip>
        ))}
        {loading && <span style={s.loading}>cargando...</span>}
      </div>
      <div ref={containerRef} style={{ flex: 1, padding: '16px 20px', overflow: 'hidden' }} />
    </div>
  )
}

// ── TaxonTree ─────────────────────────────────────────────────────────────
export function TaxonTree() {
  const { filters }       = useFilters()
  const [depth, setDepth] = useState(3)
  const containerRef      = useRef(null)

  const params = { ...taxaParams(filters), depth }
  const { data, loading } = useApi(api.taxonTree, params)

  useEffect(() => {
    if (!data?.data?.length || !containerRef.current) return
    const el = containerRef.current
    el.innerHTML = ''

    // Top-N bar chart por n_obs — estable y sin crash
    const rows = [...data.data]
      .sort((a, b) => b.n_obs - a.n_obs)
      .slice(0, 40)
      .map(d => ({
        label: d.path.split('/').pop(),
        n_obs: d.n_obs,
        n_species: d.n_species,
      }))

    const chart = Plot.plot({
      style:       { background: 'transparent', color: '#6e8e6e', fontFamily: 'IBM Plex Mono' },
      width:       el.clientWidth,
      height:      Math.max(400, rows.length * 18),
      marginLeft:  200,
      marginRight: 40,
      x:           { label: 'observaciones', grid: true },
      y:           { label: null },
      marks: [
        Plot.barX(rows, {
          x:    'n_obs',
          y:    'label',
          fill: '#4e9068',
          sort: { y: '-x' },
        }),
        Plot.text(rows, {
          x:          'n_obs',
          y:          'label',
          text:       d => d.n_obs.toLocaleString(),
          dx:         4,
          textAnchor: 'start',
          fontSize:   10,
          fill:       '#6e8e6e',
        }),
      ],
    })

    el.appendChild(chart)
    return () => chart.remove()
  }, [data, depth])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={s.controls}>
        <span style={s.label}>Nivel taxonómico</span>
        {[
          [2, 'filo'],
          [3, 'clase'],
          [4, 'orden'],
          [5, 'familia'],
        ].map(([d, label]) => (
          <Chip key={d} active={depth === d} onClick={() => setDepth(d)}>{label}</Chip>
        ))}
        {loading && <span style={s.loading}>cargando...</span>}
      </div>
      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }} />
    </div>
  )
}

// ── Bias ──────────────────────────────────────────────────────────────────
export function Bias() {
  const { filters }             = useFilters()
  const [metric, setMetric]     = useState('observers')
  const containerRef            = useRef(null)

  const params = { kingdom: filters.kingdom, metric }
  const { data, loading }       = useApi(api.bias, params)

  useEffect(() => {
    if (!data?.data?.length || !containerRef.current) return
    const el = containerRef.current
    el.innerHTML = ''

    // Histograma de distribución de valores — evita el crash de 10k+ categorías
    const rows = data.data.map(d => ({ value: +d.value }))
      .filter(d => d.value > 0)

    const chart = Plot.plot({
      style:      { background: 'transparent', color: '#6e8e6e', fontFamily: 'IBM Plex Mono' },
      width:      el.clientWidth,
      height:     el.clientHeight - 20,
      marginLeft: 60,
      x:          { label: METRIC_LABEL[metric], grid: true, type: 'log' },
      y:          { label: 'celdas H3', grid: true },
      marks: [
        Plot.rectY(
          rows,
          Plot.binX({ y: 'count' }, {
            x:          'value',
            fill:       '#4e9068',
            fillOpacity: 0.8,
            thresholds: 40,
          })
        ),
        Plot.ruleY([0]),
      ],
    })

    el.appendChild(chart)
    return () => chart.remove()
  }, [data, metric])

  const METRICS = ['observers', 'coverage', 'anomaly']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={s.controls}>
        <span style={s.label}>Métrica de sesgo</span>
        {METRICS.map(m => (
          <Chip key={m} active={metric === m} onClick={() => setMetric(m)}>
            {METRIC_LABEL[m]}
          </Chip>
        ))}
        {loading && <span style={s.loading}>cargando...</span>}
      </div>
      <div ref={containerRef} style={{ flex: 1, padding: '16px 20px', overflow: 'hidden' }} />
    </div>
  )
}

// ── Shared ─────────────────────────────────────────────────────────────────
const METRIC_LABEL = {
  observers: 'observadores',
  coverage:  'cobertura obs/spp',
  anomaly:   'anomaly score',
}

function Chip({ children, active, onClick }) {
  return (
    <div onClick={onClick} style={{ ...s.chip, ...(active ? s.chipActive : {}) }}>
      {children}
    </div>
  )
}

const s = {
  controls:  { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 },
  label:     { fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 },
  chip:      { display: 'inline-flex', alignItems: 'center', padding: '3px 9px', border: '1px solid var(--border-2)', borderColor: 'var(--border-2)', fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', background: 'transparent' },
  chipActive:{ borderColor: 'var(--accent)', color: 'var(--accent-glow)', background: 'rgba(78,144,104,0.08)' },
  loading:   { fontSize: 11, color: 'var(--text-3)', marginLeft: 8 },
}

// ── Cobertura (Sesgo taxonómico — Troudet 2017) ───────────────────────────
export function Cobertura() {
  const { filters }            = useFilters()
  const [metric, setMetric]    = useState('deviation')
  const deviationRef           = useRef(null)
  const coverageRef            = useRef(null)

  const params = { ...taxaParams(filters) }
  const { data, loading }      = useApi(api.biasTroudet, params)

  // Deviation chart
  useEffect(() => {
    if (!data?.data?.length || !deviationRef.current || metric !== 'deviation') return
    const el = deviationRef.current
    el.innerHTML = ''

    const rows = data.data.slice(0, 30)

    const chart = Plot.plot({
      style:       { background:'transparent', color:'#6e8e6e', fontFamily:'IBM Plex Mono' },
      width:       el.clientWidth,
      height:      Math.max(300, rows.length * 22),
      marginLeft:  140,
      marginRight: 60,
      x:           { label:'desviación del muestreo ideal', grid:true },
      y:           { label:null },
      color:       { scheme:'BrBG', domain:[-1, 1], type:'linear' },
      marks: [
        Plot.barX(rows, {
          x:    'deviation',
          y:    'class',
          fill: d => d.deviation > 0 ? '#4e9068' : '#a05050',
          sort: { y:'-x' },
        }),
        Plot.text(rows, {
          x:          'deviation',
          y:          'class',
          text:       d => (d.deviation > 0 ? '+' : '') + Math.round(d.deviation).toLocaleString(),
          dx:         d => d.deviation >= 0 ? 4 : -4,
          textAnchor: d => d.deviation >= 0 ? 'start' : 'end',
          fontSize:   9,
          fill:       '#6e8e6e',
        }),
        Plot.ruleX([0], { stroke:'#3e5a3e' }),
      ],
    })
    el.appendChild(chart)
    return () => chart.remove()
  }, [data, metric])

  // Coverage chart (p1, p20, p20d)
  useEffect(() => {
    if (!data?.data?.length || !coverageRef.current || metric !== 'coverage') return
    const el = coverageRef.current
    el.innerHTML = ''

    const classes = data.data.slice(0, 30)
    const rows = []
    for (const d of classes) {
      rows.push({ class:d.class, metric:'p≥1 obs',     value:d.p1 })
      rows.push({ class:d.class, metric:'p≥20 obs',    value:d.p20 })
      rows.push({ class:d.class, metric:'p≥20 celdas', value:d.p20d })
    }

    const chart = Plot.plot({
      style:       { background:'transparent', color:'#6e8e6e', fontFamily:'IBM Plex Mono' },
      width:       el.clientWidth,
      height:      Math.max(400, classes.length * 28),
      marginLeft:  140,
      marginRight: 40,
      x:           { label:'% especies', domain:[0, 100], grid:true },
      y:           { label:null },
      fy:          { label:null, padding:0.15 },
      color:       { domain:['p≥1 obs','p≥20 obs','p≥20 celdas'], range:['#6db88a','#4e9068','#2d5c3f'], legend:true },
      marks: [
        Plot.barX(rows, {
          x:    'value',
          fy:   'class',
          y:    'metric',
          fill: 'metric',
          sort: { fy: { value:'-x', reduce:'max' } },
        }),
        Plot.text(rows, {
          x:          'value',
          fy:         'class',
          y:          'metric',
          text:       d => d.value.toFixed(0) + '%',
          dx:         4,
          textAnchor: 'start',
          fontSize:   9,
          fill:       '#6e8e6e',
        }),
      ],
    })
    el.appendChild(chart)
    return () => chart.remove()
  }, [data, metric])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={s.controls}>
        <span style={s.label}>Sesgo taxonómico — Troudet 2017</span>
        <Chip active={metric === 'deviation'} onClick={() => setMetric('deviation')}>desviación</Chip>
        <Chip active={metric === 'coverage'} onClick={() => setMetric('coverage')}>cobertura</Chip>
        {loading && <span style={s.loading}>cargando...</span>}
        {data && (
          <span style={{ fontSize:10, color:'var(--text-3)', marginLeft:'auto', fontFamily:'var(--font-mono)' }}>
            {data.n_classes} clases · {data.total_species?.toLocaleString()} spp · {(data.total_obs / 1e6).toFixed(1)}M obs
          </span>
        )}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'8px 20px' }}>
        {metric === 'deviation' && <div ref={deviationRef} />}
        {metric === 'coverage' && <div ref={coverageRef} />}
        {!loading && (!data?.data?.length) && (
          <div style={{ padding:32, color:'var(--text-3)', fontSize:12, textAlign:'center' }}>Sin datos para los filtros seleccionados</div>
        )}
      </div>
    </div>
  )
}