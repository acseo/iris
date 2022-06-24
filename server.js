#!/usr/bin/env node --max-old-space-size=4096
//const {features} = require('./dist/iris.json')


const express = require('express')
const {chain, min} = require('lodash')
const Flatbush = require('flatbush')
const {bbox: getBbox, booleanPointInPolygon, point, lineString, pointToLineDistance} = require('@turf/turf')
const morgan = require('morgan')
const cors = require('cors')
const { getSystemErrorMap } = require('util')
const fs = require('fs');
const path = require('path')

const app = express()

// const geoIndex = new Flatbush(features.length)
// features.forEach(f => geoIndex.add(...getBbox(f)))
// geoIndex.finish()

if (process.env.NODE_ENV === 'production') {
  app.enable('trust proxy')
}

app.use(cors({origin: true}))

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}


app.get('/cadastre', (req, res) => {

  if (!req.query.dep || !req.query.id) {
    return res.sendStatus(400)
  }

  //let {features} = require(`./dist/cadastre-${req.query.dep}.json`)
  let onlyOneResult = true;
  let candidates = grepWithShell(`./dist/cadastre-${req.query.dep}.json`, "\"id\":\"".concat(req.query.id).concat("\""), onlyOneResult)
  // const candidates = features
  //   .filter(el => (el.properties.id === req.query.id) )
    
  if (candidates.length === 0) {
    return res.sendStatus(404)
  }

  features = null

  return res.send(candidates)
  
})

app.get('/cadastre-by-iris', (req, res) => {

  if (!req.query.dep || !req.query.codeIris) {
    return res.sendStatus(400)
  }

  let {features} = require(`./dist/cadastre-${req.query.dep}.json`)

  const candidates = features
    .filter(el => ( el.properties.codeIris === req.query.codeIris) )

  if (candidates.length === 0) {
    return res.sendStatus(404)
  }

  features = null

  return res.send(candidates)
})

app.get('/iris-by-code', (req, res) => {

  if (!req.query.codeIris) {
    return res.sendStatus(400)
  }

  if (req.query.codeCommune == '75056' || req.query.codeCommune == '13055' || req.query.codeCommune == '69123') {
    req.query.codeCommune = false;
  }
  
  if (req.query.codeCommune) {
    let jsonCityFile = path.resolve(`./dist/`, 'iris-'+req.query.codeCommune+'.json');
    if (!fs.existsSync(jsonCityFile)) {    
      let onlyOneResult = false;
      features = grepWithShell(`./dist/iris.json`, "\"codeCommune\":\"".concat(req.query.codeCommune).concat("\""), onlyOneResult)
      fs.writeFileSync(jsonCityFile, JSON.stringify(features));  
      } else {
        features = JSON.parse(fs.readFileSync(jsonCityFile, 'utf8'));
      }
  } else {
    features = grepWithShell(`./dist/iris.json`, "\"codeIris\":\"".concat(req.query.codeIris).concat("\""))
  }

  const candidates = features
    .filter(el => ( el.properties.codeIris === req.query.codeIris) )

  if (candidates.length === 0) {
    return res.sendStatus(404)
  }

  return res.send(candidates)
  
  })

app.get('/iris-by-commune', (req, res) => {

    if (!req.query.codeCommune) {
      return res.sendStatus(400)
    }
  
    let jsonCityFile = path.resolve(`./dist/`, 'iris-'+req.query.codeCommune+'.json');

    if (!fs.existsSync(jsonCityFile)) {
      let onlyOneResult = false;
      candidates = grepWithShell(`./dist/iris.json`, "\"codeCommune\":\"".concat(req.query.codeCommune).concat("\""), onlyOneResult)
      fs.writeFileSync(jsonCityFile, JSON.stringify(features));  
    } else {
      candidates = JSON.parse(fs.readFileSync(jsonCityFile, 'utf8'));
    }
  
    if (candidates.length === 0) {
      return res.sendStatus(404)
    }
  
    return res.send(candidates)
    
    })  

