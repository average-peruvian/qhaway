const BASE = '/api'

async function get(path, params = {}) {
  const url = new URL(BASE + path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v)
  })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}: ${url.pathname}`)
  return res.json()
}

export const api = {
  status:            ()       => get('/status'),
  stats:             (params) => get('/stats',             params),
  mapHex:            (params) => get('/map/hex',           params),
  temporal:          (params) => get('/temporal',          params),
  taxonTree:         (params) => get('/taxon/tree',        params),
  taxonOptions:      (params) => get('/taxon/options',     params),
  ecoregions:        ()       => get('/taxon/ecoregions'),
  ecoregionsGeoJson: ()       => fetch('/api/ecoregions/geojson').then(r => r.json()),
  biasTroudet:        (params) => get('/bias/troudet',          params),
  species:           (params) => get('/species',           params),
  speciesDetail:     (id)     => get(`/species/${id}`),
}