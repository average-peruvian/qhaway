# taxa-fetch
Retrieving iNaturalist, GBIF and other evaluation datasets.

# Pipeline

1. Taxa backbone:
   - GBIF Taxonomy Backbone (descarga completa ~2GB): https://hosted-datasets.gbif.org/datasets/backbone/
   - iNat taxa.csv del AWS dump
   - Linkearlos por taxonomicStatus + scientificName

2. Imágenes:
   - iNat AWS dump → photos.csv → URLs originales
   - GBIF download → multimedia.txt → URLs
   - Descargar con aiohttp/asyncio + rate limiting
   - img2dataset → descargas masivas.

3. Deduplicación:
   - Muchos registros de iNat terminan en GBIF (iNat es data provider de GBIF)
   - Filtrar por campo `institutionCode == "iNaturalist"` en GBIF para evitar duplicados