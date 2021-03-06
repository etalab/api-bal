const {createGunzip} = require('zlib')
const {groupBy, deburr, uniqBy} = require('lodash')
const csvParse = require('csv-parser')
const got = require('got')
const getStream = require('get-stream').array
const pumpify = require('pumpify')
const {ObjectID} = require('../util/mongo')
const {extractFromCsv} = require('./extract-csv')

const sourceUrlPattern = process.env.BAN_SOURCE_URL_PATTERN || 'https://adresse.data.gouv.fr/data/ban/adresses/latest/csv/adresses-<codeDepartement>.csv.gz'

function getCodeDepartement(codeCommune) {
  return codeCommune.startsWith('97') ? codeCommune.slice(0, 3) : codeCommune.slice(0, 2)
}

async function extractFromBAN(codeCommune) {
  const codeDepartement = getCodeDepartement(codeCommune)

  const adresses = await getStream(pumpify.obj(
    got.stream(sourceUrlPattern.replace('<codeDepartement>', codeDepartement), {responseType: 'buffer'}),
    createGunzip(),
    csvParse({separator: ';'})
  ))

  const adressesCommune = adresses
    .map(a => {
      if (a.code_insee !== codeCommune) {
        return null
      }

      const numero = Number.parseInt(a.numero, 10)
      const suffixe = a.rep.toLowerCase() || null
      const nomVoie = a.nom_voie

      if (!nomVoie || !Number.isInteger(numero) || numero === 0 || numero > 5000) {
        return null
      }

      const adresse = {
        codeCommune,
        nomVoie,
        numero,
        suffixe,
        positions: []
      }

      if (a.lat && a.lon) {
        adresse.positions.push({
          type: 'inconnue',
          source: 'BAN',
          point: {
            type: 'Point',
            coordinates: [Number.parseFloat(a.lon), Number.parseFloat(a.lat)]
          }
        })
      }

      return adresse
    })
    .filter(Boolean)

  const voies = []
  const numeros = []
  const groups = groupBy(adressesCommune, a => deburr(a.nomVoie.toLowerCase()))

  Object.keys(groups).forEach(k => {
    const adressesVoie = groups[k]
    const {nomVoie, codeCommune} = adressesVoie[0]

    const voie = {_id: new ObjectID(), commune: codeCommune, nom: nomVoie}
    voies.push(voie)

    uniqBy(adressesVoie, a => `${a.numero}${a.suffixe}`)
      .map(a => ({
        voie: voie._id,
        commune: codeCommune,
        numero: a.numero,
        suffixe: a.suffixe,
        positions: a.positions
      }))
      .forEach(n => numeros.push(n))
  })

  return {voies, numeros}
}

async function extractFromRecovery(codeCommune) {
  try {
    const response = await got(`https://adresse.data.gouv.fr/data/sbg-recovery/${codeCommune}.csv`, {responseType: 'buffer'})
    return extractFromCsv(response.body)
  } catch {
  }
}

async function extract(codeCommune) {
  const data = await extractFromRecovery(codeCommune)

  if (data) {
    return data
  }

  return extractFromBAN(codeCommune)
}

module.exports = {extract, extractFromBAN}
