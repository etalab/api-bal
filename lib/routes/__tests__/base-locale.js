const test = require('ava')
const {omit} = require('lodash')
const {MongoMemoryServer} = require('mongodb-memory-server')
const express = require('express')
const request = require('supertest')
const mongo = require('../../util/mongo')
const BaseLocale = require('../../models/base-locale')
const {mockBan54} = require('../../populate/__mocks__/ban')
const routes = require('..')

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
})

function getApp() {
  const app = express()
  app.use(routes)
  return app
}

const GENERATED_VARS = ['_id', '_updated', '_created', 'token']
const KEYS = ['nom', 'emails', 'token', '_updated', '_created', '_id', 'status']
const SAFE_FIELDS = ['nom', '_updated', '_created', '_id']

test.serial('create a BaseLocale', async t => {
  const {body, status} = await request(getApp()).post('/bases-locales').send({
    nom: 'foo',
    emails: ['me@domain.co']
  })

  t.is(status, 201)
  t.deepEqual(omit(body, GENERATED_VARS), {
    nom: 'foo',
    emails: ['me@domain.co'],
    status: 'draft'
  })
  t.true(KEYS.every(k => k in body))
  t.is(Object.keys(body).length, KEYS.length)
})

test.serial('create a BaseLocale / invalid payload', async t => {
  const {status, body} = await request(getApp()).post('/bases-locales').send({})
  t.is(status, 400)
  t.deepEqual(body, {
    code: 400,
    message: 'Invalid payload',
    validation: {
      nom: [
        '"nom" is required'
      ],
      emails: [
        '"emails" is required'
      ]
    }
  })
})

test.serial('get all BaseLocale', async t => {
  const _idBalA = new mongo.ObjectID()
  const _idBalB = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalA,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  await mongo.db.collection('communes').insertOne({
    _bal: _idBalA,
    code: '12345'
  })

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalB,
    nom: 'fobaro',
    emails: ['you@domain.tld'],
    token: 'hello',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  await mongo.db.collection('communes').insertOne({
    _bal: _idBalB,
    code: '54321'
  })

  const {body, status} = await request(getApp())
    .get('/bases-locales')

  t.is(status, 200)
  t.is(body.length, 2)
  t.true(SAFE_FIELDS.every(k => k in body[0]))
  t.true('communes' in body[0])
  t.is(body[0].communes[0], '12345')
  t.is(body[1].communes[0], '54321')
  t.is(Object.keys(body[0]).length, 5)
})

test.serial('get a BaseLocal / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    status: 'draft',
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  await mongo.db.collection('communes').insertOne({
    _bal: _id,
    code: '12345'
  })

  const {body, status} = await request(getApp())
    .get(`/bases-locales/${_id}`).set({Authorization: 'Token coucou'})
  t.is(status, 200)
  t.true(KEYS.every(k => k in body))
  t.true('communes' in body)
  t.is(body.communes[0], '12345')
  t.is(Object.keys(body).length, 8)
})

test.serial('get a BaseLocal / without admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  await mongo.db.collection('communes').insertOne({
    _bal: _id,
    code: '12345'
  })

  const {body, status} = await request(getApp())
    .get(`/bases-locales/${_id}`)

  t.is(status, 200)
  t.true(SAFE_FIELDS.every(k => k in body))
  t.true('communes' in body)
  t.is(body.communes[0], '12345')
  t.is(Object.keys(body).length, 5)
})

test.serial('get a BaseLocal / invalid id', async t => {
  const {status} = await request(getApp())
    .get('/bases-locales/42')

  t.is(status, 404)
})

test.serial('modify a BaseLocal / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {body, status} = await request(getApp())
    .put(`/bases-locales/${_id}`)
    .set({Authorization: 'Token coucou'})
    .send({nom: 'bar'})

  t.is(status, 200)
  t.is(body.nom, 'bar')
})

test.serial('modify a BaseLocal / without admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp()).put(`/bases-locales/${_id}`).send({nom: 'bar'})
  t.is(status, 403)
})

test.serial('modify a BaseLocal / invalid payload', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .put(`/bases-locales/${_id}`)
    .set({Authorization: 'Token coucou'})
    .send({nom: '', emails: []})

  t.is(status, 400)
  t.deepEqual(body, {
    code: 400,
    message: 'Invalid payload',
    validation: {
      nom: ['"nom" is not allowed to be empty'],
      emails: ['"emails" must contain at least 1 items']
    }
  })
})

test.serial('modify a BaseLocal / demo', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    communes: ['27115'],
    token: 'coucou',
    status: 'demo',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const {body, status} = await request(getApp())
    .put(`/bases-locales/${_id}`)
    .set({Authorization: 'Token coucou'})
    .send({nom: 'bar', email: 'me@mail.co'})

  t.is(status, 403)
  t.deepEqual(body, {
    code: 403,
    message: 'Une Base Adresse Locale de démonstration ne peut pas être modifiée. Elle doit d’abord être transformée en brouillon.'
  })
})

