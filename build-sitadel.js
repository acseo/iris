#!/usr/bin/env node --max-old-space-size=4096
const {promisify} = require('util')
const {join, basename} = require('path')
const {createWriteStream} = require('fs')
const {readdir, remove} = require('fs-extra')
const execa = require('execa')
const gdal = require('gdal-next')
const {stringify} = require('geojson-stream')
const {mapValues, isPlainObject} = require('lodash')
const pumpify = require('pumpify')
const bluebird = require('bluebird')
const {truncate} = require('@turf/turf')
const glob = promisify(require('glob'))
const finished = promisify(require('stream').finished)
const fs = require('fs');
var csv = require('csv-parser');
const jsonexport = require('jsonexport');

const wgs84 = gdal.SpatialReference.fromProj4('+init=epsg:4326')

const dataDir = join(__dirname, 'data-sitadel')
const distDir = join(__dirname, 'dist')
const tmpDir = join(__dirname, 'tmp')

async function extractToTempDirectory(archivePath) {
  const temporaryName = join(tmpDir, basename(archivePath))
  fs.copyFile( archivePath, temporaryName, (err) => {
    if (err) {
      console.log("Error Found:", err);
    }
    
  });

  return temporaryName
}

function grepWithShell (file, search) {
  const { spawnSync} = require('child_process');
  const command = 'ack -1"' + search + '" ' + file
  //console.log(command)
  const child = spawnSync('ack', ['-1', search, file])

  if(child.stdout && child.stdout.toString().length > 0) {
    let result = JSON.parse(child.stdout.toString())
    //console.log(result)
    return result
  }

  return null
};

function enrichCSV(inputFile)
{
  const fileName = join(distDir, 'iris-' + basename(inputFile))

  var dataArray = [];

  console.log(inputFile)
  fs.createReadStream(inputFile)
  .pipe(csv({ separator: ',' }))
  .on('data', function (data) {

    console.log(dataArray.length)

    data.CODE_IRIS = false
    data.LAT = false
    data.LON = false

    let dep = data.DEP.replace('A', 0).replace('B', 0)
    let codeCommune = data.COMM
    let cadastre1 = data.CADASTRE1
    let section = cadastre1.slice(-2);
    let numero = cadastre1.slice(0,-2)
    section = ('00000'+section).slice(-5)
    numero = ('00000'+numero).slice(-4)
    let idParcelle = codeCommune + section + numero  
    let feature = grepWithShell(`./dist/cadastre-${dep}.json`, idParcelle)

    if(feature) {
      data.CODE_IRIS = feature.properties.codeIris
      data.LAT = feature.properties.lat
      data.LON = feature.properties.lon
    } else {
      console.log('IRIS non trouvé pour la parcelle : ' + idParcelle)
    }
    
    dataArray.push(data);
  })
  .on('end', function(){
    console.log("end")

    jsonexport(dataArray, {rowDelimiter: ','}, function(err, csv){
      if (err) return console.error(err);
      fs.writeFileSync(fileName, csv);
    });
  });
}

async function main() {
  await remove(tmpDir)
  fs.mkdirSync(tmpDir)
  // const irisFile = createWriteStream(join(distDir, 'iris.json'))
  // const irisOutput = pumpify.obj(
  //   stringify(),
  //   irisFile
  // )

  const archiveFiles = await readdir(dataDir)

  await bluebird.each(archiveFiles, async archiveFile => {
    if (!archiveFile.includes(".csv")) {
      return
    }
    
    const temporaryName = await extractToTempDirectory(join(dataDir, archiveFile))
    enrichCSV(join(temporaryName))
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
