# Qhaway

Dashboard interactivo para exploración de datos de biodiversidad a escala global, con énfasis en el análisis de sesgo taxonómico y cobertura espacial de muestreo en la región amazónica transfronteriza.

Desarrollado como parte de una tesis de pregrado sobre clasificación open-vocabulary de insectos en la cuenca amazónica.

## Descripción general

Qhaway integra datos de iNaturalist Open Data (~300M observaciones), el GBIF Backbone Taxonomy y las ecorregiones globales de Dinerstein et al. (2017) en una aplicación de página única que permite filtrado multi-escala por taxonomía, geografía y tiempo.

El sistema está diseñado para ejecutarse en hardware modesto. Todas las tablas agregadas se pre-computan durante la fase de ETL y se cargan en RAM al inicio (~1GB), lo que permite respuestas sub-segundo sin necesidad de un servidor de base de datos tradicional.

## Vistas

| Vista | Descripción |
|---|---|
| Ecorregiones | Mapa mundial de ecorregiones Dinerstein 2017 (846 features, 14 biomas). Click para seleccionar/deseleccionar; las selecciones se propagan como filtros geográficos a todas las vistas. |
| Avistamientos | Mapa de densidad hexagonal H3 a resolución 3 (global) y 5 (regional). Métricas: conteo de observaciones, riqueza de especies, conteo de observadores. |
| Taxonomía | Gráfico de barras horizontal de los top-N taxa por conteo de observaciones a profundidad configurable (filo a familia). |
| Cobertura | Métricas de sesgo taxonómico siguiendo Troudet et al. (2017): desviación del esfuerzo de muestreo ideal y completitud del inventario de especies (p≥1, p≥20, p≥20 celdas H3 distintas) por clase. |
| Temporal | Serie temporal mensual y anual de acumulación de observaciones. |
| Especies | Explorador paginado de especies con grilla de fotos, vista de lista con thumbnails, y panel de detalle con taxonomía, estadísticas de observación, atribución fotográfica y enlaces a iNaturalist. |

## Filtros

Todas las vistas responden a un estado de filtro global compartido:

- **Taxonomía**: multiselección jerárquica a través de reino, filo, clase y orden.
- **Geografía**: selección en cascada bioma → ecorregión basada en Dinerstein 2017. El filtrado se implementa mediante conjuntos pre-computados de celdas H3 por ecorregión.
- **Tiempo**: rango de años.
- **Grado de calidad**: solo research grade, o todos los grados.
- **Modo investigación**: preset de un click que restringe el dashboard a Animalia > Arthropoda dentro de 32 ecorregiones amazónicas, correspondientes al alcance del estudio de la tesis.

## Stack técnico

- **Frontend**: React 18, Vite, deck.gl (H3HexagonLayer, GeoJsonLayer), Observable Plot, maplibre-gl
- **Backend**: FastAPI, DuckDB (in-process, consultas read-only para detalle de especies), pandas para filtrado en memoria
- **Formatos de datos**: Apache Parquet (almacenamiento columnar, compresión zstd), GeoJSON (límites simplificados de ecorregiones)
- **Hardware**: Orange Pi 5 Max (ARM64, 16GB RAM, almacenamiento NVMe)

## Obtención de datos

Los scripts de descarga están en `fetch/`:

```bash
# Descarga del dump de iNaturalist Open Data desde AWS S3
bash fetch/inaturalist.sh data/raw/inaturalist

# Descarga del GBIF Backbone Taxonomy
bash fetch/gbif.sh data/raw/gbif
```

Los datos de ecorregiones (Ecoregions2017.shp) deben obtenerse manualmente desde la publicación de Dinerstein et al. (2017) y colocarse en `data/ecobiomes/dinerstein2017/`.

## Pipeline de datos

Datos crudos esperados en `data/raw/`:

| Fuente | Archivos | Origen |
|---|---|---|
| iNaturalist | observations.csv, taxa.csv, photos.csv, observers.csv (TSV) | `s3://inaturalist-open-data` |
| GBIF Backbone | Taxon.tsv, Description.tsv, VernacularName.tsv, Distribution.tsv, Multimedia.tsv | GBIF.org |
| Ecorregiones | Ecoregions2017.shp | Dinerstein et al. 2017 |

El pipeline ETL es orquestado por `run_all.py`:

```bash
cd etl/

# Pipeline completo
python run_all.py

# Pasos individuales
python run_all.py --step obs      # Observaciones → Parquet + indexado H3
python run_all.py --step taxa     # Enriquecimiento taxonómico (expansión de ancestry)
python run_all.py --step photos   # URLs de fotos del CDN de iNaturalist
python run_all.py --step gbif     # Procesamiento del backbone GBIF + taxon join
python run_all.py --step agg      # Pre-agregación (5 tablas)

# Regeneración selectiva de tablas
python preaggregate.py --tables hex_density temporal
```

Tablas pre-agregadas:

| Tabla | Contenido | Tamaño aprox. en RAM |
|---|---|---|
| hex_density | Conteos por celda H3, reino, filo, grado de calidad, año | ~900 MB |
| country_stats | Similar a hex_density con desglose por filo | ~145 MB |
| temporal | Agregados mensuales por reino, filo, grado de calidad | ~24 MB |
| taxon_tree | Jerarquía taxonómica completa con conteos de especies/observaciones | ~24 MB |
| species_list | Resumen por especie con URL de foto, atribución, nombre vernáculo | ~250 MB |

## Desarrollo

### Requisitos

- Python 3.12+
- Node.js 18+
- Docker y Docker Compose (para despliegue)

### Desarrollo local

