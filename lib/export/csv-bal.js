const csvWriter = require('csv-write-stream')
const getStream = require('get-stream')
const intoStream = require('into-stream')
const {keyBy} = require('lodash')
const pumpify = require('pumpify')
const proj = require('@etalab/project-legal')
const communes = require('@etalab/decoupage-administratif/data/communes.json')
  .filter(c => ['commune-actuelle', 'arrondissement-municipal'].includes(c.type))

const communesIndex = keyBy(communes, 'code')

function roundCoordinate(coordinate, precision) {
  return Number.parseFloat(coordinate.toFixed(precision))
}

function formatCleInterop(codeCommune, codeVoie, numero, suffixe) {
  const str = `${codeCommune}_${codeVoie}_${numero.toString().padStart(5, '0')}`
  if (!suffixe) {
    return str.toLowerCase()
  }

  return (str + '_' + suffixe).toLowerCase()
}

/* eslint camelcase: off */
function createRow(obj) {
  const nomCommune = obj.codeCommune && obj.codeCommune in communesIndex ?
    communesIndex[obj.codeCommune].nom :
    ''

  const row = {
    cle_interop: formatCleInterop(obj.codeCommune, obj.codeVoie, obj.numero, obj.suffixe),
    uid_adresse: '',
    voie_nom: obj.nomVoie,
    lieudit_complement_nom: obj.complementNomVoie || '',
    numero: Number.isInteger(obj.numero) ? obj.numero.toString() : '',
    suffixe: obj.suffixe || '',
    commune_insee: obj.codeCommune,
    commune_nom: nomCommune,
    commune_deleguee_insee: '',
    commune_deleguee_nom: '',
    position: '',
    long: '',
    lat: '',
    x: '',
    y: '',
    source: obj.source || '',
    date_der_maj: obj._updated ? obj._updated.toISOString().slice(0, 10) : ''
  }
  if (obj.position) {
    const coordsPosition = obj.position.point.coordinates
    const projectedCoords = proj(coordsPosition)
    row.position = obj.position.type
    row.source = obj.position.source
    row.long = roundCoordinate(coordsPosition[0], 6).toString()
    row.lat = roundCoordinate(coordsPosition[1], 6).toString()
    if (projectedCoords) {
      row.x = projectedCoords[0].toString()
      row.y = projectedCoords[1].toString()
    }
  }

  return row
}

async function exportAsCsv({voies, numeros}) {
  const voiesIndex = keyBy(voies, v => v._id.toHexString())
  const voiesWithNumeros = {}
  const rows = []

  numeros.forEach(n => {
    const voieId = n.voie.toHexString()
    const v = voiesIndex[voieId]
    voiesWithNumeros[voieId] = true

    if (n.positions && n.positions.length > 0) {
      n.positions.forEach(p => {
        rows.push({
          codeCommune: n.commune,
          codeVoie: v.code || 'xxxx',
          numero: n.numero,
          suffixe: n.suffixe,
          _updated: n._updated,
          nomVoie: v.nom,
          complementNomVoie: v.complement,
          position: p
        })
      })
    } else {
      rows.push({
        codeCommune: n.commune,
        codeVoie: v.code || 'xxxx',
        numero: n.numero,
        suffixe: n.suffixe,
        _updated: n._updated,
        nomVoie: v.nom,
        complementNomVoie: v.complement
      })
    }
  })

  voies.forEach(v => {
    if (v.positions && v.positions.length > 0) {
      v.positions.forEach(p => {
        rows.push({
          codeCommune: v.commune,
          codeVoie: v.code || 'xxxx',
          numero: 99999,
          _updated: v._updated,
          nomVoie: v.nom,
          complementNomVoie: v.complement,
          position: p
        })
      })
    } else if (!(v._id.toHexString() in voiesWithNumeros)) {
      rows.push({
        codeCommune: v.commune,
        codeVoie: v.code || 'xxxx',
        numero: 99999,
        _updated: v._updated,
        nomVoie: v.nom,
        complementNomVoie: v.complement
      })
    }
  })

  return getStream(pumpify.obj(
    intoStream.object(rows.map(row => createRow(row))),
    csvWriter({separator: ';', newline: '\r\n'})
  ))
}

module.exports = {roundCoordinate, formatCleInterop, createRow, exportAsCsv}