app.get('/iris', (req, res) => {
  if (!req.query.lat || !req.query.lon || !req.query.codeCommune) {
    return res.sendStatus(400)
  }

  const lat = Number.parseFloat(req.query.lat)
  const lon = Number.parseFloat(req.query.lon)

  if (lat > 90 || lat < -90 || lon > 180 || lon < -180) {
    return res.sendStatus(400)
  }

  let jsonCityFile = path.resolve(`./dist/`, 'iris-'+req.query.codeCommune+'.json');

  if (!fs.existsSync(jsonCityFile)) {
    features = grepWithShell(`./dist/iris.json`, "\"codeCommune\":\"".concat(req.query.codeCommune).concat("\""))
    fs.writeFileSync(jsonCityFile, JSON.stringify(features));  
  } else {
    features = JSON.parse(fs.readFileSync(jsonCityFile, 'utf8'));
  }
    
  const geoIndex = new Flatbush(features.length)
  features.forEach(f => geoIndex.add(...getBbox(f)))
  geoIndex.finish()

  const candidates = geoIndex.neighbors(lon, lat, 10, 10, undefined)
    .filter(i => features[i].properties.codeCommune === req.query.codeCommune)
    .map(i => features[i])

  if (candidates.length === 0) {
    return res.sendStatus(404)
  }

  const exactResult = candidates.find(c => {
    return booleanPointInPolygon(
      point([lon, lat]),
      c
    )
  })

  if (exactResult) {
    return res.send(exactResult)
  }

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
        return pointToLineDistance(point([lon, lat]), lineString(ring), {units: 'kilometers'})
      }))
    })
    .value()

  if (fuzzyResult) {
    return res.send(fuzzyResult)
  }

  res.sendStatus(404)
})

app.get('/irises', (req, res) => {
  if (!req.query.coordinates || !req.query.codeCommune) {
    return res.sendStatus(400)
  }

  const coordinates = JSON.parse(req.query.coordinates);

  let jsonCityFile = path.resolve(`./dist/`, 'iris-'+req.query.codeCommune+'.json');

  if (!fs.existsSync(jsonCityFile)) {
    features = grepWithShell(`./dist/iris.json`, "\"codeCommune\":\"".concat(req.query.codeCommune).concat("\""))
    fs.writeFileSync(jsonCityFile, JSON.stringify(features));  
  } else {
    features = JSON.parse(fs.readFileSync(jsonCityFile, 'utf8'));
  }

  const geoIndex = new Flatbush(features.length)
  features.forEach(f => geoIndex.add(...getBbox(f)))
  geoIndex.finish()
   
  let result = new Array();
  for (coordinate of coordinates) {
    let lat = Number.parseFloat(coordinate.lat);
    let lon = Number.parseFloat(coordinate.lon);
    if (lat > 90 || lat < -90 || lon > 180 || lon < -180) {
      continue;
    }

    let candidates = geoIndex.neighbors(lon, lat, 10, 10, undefined)
    .filter(i => features[i].properties.codeCommune === req.query.codeCommune)
    .map(i => features[i])

    if (candidates.length === 0) {
      continue;
    }

    let exactResult = candidates.find(c => {
      return booleanPointInPolygon(
        point([lon, lat]),
        c
      )
    })
  
    if (exactResult) {
      result.push(exactResult);
      continue;
    }

    let fuzzyResult = chain(candidates)
      .minBy(c => {
        const rings = []

        if (c.geometry.type === 'Polygon') {
          rings.push(...c.geometry.coordinates)
        }

        if (c.geometry.type === 'MultiPolygon') {
          c.geometry.coordinates.forEach(polygonRings => rings.push(...polygonRings))
        }

        return min(rings.map(ring => {
          return pointToLineDistance(point([lon, lat]), lineString(ring), {units: 'kilometers'})
        }))
      })
      .value()

    if (fuzzyResult) {
      result.push(fuzzyResult);
    }
  }

  res.send(result);
})

const port = process.env.PORT || 5000

app.listen(port, () => {
  console.log(`Start listening on port ${port}`)
})


function grepWithShell (file, search, onlyOneResult) {
  const { spawnSync} = require('child_process');
  
  if (onlyOneResult == undefined || onlyOneResult == false) {
    //console.log([ 'ack ', "'"+search+"'", file].join(' '))
    child = spawnSync('ack', [search, file])
  } else {
    //console.log([ 'ack ' , '-1' , search, file].join(' '))
    child = spawnSync('ack', [search, file])
  }

  if(child.stdout && child.stdout.toString().length > 0) {
    
    if (onlyOneResult == undefined || onlyOneResult == false) {
      lines = child.stdout.toString().split(/\r\n|\r|\n/)
      result = new Array();
      for(line of lines) {      
        if (line.trim().length > 0 ) {
            result.push(JSON.parse(line));
        }
      }
    } else {
      result = JSON.parse(child.stdout.toString())
    }
    return result;
  }

  return new Array();
};
