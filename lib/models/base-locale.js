const communes = require('@etalab/decoupage-administratif/data/communes.json')
const Joi = require('joi')
const got = require('got')
const {omit, uniqBy, difference, uniq} = require('lodash')
const {generateBase62String} = require('../util/base62')
const {validPayload} = require('../util/payload')
const mongo = require('../util/mongo')
const {sendMail} = require('../util/sendmail')
const {getContourCommune} = require('../util/contours-communes')
const createTokenRenewalNotificationEmail = require('../emails/token-renewal-notification')
const createBalCreationNotificationEmail = require('../emails/bal-creation-notification')
const createNewAdminNotificationEmail = require('../emails/new-admin-notification')
const createRecoveryNotificationEmail = require('../emails/recovery-notification')
const {extract} = require('../populate/extract-ban')
const {extractFromCsv} = require('../populate/extract-csv')
const adressesToCsv = require('../export/csv-bal').exportAsCsv
const {transformToGeoJSON} = require('../export/geojson')
const {getNomCommune, getCodesCommunes} = require('../util/cog')
const Voie = require('./voie')
const Numero = require('./numero')
const Toponyme = require('./toponyme')

const createSchema = Joi.object().keys({
  nom: Joi.string().min(1).max(200).required(),
  emails: Joi.array().min(1).items(
    Joi.string().email()
  ).required()
})

async function create(payload) {
  const {nom, emails} = validPayload(payload, createSchema)

  const baseLocale = {
    nom,
    emails,
    token: generateBase62String(20),
    status: 'draft'
  }

  mongo.decorateCreation(baseLocale)

  const {insertedId} = await mongo.db.collection('bases_locales').insertOne(baseLocale)
  baseLocale._id = insertedId

  const email = createBalCreationNotificationEmail({baseLocale})
  await sendMail(email, baseLocale.emails)

  return baseLocale
}

const createDemoSchema = Joi.object().keys({
  commune: Joi.string()
    .valid(...getCodesCommunes())
    .required()
    .error(errors => {
      errors.forEach(err => {
        if (err.code) {
          err.message = 'Code commune inconnu'
        }
      })
      return errors
    }),
  populate: Joi.boolean().required()
})

async function createDemo(payload) {
  const {commune, populate} = validPayload(payload, createDemoSchema)

  const baseLocale = {
    token: generateBase62String(20),
    nom: `Adresses de ${getNomCommune(commune)} [démo]`,
    status: 'demo'
  }

  mongo.decorateCreation(baseLocale)

  const {insertedId} = await mongo.db.collection('bases_locales').insertOne(baseLocale)
  baseLocale._id = insertedId

  await mongo.db.collection('communes').insertOne({_bal: baseLocale._id, code: commune})

  if (populate) {
    await populateCommune(baseLocale._id, commune)
  }

  return baseLocale
}

const updateSchema = Joi.object().keys({
  nom: Joi.string().min(1).max(200),
  status: Joi.string().valid('draft', 'ready-to-publish'),
  emails: Joi.array().min(1).items(
    Joi.string().email()
  )
})

async function update(id, payload) {
  // Validate and decorate changes
  const baseLocaleChanges = validPayload(payload, updateSchema)
  mongo.decorateModification(baseLocaleChanges)

  // Fetch current BaseLocale
  const currentBaseLocale = await mongo.db.collection('bases_locales').findOne({_id: mongo.parseObjectID(id)})

  if (!currentBaseLocale) {
    throw new Error('BaseLocale not found')
  }

  // Apply changes to current BaseLocale and return modified one
  const {value} = await mongo.db.collection('bases_locales').findOneAndUpdate(
    {_id: mongo.parseObjectID(id)},
    {$set: baseLocaleChanges},
    {returnOriginal: false}
  )

  // If emails fields is overrided, we compare with current array to send a notification to new email addresses
  if (baseLocaleChanges.emails) {
    const newCollaborators = difference(baseLocaleChanges.emails, currentBaseLocale.emails)
    const notification = createNewAdminNotificationEmail({baseLocale: value})
    await Promise.all(newCollaborators.map(collaborator => sendMail(notification, [collaborator])))
  }

  return value
}

const transformToDraftSchema = Joi.object().keys({
  nom: Joi.string().max(200).allow(null),
  email: Joi.string().email().required()
})

async function transformToDraft(currentBaseLocale, payload) {
  if (!currentBaseLocale) {
    throw new Error('A BaseLocale must be provided as first param')
  }

  if (currentBaseLocale.status !== 'demo') {
    throw new Error(`Cannot transform BaseLocale into draft. Expected status demo. Found: ${currentBaseLocale.status}`)
  }

  const {nom, email} = validPayload(payload, transformToDraftSchema)

  const commune = await mongo.db.collection('communes').findOne({_bal: currentBaseLocale._id})
  if (!commune) {
    throw new Error('Cette Base Adresse Locale ne contient pas de commune. Il n’est pas possible de la convertir.')
  }

  const changes = {
    nom: nom ? nom : `Adresses de ${getNomCommune(commune.code)}`,
    status: 'draft',
    emails: [email]
  }

  mongo.decorateModification(changes)

  const {value: baseLocale} = await mongo.db.collection('bases_locales').findOneAndUpdate(
    {_id: mongo.parseObjectID(currentBaseLocale._id)},
    {$set: changes},
    {returnOriginal: false}
  )

  const emailContent = createBalCreationNotificationEmail({baseLocale})
  await sendMail(emailContent, baseLocale.emails)

  return baseLocale
}