test.serial('transform BaseLocal to draft / not a demo', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    status: 'draft',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const {body, status} = await request(getApp())
    .post(`/bases-locales/${_id}/transform-to-draft`)
    .set({Authorization: 'Token coucou'})
    .send({nom: 'bar', email: 'me@mail.co'})

  t.is(status, 403)
  t.deepEqual(body, {
    code: 403,
    message: 'La Base Adresse Locale n’est pas une Base Adresse Locale de démonstration'
  })
})

test.serial('delete a BaseLocal / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .delete(`/bases-locales/${_id}`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 204)

  const baseLocal = await mongo.db.collection('bases_locales').findOne({_id})
  t.is(baseLocal, null)
})

test.serial('delete a BaseLocal / without admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .delete(`/bases-locales/${_id}`)

  t.is(status, 403)

  const baseLocal = await mongo.db.collection('bases_locales').findOne({_id})
  t.deepEqual(baseLocal, {
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
})

test.serial('add a commune to a BaseLocal / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .put(`/bases-locales/${_id}/communes/27115`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 200)
  t.truthy(await mongo.db.collection('communes').find({_bal: _id, code: '27115'}))
})

test.serial('add a commune to a BaseLocal / invalid commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .put(`/bases-locales/${_id}/communes/12345`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 500)
})

test.serial('add a commune to a BaseLocal / without admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .put(`/bases-locales/${_id}/communes/27115`)

  t.is(status, 403)
})

test.serial('remove a commune from a BaseLocal / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const {status} = await request(getApp())
    .delete(`/bases-locales/${_id}/communes/27115`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 200)
  t.falsy(await mongo.db.collection('communes').findOne({_bal: _id, code: '27115'}))
})

test.serial('remove a commune from a BaseLocal / invalid commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const {status} = await request(getApp())
    .delete(`/bases-locales/${_id}/communes/12345`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 500)
})

test.serial('remove a commune from a BaseLocal / without admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const {status} = await request(getApp())
    .delete(`/bases-locales/${_id}/communes/27115`)

  t.is(status, 403)
  t.truthy(await mongo.db.collection('communes').findOne({_bal: _id, code: '27115'}))
})

test('export as CSV', async t => {
  mockBan54()
  const {_id} = await BaseLocale.create({nom: 'foo', emails: ['toto@acme.co']})
  await BaseLocale.addCommune(_id, '54084')
  await BaseLocale.populateCommune(_id, '54084')

  const {status, headers, text} = await request(getApp())
    .get(`/bases-locales/${_id}/csv`)

  t.is(status, 200)
  t.is(headers['content-disposition'], 'attachment; filename="bal.csv"')
  t.is(headers['content-type'], 'text/csv; charset=utf-8')
  t.is(text.split('\r\n').length, 447)
})

test('Export as GeoJSON', async t => {
  mockBan54()
  const {_id} = await BaseLocale.create({nom: 'foo', emails: ['toto@acme.co']})
  await BaseLocale.addCommune(_id, '54084')
  await BaseLocale.populateCommune(_id, '54084')

  const {status, headers, body} = await request(getApp())
    .get(`/bases-locales/${_id}/communes/54084/geojson`)

  t.is(status, 200)
  t.is(headers['content-type'], 'application/json; charset=utf-8')
  t.is(body.type, 'FeatureCollection')
  t.is(body.features.length, 445)
})

test.serial('renew token / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const {status, body} = await request(getApp())
    .post(`/bases-locales/${_id}/token/renew`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 200)
  t.not(body.token, 'coucou')
})

test.serial('renew token / invalid balId', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const {status} = await request(getApp())
    .post('/bases-locales/42/token/renew')
    .set({Authorization: 'Token coucou'})

  t.is(status, 404)
})

test.serial('renew token / without admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const {status} = await request(getApp())
    .post(`/bases-locales/${_id}/token/renew`)

  t.is(status, 403)
  const baseLocal = await mongo.db.collection('bases_locales').findOne({_id})
  t.is(baseLocal.token, 'coucou')
})

test('get all assigned parcelles', async t => {
  const _id = new mongo.ObjectID()

  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    communes: ['55326'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  await mongo.db.collection('numeros').insertOne({
    _bal: _id,
    numero: 1,
    commune: '55326',
    parcelles: ['12345000AA0002']
  })

  await mongo.db.collection('toponymes').insertOne({
    _bal: _id,
    commune: '55326',
    parcelles: ['12345000AA0002', '12345000AA0005']
  })

  const {status, body} = await request(getApp())
    .get(`/bases-locales/${_id}/communes/55326/parcelles`)

  t.is(status, 200)
  t.is(body.length, 2)
  t.deepEqual(body, ['12345000AA0002', '12345000AA0005'])
})
