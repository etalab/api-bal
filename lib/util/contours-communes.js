const got = require('got')
const {keyBy} = require('lodash')

let communesIndex

async function getRemoteFeatures(url) {
  const response = await got(url, {responseType: 'json'})
  return response.body.features
}

async function prepareContoursCommunes() {
  const communesFeatures = await getRemoteFeatures('http://etalab-datasets.geo.data.gouv.fr/contours-administratifs/latest/geojson/communes-100m.geojson')
  const arrFeatures = await getRemoteFeatures('http://etalab-datasets.geo.data.gouv.fr/contours-administratifs/latest/geojson/arrondissements-municipaux-100m.geojson')

  communesIndex = keyBy([...communesFeatures, ...arrFeatures], f => f.properties.code)
}

function getContourCommune(codeCommune) {
  return communesIndex[codeCommune]
}

module.exports = {
  prepareContoursCommunes,
  getContourCommune
}