async function fetchOne(id) {
  return mongo.db.collection('bases_locales').findOne({_id: mongo.parseObjectID(id)})
}

async function fetchAll() {
  return mongo.db.collection('bases_locales').find({}).toArray()
}

async function fetchByCommunes(codesCommunes) {
  const basesLocalesIds = await mongo.db.collection('communes').distinct('_bal', {code: {$in: codesCommunes}})
  const basesLocales = await mongo.db.collection('bases_locales').find({_id: {$in: basesLocalesIds}}).toArray()
  const basesLocalesExpanded = await Promise.all(basesLocales.map(bal => expandModel(bal)))

  return basesLocalesExpanded
}

async function remove(id) {
  await mongo.db.collection('bases_locales').deleteOne({_id: mongo.parseObjectID(id)})
  await cleanContent(id)
}

async function renewToken(id) {
  const {value} = await mongo.db.collection('bases_locales').findOneAndUpdate(
    {_id: mongo.parseObjectID(id)},
    {$set: {token: generateBase62String(20)}},
    {returnOriginal: false}
  )

  if (!value) {
    throw new Error('BaseLocale not found')
  }

  const email = createTokenRenewalNotificationEmail({baseLocale: value})
  await sendMail(email, value.emails)

  return value
}

async function addCommune(id, codeCommune) {
  const baseLocale = await mongo.db.collection('bases_locales').findOne({_id: id})

  if (!communes.some(c => c.code === codeCommune && ['commune-actuelle', 'arrondissement-municipal'].includes(c.type))) {
    throw new Error('Code commune inconnu')
  }

  const commune = {
    _bal: id,
    code: codeCommune
  }

  await mongo.db.collection('communes').insertOne(commune)

  return baseLocale
}

async function cleanCommune(id, codeCommune) {
  const baseLocale = await mongo.db.collection('bases_locales').findOne({_id: id})

  if (!baseLocale) {
    throw new Error('Base locale non trouvée')
  }

  const commune = await mongo.db.collection('communes').findOne({_bal: id, code: codeCommune})

  if (!commune) {
    throw new Error('Commune non associée à la base locale')
  }

  await cleanContent(id, {commune: codeCommune})

  return baseLocale
}

async function removeCommune(id, codeCommune) {
  const baseLocale = await mongo.db.collection('bases_locales').findOne({_id: id})

  if (!communes.some(c => c.code === codeCommune)) {
    throw new Error('Code commune inconnu')
  }

  await mongo.db.collection('communes').deleteOne({
    _bal: mongo.parseObjectID(id),
    code: codeCommune
  })

  // Update base locales
  await mongo.touchDocument('bases_locales', id)

  await cleanContent(id, {commune: codeCommune})

  return baseLocale
}

async function populateCommune(id, codeCommune) {
  const baseLocale = await mongo.db.collection('bases_locales').findOne({_id: mongo.parseObjectID(id)})

  if (!baseLocale) {
    throw new Error('Base locale non trouvée')
  }

  const commune = await mongo.db.collection('communes').findOne({_bal: mongo.parseObjectID(id), code: codeCommune})
  if (!commune) {
    throw new Error('Commune non associée à la base locale')
  }

  await cleanCommune(id, codeCommune)
  const {numeros, voies} = await extract(codeCommune)
  await Promise.all([
    Voie.importMany(mongo.parseObjectID(id), voies, {validate: false, keepIds: true}),
    Numero.importMany(mongo.parseObjectID(id), numeros, {validate: false})
  ])

  return baseLocale
}

async function cleanContent(id, query = {}) {
  if (!query.commune) {
    mongo.db.collection('communes').deleteMany({_bal: mongo.parseObjectID(id)})
  }

  await Promise.all([
    mongo.db.collection('voies').deleteMany({...query, _bal: mongo.parseObjectID(id)}),
    mongo.db.collection('numeros').deleteMany({...query, _bal: mongo.parseObjectID(id)})
  ])
}

async function exportAsCsv(id) {
  const voies = await mongo.db.collection('voies').find({_bal: mongo.parseObjectID(id)}).toArray()
  const toponymes = await mongo.db.collection('toponymes').find({_bal: mongo.parseObjectID(id)}).toArray()
  const numeros = await mongo.db.collection('numeros').find({_bal: mongo.parseObjectID(id)}).toArray()
  return adressesToCsv({voies, toponymes, numeros})
}

