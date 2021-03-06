const test = require('ava')
const {MongoMemoryServer} = require('mongodb-memory-server')
const express = require('express')
const request = require('supertest')
const {omit} = require('lodash')
const mongo = require('../../util/mongo')
const routes = require('..')

const GENERATED_VARS = ['_id', '_updated', '_created']
const KEYS = ['_id', '_bal', 'commune', 'voie', 'numero', 'numeroComplet', 'positions', 'suffixe', '_created', '_updated', 'comment', 'toponyme', 'parcelles']

const mongod = new MongoMemoryServer()

test.before('start server', async () => {
  await mongo.connect(await mongod.getUri())
})

test.after.always('cleanup', async () => {
  await mongo.disconnect()
  await mongod.stop()
})

test.beforeEach('clean database', async () => {
  await mongo.db.collection('bases_locales').deleteMany({})
  await mongo.db.collection('voies').deleteMany({})
  await mongo.db.collection('numeros').deleteMany({})
})

function getApp() {
  const app = express()
  app.use(routes)
  return app
}

test.serial('create a numero', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .post(`/voies/${_idVoie}/numeros`)
    .set({Authorization: 'Token coucou'})
    .send({numero: 42})

  t.is(status, 201)
  t.deepEqual(omit(body, GENERATED_VARS), {
    _bal: _idBal.toHexString(),
    voie: _idVoie.toHexString(),
    commune: '12345',
    numero: 42,
    numeroComplet: '42',
    suffixe: null,
    positions: [],
    comment: null,
    toponyme: null,
    parcelles: []
  })
  t.true(KEYS.every(k => k in body))
  t.is(Object.keys(body).length, KEYS.length)
})

test.serial('create a numero / invalid payload', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .post(`/voies/${_idVoie}/numeros`)
    .set({Authorization: 'Token coucou'})
    .send({numero: 'invalid numero'})

  t.is(status, 400)
  t.deepEqual(body, {
    code: 400,
    message: 'Invalid payload',
    validation: {
      numero: ['"numero" must be a number']
    }
  })
})

test.serial('create a numero / invalid voie', async t => {
  const {status} = await request(getApp())
    .post('/voies/42/numeros')
    .set({Authorization: 'Token coucou'})
    .send({numero: 42})

  t.is(status, 404)
})

test.serial('create a numero / invalid parcelles', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .post(`/voies/${_idVoie}/numeros`)
    .set({Authorization: 'Token coucou'})
    .send({numero: 42, parcelles: ['invalid']})

  t.is(status, 400)
  t.deepEqual(body, {
    code: 400,
    message: 'Invalid payload',
    validation: {
      parcelles: [
        '"parcelles[0]" with value "invalid" fails to match the required pattern: /^[A-Z\\d]+$/',
        '"parcelles[0]" length must be 14 characters long'
      ]
    }
  })
})

test.serial('create a numero / without admin token', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .post(`/voies/${_idVoie}/numeros`)
    .send({numero: 42})

  t.is(status, 403)
})

test.serial('get all numeros from a voie', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 42,
    suffixe: null,
    positions: [],
    comment: null,
    toponyme: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .get(`/voies/${_idVoie}/numeros`)

  t.is(status, 200)
  t.is(body.length, 1)
})

test.serial('get all numeros from a voie / invalid voie', async t => {
  const {status} = await request(getApp())
    .get('/voies/42/numeros')

  t.is(status, 404)
})

