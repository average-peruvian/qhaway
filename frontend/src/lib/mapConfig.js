export const MAP_STYLE = {
  version: 8,
  sources: {
    'carto': {
      type: 'raster',
      tiles: [`https://api.maptiler.com/maps/backdrop-v4/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPTILER_KEY}`],
      tileSize: 512,
      attribution: '&copy; CartoDB, &copy; OpenStreetMap',
    },
  },
  layers: [
    { id: 'base', type: 'raster', source: 'carto' },
  ],
}
export const MAP_STYLE_NO_LABELS = {
  version: 8,
  sources: {
    'carto': {
      type: 'raster',
      tiles: [`https://api.maptiler.com/maps/backdrop-v4/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPTILER_KEY}`],
      tileSize: 512,
    },
  },
  layers: [
    { id: 'base', type: 'raster', source: 'carto' },
  ],
}