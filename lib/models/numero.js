const Joi = require('joi')
const {getFilteredPayload} = require('../util/payload')
const mongo = require('../util/mongo')
const {validPayload} = require('../util/payload')
const position = require('./position')

const createSchema = Joi.object().keys({
  numero: Joi.number().min(0).max(9999).integer().required(),
  suffixe: Joi.string().regex(/^[a-z][a-z0-9]*$/).max(10).allow(null),
  comment: Joi.string().max(5000).allow(null),
  positions: Joi.array().items(
    Joi.lazy(() => position.createSchema).description('position schema')
  )
})

async function create(idVoie, payload) {
  const numero = validPayload(payload, createSchema)

  const voie = await mongo.db.collection('voies').findOne({_id: mongo.parseObjectID(idVoie)})

  if (!voie) {
    throw new Error('Voie not found')
  }

  numero._bal = voie._bal
  numero.commune = voie.commune
  numero.voie = idVoie

  numero.suffixe = numero.suffixe || null
  numero.comment = numero.comment || null
  numero.positions = numero.positions || []

  mongo.decorateCreation(numero)

  const {insertedId} = await mongo.db.collection('numeros').insertOne(numero)
  numero._id = insertedId

  await Promise.all([
    mongo.touchDocument('bases_locales', numero._bal, numero._created),
    mongo.touchDocument('voies', numero.voie, numero._created)
  ])

  return numero
}

async function importMany(idBal, rawNumeros, options = {}) {
  if (!idBal) {
    throw new Error('idBal is required')
  }

  if (options.validate !== false) {
    throw new Error('Validation is not currently available in importMany')
  }

  const numeros = rawNumeros
    .map(n => {
      const numero = getFilteredPayload(n, createSchema)

      if (!n.commune || !n.voie || !n.numero) {
        return null
      }

      numero._bal = idBal
      numero.commune = n.commune
      numero.voie = n.voie

      numero.suffixe = n.suffixe || null
      numero.positions = n.positions || []

      if (n._updated && n._created) {
        numero._created = n._created
        numero._updated = n._updated
      } else {
        mongo.decorateCreation(numero)
      }

      return numero
    })
    .filter(Boolean)

  if (numeros.length === 0) {
    return
  }

  await mongo.db.collection('numeros').insertMany(numeros)
}

const updateSchema = Joi.object().keys({
  numero: Joi.number().min(0).max(9999).integer(),
  suffixe: Joi.string().regex(/^[a-z][a-z0-9]*$/).max(10).allow(null),
  comment: Joi.string().max(5000).allow(null),
  positions: Joi.array().items(
    Joi.lazy(() => position.createSchema).description('position schema')
  )
})

async function update(id, payload) {
  const numeroChanges = validPayload(payload, updateSchema)

  mongo.decorateModification(numeroChanges)

  const {value} = await mongo.db.collection('numeros').findOneAndUpdate(
    {_id: mongo.parseObjectID(id)},
    {$set: numeroChanges},
    {returnOriginal: false}
  )

  if (!value) {
    throw new Error('Numero not found')
  }

  await Promise.all([
    mongo.touchDocument('bases_locales', value._bal, value._updated),
    mongo.touchDocument('voies', value.voie, value._updated)
  ])

  return value
}

async function fetchOne(id) {
  return mongo.db.collection('numeros').findOne({_id: mongo.parseObjectID(id)})
}

async function fetchAll(idVoie) {
  return mongo.db.collection('numeros').find({voie: idVoie}).sort({numero: 1}).toArray()
}

async function remove(id) {
  const {value} = await mongo.db.collection('numeros').findOneAndDelete({
    _id: mongo.parseObjectID(id)
  })

  if (value) {
    const now = new Date()
    await Promise.all([
      mongo.touchDocument('bases_locales', value._bal, now),
      mongo.touchDocument('voies', value.voie, now)
    ])
  }
}

function expandModel(numero) {
  return {
    ...numero,
    numeroComplet: `${numero.numero}${numero.suffixe ? numero.suffixe.toLowerCase().trim() : ''}`
  }
}

module.exports = {
  create,
  createSchema,
  importMany,
  update,
  updateSchema,
  fetchOne,
  fetchAll,
  remove,
  expandModel
}