async function streamToGeoJSON(id, codeCommune) {
  const voiesCursor = mongo.db.collection('voies').find({_bal: id, commune: codeCommune})
  const numerosCursor = mongo.db.collection('numeros').find({_bal: id, commune: codeCommune, 'positions.point': {$exists: true}})
  const toponymesCursor = mongo.db.collection('toponymes').find({_bal: id, commune: codeCommune})
  return transformToGeoJSON({voiesCursor, numerosCursor, toponymesCursor})
}

async function importFile(id, file) {
  const {voies, numeros, toponymes, isValid, accepted, rejected} = await extractFromCsv(file)

  if (!isValid) {
    return {isValid: false}
  }

  // Clean all actual voies and numeros
  await cleanContent(id)

  // Set communes
  const communes = uniqBy(voies, v => v.commune).map(v => v.commune)
  await Promise.all(communes.map(commune => addCommune(id, commune)))

  // Import new voies and numeros
  await Promise.all([
    Voie.importMany(mongo.parseObjectID(id), voies, {validate: false, keepIds: true}),
    Numero.importMany(mongo.parseObjectID(id), numeros, {validate: false}),
    Toponyme.importMany(mongo.parseObjectID(id), toponymes, {validate: false, keepIds: true})
  ])

  await mongo.touchDocument('bases_locales', id)

  return {
    isValid: true,
    accepted,
    rejected,
    communes,
    voies: voies.length,
    numeros: numeros.length
  }
}

function filterSensitiveFields(baseLocale) {
  return omit(baseLocale, 'token', 'emails')
}

async function computeStats() {
  const response = await got('https://backend.adresse.data.gouv.fr/publication/submissions/published', {responseType: 'json'})
  const publishedBasesLocalesIds = new Set(
    response.body
      .filter(b => b.url && b.url.startsWith('https://api-bal.adresse.data.gouv.fr/v1/bases-locales'))
      .map(b => b.url.slice(54, 78))
  )

  function getStatus(communeBasesLocales) {
    if (communeBasesLocales.some(({_id}) => publishedBasesLocalesIds.has(_id.toString()))) {
      return 'published'
    }

    if (communeBasesLocales.map(({status}) => status).includes('ready-to-publish')) {
      return 'ready-to-publish'
    }

    return 'draft'
  }

  const basesLocales = await mongo.db.collection('bases_locales').aggregate([
    {$match: {status: {$ne: 'demo'}}}
  ]).toArray()

  const groupedCommunes = await mongo.db.collection('communes').aggregate([{
    $group: {
      _id: '$code',
      basesLocalesIds: {$addToSet: '$_bal'}
    }
  }]).toArray()

  const features = groupedCommunes.map(({_id, basesLocalesIds}) => {
    const test = basesLocales.filter(({_id}) => basesLocalesIds.map(id => id.toString()).includes(_id.toString()))
    return {
      code: _id,
      status: getStatus(test)
    }
  })

  return {
    type: 'FeatureCollection',
    features: features
      .filter(r => getContourCommune(r.code))
      .map(r => {
        const contourCommune = getContourCommune(r.code)
        const {nom, code} = contourCommune.properties
        const properties = {
          code,
          nom,
          maxStatus: r.status
        }
        return {
          type: 'Feature',
          properties,
          geometry: contourCommune.geometry
        }
      })
  }
}

async function basesLocalesRecovery(userEmail) {
  const basesLocales = await mongo.db.collection('bases_locales').find({emails: userEmail}).toArray()

  if (basesLocales.length > 0) {
    const email = createRecoveryNotificationEmail({basesLocales})
    await sendMail(email, [userEmail])
  }
}

async function expandModel(baseLocale) {
  const communes = await mongo.db.collection('communes').find().toArray()
  const codes = communes
    .filter(({_bal}) => _bal.toHexString() === baseLocale._id.toHexString())
    .map(c => c.code)

  return {
    ...baseLocale,
    communes: codes
  }
}

async function getAssignedParcelles(balId, codeCommune) {
  const numeroWithParcelles = await mongo.db.collection('numeros').distinct('parcelles', {_bal: mongo.parseObjectID(balId), commune: codeCommune})
  const toponymesWithParcelles = await mongo.db.collection('toponymes').distinct('parcelles', {_bal: mongo.parseObjectID(balId), commune: codeCommune})

  const parcelles = [
    ...numeroWithParcelles,
    ...toponymesWithParcelles
  ]

  return uniq(parcelles)
}

module.exports = {
  create,
  createSchema,
  createDemo,
  createDemoSchema,
  update,
  updateSchema,
  transformToDraft,
  transformToDraftSchema,
  fetchOne,
  fetchAll,
  fetchByCommunes,
  remove,
  renewToken,
  addCommune,
  cleanCommune,
  removeCommune,
  populateCommune,
  exportAsCsv,
  streamToGeoJSON,
  cleanContent,
  importFile,
  filterSensitiveFields,
  computeStats,
  basesLocalesRecovery,
  expandModel,
  getAssignedParcelles
}