test.serial('get all numeros from a toponyme', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  const _idToponyme = new mongo.ObjectID()
  const _idNumeroA = new mongo.ObjectID()
  const _idNumeroB = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('toponymes').insertOne({
    _id: _idToponyme,
    _bal: _idBal,
    commune: '12345',
    nom: 'toponyme',
    positions: [],
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id: _idNumeroA,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 42,
    positions: [],
    parcelles: [],
    comment: null,
    suffixe: 'bis',
    toponyme: _idToponyme,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id: _idNumeroB,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 24,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .get(`/toponymes/${_idToponyme}/numeros`)

  t.is(status, 200)
  t.is(body.length, 1)
  t.deepEqual(omit(body[0], GENERATED_VARS), {
    _bal: _idBal.toHexString(),
    commune: '12345',
    numero: 42,
    comment: null,
    numeroComplet: '42bis',
    positions: [],
    parcelles: [],
    suffixe: 'bis',
    toponyme: _idToponyme.toHexString(),
    voie: {
      _id: _idVoie.toHexString(),
      nom: 'voie'
    }
  })
  t.true(KEYS.every(k => k in body[0]))
  t.is(Object.keys(body[0]).length, KEYS.length)
})

test.serial('get all numeros from a toponyme / invalid toponyme', async t => {
  const {status} = await request(getApp())
    .get('/toponymes/42/numeros')

  t.is(status, 404)
})

test.serial('get a numero', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 42,
    suffixe: 'bis',
    positions: [],
    parcelles: [],
    comment: null,
    toponyme: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .get(`/numeros/${_id}`)

  t.is(status, 200)
  t.deepEqual(omit(body, GENERATED_VARS), {
    _bal: _idBal.toHexString(),
    voie: _idVoie.toHexString(),
    commune: '12345',
    numero: 42,
    suffixe: 'bis',
    numeroComplet: '42bis',
    positions: [],
    parcelles: [],
    comment: null,
    toponyme: null
  })
  t.true(KEYS.every(k => k in body))
  t.is(Object.keys(body).length, KEYS.length)
})

test.serial('get a numero / invalid numero', async t => {
  const {status} = await request(getApp())
    .get('/numeros/42')

  t.is(status, 404)
})

test.serial('modify a numero', async t => {
  const _idToponyme = new mongo.ObjectID()
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('toponymes').insertOne({
    _id: _idToponyme,
    _bal: _idBal,
    commune: '12345',
    nom: 'Le Moulin',
    positions: [],
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 42,
    suffixe: null,
    positions: [],
    comment: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .put(`/numeros/${_id}`)
    .set({Authorization: 'Token coucou'})
    .send({numero: 24, toponyme: _idToponyme.toHexString()})

  t.is(status, 200)
  t.is(body.numero, 24)
  t.is(body.toponyme, _idToponyme.toHexString())
})

test.serial('modify a numero / invalid numero', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .put('/numeros/42')
    .set({Authorization: 'Token coucou'})
    .send({numero: 24})

  t.is(status, 404)
})

test.serial('modify a numero / invalid payload', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 42,
    suffixe: null,
    positions: [],
    comment: null,
    toponyme: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .put(`/numeros/${_id}`)
    .set({Authorization: 'Token coucou'})
    .send({numero: 'invalid numero'})

  t.is(status, 400)
  t.deepEqual(body, {
    code: 400,
    message: 'Invalid payload',
    validation: {
      numero: ['"numero" must be a number']
    }
  })
})
test.serial('modify a numero / without admin token', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 42,
    suffixe: null,
    positions: [],
    comment: null,
    toponyme: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .put(`/numeros/${_id}`)
    .send({numero: 'invalid numero'})

  t.is(status, 403)
  const numero = await mongo.db.collection('numeros').findOne({_id})
  t.is(numero.numero, 42)
})

test.serial('delete a numero', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 42,
    suffixe: null,
    positions: [],
    comment: null,
    toponyme: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .delete(`/numeros/${_id}`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 204)
  const numero = await mongo.db.collection('numeros').findOne({_id})
  t.falsy(numero)
})

test.serial('delete a numero / invalid numero', async t => {
  const {status} = await request(getApp())
    .delete('/numeros/42')

  t.is(status, 404)
})

test.serial('delete a numero / without admin token', async t => {
  const _idVoie = new mongo.ObjectID()
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('voies').insertOne({
    _id: _idVoie,
    _bal: _idBal,
    commune: '12345',
    nom: 'voie',
    code: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: _idBal,
    commune: '12345',
    voie: _idVoie,
    numero: 42,
    suffixe: null,
    positions: [],
    comment: null,
    toponyme: null,
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .delete(`/numeros/${_id}`)

  t.is(status, 403)
})
