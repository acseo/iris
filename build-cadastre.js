#!/usr/bin/env node --max-old-space-size=4096
const {promisify, getSystemErrorMap} = require('util')
const {join, basename} = require('path')
const {createWriteStream} = require('fs')
const {readdir, remove} = require('fs-extra')
const execa = require('execa')
const gdal = require('gdal-next')
const {stringify} = require('geojson-stream')
const {mapValues, isPlainObject} = require('lodash')
const pumpify = require('pumpify')
const bluebird = require('bluebird')
const {truncate, centroid} = require('@turf/turf')
const glob = promisify(require('glob'))
const finished = promisify(require('stream').finished)

const cliProgress = require('cli-progress');

// IRIS
console.log("IRIS Data loading...")
const {features} = require('./dist/iris.json')
const {chain, min} = require('lodash')
const Flatbush = require('flatbush')
const {bbox: getBbox, booleanPointInPolygon, point, lineString, pointToLineDistance} = require('@turf/turf')
const morgan = require('morgan')

const geoIndex = new Flatbush(features.length)
features.forEach(f => geoIndex.add(...getBbox(f)))
geoIndex.finish()
console.log("IRIS Data is loaded !")
//


const wgs84 = gdal.SpatialReference.fromProj4('+init=epsg:4326')

const dataDir = join(__dirname, 'data-cadastre')
const distDir = join(__dirname, 'dist')
const tmpDir = join(__dirname, 'tmp')

let loader = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

function gdalLayerToGeoJSONFeatures(gdalLayer, transform, mapProperties) {

  return gdalLayer.features.map(feature => {

    loader.increment();

    const properties = mapProperties(feature.fields.toObject())
    const geometry = feature.getGeometry()

    if (geometry && transform) {
      geometry.transform(transform)

      const centroid = geometry.centroid().toObject()
      properties.lon = false
      properties.lat = false
      properties.codeIris = false 

      if(centroid !== undefined && centroid) {
        properties.lon = centroid.coordinates[0]
        properties.lat = centroid.coordinates[1]
        // DEBUT IRIS
        const candidates = geoIndex.neighbors(properties.lon, properties.lat, 10, 10, undefined)
          .filter(i => features[i].properties.codeCommune === properties.codeCommune)
          .map(i => features[i])

        if (candidates.length > 0) {
          const exactResult = candidates.find(c => {
            return booleanPointInPolygon(
              point([properties.lon, properties.lat]),
              c
            )
          })
    

          if (exactResult) {
            properties.codeIris = exactResult.properties.codeIris
          } 
          else {
            const fuzzyResult = chain(candidates)
              .minBy(c => {
                const rings = []
    
                if (c.geometry.type === 'Polygon') {
                  rings.push(...c.geometry.coordinates)
                }
    
                if (c.geometry.type === 'MultiPolygon') {
                  c.geometry.coordinates.forEach(polygonRings => rings.push(...polygonRings))
                }
    
                return min(rings.map(ring => {
                  return pointToLineDistance(point([properties.lon, properties.lat]), lineString(ring), {units: 'kilometers'})
                }))
              })
            .value()
    
            if (fuzzyResult) {
              //console.log(fuzzyResult)
              //process.exit()
              properties.codeIris = fuzzyResult.properties.codeIris
            }
          }
        }
        // FIN IRIS
      }
    } 
    
    return {
      type: 'Feature',
      properties: mapValues(properties, v => {
        if (isPlainObject(v) && v.year && v.month && v.day) {
          return `${v.year.toString()}-${v.month.toString().padStart(2, '0')}-${v.day.toString().padStart(2, '0')}`
        }

        return v
      }),
      //geometry: geometry && geometry.toObject(),
      geometry : null
    }
  })
}

async function extractToTempDirectory(archivePath) {
  const temporaryDir = join(tmpDir, basename(archivePath) + '-extraction')

  await execa('unar', [archivePath, '-o', temporaryDir])
  return temporaryDir
}

function extractFeatures(inputFile) {
  const dataset = gdal.open(inputFile)
  const layer = dataset.layers.get(0)
  const transform = layer.srs.isSame(wgs84) ?
    null :
    new gdal.CoordinateTransformation(
      layer.srs,
      wgs84
    )
  return gdalLayerToGeoJSONFeatures(layer, transform, properties => {
    const {id, commune, prefixe, section} = properties
    
    return {
      id: id,
      codeCommune: commune,
      prefixe: prefixe,
      section: section,
    }
  })
}

async function main() {
  await remove(tmpDir)
  const archiveFiles = await readdir(dataDir)

  await bluebird.each(archiveFiles, async archiveFile => {
    if (!archiveFile.includes('cadastre')) {
      return
    }

    const words = archiveFile.split('-');
    const dep = words[1]

    loader.start(dep, 0)

    let cadastreFile = createWriteStream(join(distDir, `cadastre-${dep}.json`))
    let cadastreOutput = pumpify.obj(
      stringify(),
      cadastreFile
    )

    const temporaryDir = await extractToTempDirectory(join(dataDir, archiveFile))
    const shpFiles = await glob('**/*.shp', {cwd: temporaryDir, nocase: true})
    const shpFile = shpFiles[0]
    const features = extractFeatures(join(temporaryDir, shpFile))
    console.log(`traitement du fichier : ${shpFile}`);
    features.forEach(feature => {
     cadastreOutput.write(truncate(feature, {precision: 5, mutate: true}))
    })
    console.log(`Écriture de ${features.length} objets géographiques`)
    await remove(temporaryDir)
    cadastreOutput.end()
    await finished(cadastreFile)
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
