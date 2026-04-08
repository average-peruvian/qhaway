import { useState } from 'react'
import Shell           from './components/Shell'
import MapView         from './components/MapView'
import EcoregionsView  from './components/EcoregionsView'
import SpeciesBrowser  from './components/SpeciesBrowser'
import { Temporal, TaxonTree, Cobertura } from './components/Charts'

const VIEWS = {
  ecoregions:{ label: 'Ecorregiones',          component: EcoregionsView },
  sightings: { label: 'Avistamientos',          component: MapView },
  taxon:     { label: 'Diversidad taxonómica',  component: TaxonTree },
  cobertura: { label: 'Sesgo taxonómico',       component: Cobertura },
  temporal:  { label: 'Tendencias temporales',   component: Temporal },
  species:   { label: 'Explorador de especies',  component: SpeciesBrowser },
}

export default function App() {
  const [activeView, setActiveView] = useState('sightings')
  const View = VIEWS[activeView].component

  return (
    <Shell
      activeView={activeView}
      viewLabel={VIEWS[activeView].label}
      onNav={setActiveView}
    >
      <View />
    </Shell>
  )
}