```bash
# Backend
cd backend/
pip install fastapi uvicorn[standard] duckdb pandas pyarrow cachetools
uvicorn main:app --host 0.0.0.0 --port 8001

# Frontend (servidor de desarrollo con proxy al API)
cd frontend/
npm install
npm run dev -- --host 0.0.0.0
```

El servidor de desarrollo de Vite en el puerto 5173 redirige las peticiones `/api/` al backend en el puerto 8001.

### Despliegue

```bash
cd frontend && npm run build && cd ..
docker compose up -d
```

La aplicación se sirve en el puerto especificado en `docker-compose.yml`. Nginx se encarga del servicio de archivos estáticos, compresión gzip, y proxy reverso al backend.

## Estructura del proyecto

```
taxa-fetch/
├── fetch/
│   ├── inaturalist.sh          # Descarga del dump de iNaturalist desde S3
│   └── gbif.sh                 # Descarga del backbone GBIF
├── etl/
│   ├── config.py               # Rutas, configuración DuckDB, resoluciones H3
│   ├── convert_obs.py          # Observaciones → Parquet con columnas H3 r3/r5
│   ├── enrich_taxa.py          # Expansión de ancestry a columnas taxonómicas planas
│   ├── convert_photos.py       # URLs de fotos del CDN de iNaturalist
│   ├── process_gbif.py         # Backbone GBIF: taxonomía, nombres vernáculos, descripciones
│   ├── preaggregate.py         # Cinco tablas de agregación, soporta flag --tables
│   ├── build_ecoregions.py     # Procesamiento global de ecorregiones: metadatos, mapeo H3, GeoJSON
│   └── run_all.py              # Orquestador del pipeline
├── backend/
│   ├── main.py                 # App FastAPI, lifespan, endpoint GeoJSON
│   ├── dashboard/
│   │   ├── db.py               # Singleton DuckDB con vistas Parquet registradas
│   │   ├── cache.py            # Tablas de agregación en memoria + conjuntos H3 de ecorregiones
│   │   └── filters.py          # Filtrado compartido: apply_taxa(), apply_ecoregions()
│   └── routers/
│       ├── map.py              # Densidad hexagonal H3
│       ├── species.py          # Lista paginada de especies + detalle individual
│       ├── temporal.py         # Agregación de series temporales
│       ├── taxon.py            # Árbol taxonómico, opciones de filtro, metadatos de ecorregiones
│       ├── stats.py            # Estadísticas resumen para el footer del sidebar
│       └── bias.py             # Métricas de sesgo taxonómico Troudet 2017
├── frontend/src/
│   ├── App.jsx                 # Enrutamiento de vistas
│   ├── lib/api.js              # Cliente API
│   ├── hooks/
│   │   ├── useFilters.jsx      # Estado global de filtros, taxaParams(), preset de investigación
│   │   └── useApi.js           # Obtención de datos con cancelación
│   └── components/
│       ├── Shell.jsx           # Layout: sidebar, topbar, globo animado
│       ├── MapView.jsx         # Mapa de avistamientos H3 (deck.gl)
│       ├── EcoregionsView.jsx  # Mapa de ecorregiones seleccionable (deck.gl GeoJsonLayer)
│       ├── SpeciesBrowser.jsx  # Grilla/lista de especies con panel de detalle
│       ├── Charts.jsx          # Temporal, TaxonTree, Cobertura (Troudet)
│       ├── TaxonFilter.jsx     # Selector taxonómico jerárquico
│       └── GeoFilter.jsx       # Selector bioma → ecorregión
├── data/
│   ├── raw/                    # Datos fuente (no versionados)
│   ├── processed/agg/          # Tablas Parquet pre-agregadas
│   └── processed/boundaries/   # Metadatos de ecorregiones, mapeo H3, GeoJSON
├── docker-compose.yml
└── docker/nginx.conf
```

## Limitaciones conocidas

- Las tablas `hex_density` y `temporal` incluyen reino y filo en su GROUP BY, pero no clase ni orden, debido a restricciones de memoria. El filtrado sub-filo está completamente soportado en el explorador de especies, la vista de taxonomía y el análisis de cobertura.
- El GeoJSON de ecorregiones pesa aproximadamente 42 MB. La compresión gzip de nginx reduce la transferencia a ~8 MB, pero la carga inicial puede tardar unos segundos en conexiones lentas.
- DuckDB se utiliza en tiempo de ejecución únicamente para consultas de detalle de especies individuales. La conexión no es thread-safe entre procesos; uvicorn se ejecuta con un solo worker. Un lock de threading serializa las consultas concurrentes de detalle.
- El filtrado geográfico mediante conjuntos H3 de ecorregiones opera a resolución 3 (~1,000 km² por celda). Esto es suficiente para análisis a escala regional, pero puede incluir observaciones ligeramente fuera de los límites de la ecorregión.

## Referencias

- Troudet, Y., Grandcolas, P., Blin, A., Vignes-Lebbe, R., & Legendre, F. (2017). Taxonomic bias in biodiversity data and societal preferences. *Scientific Reports*, 7, 9132. https://doi.org/10.1038/s41598-017-09084-6
- Dinerstein, E., Olson, D., Joshi, A., et al. (2017). An ecoregion-based approach to protecting half the terrestrial realm. *BioScience*, 67(6), 534–545. https://doi.org/10.1093/biosci/bix014
- Eva, H. D., Huber, O., Achard, F., et al. (2005). A proposal for defining the geographical boundaries of Amazonia. Joint Research Centre, European Commission / ACTO.
- Van Proosdij, A. S. J., Sosef, M. S. M., Wieringa, J. J., & Raes, N. (2016). Minimum required number of specimen records to develop accurate species distribution models. *Ecography*, 39(6), 542–552. https://doi.org/10.1111/ecog.01509