const test = require('ava')
const {omit} = require('lodash')
const {MongoDBServer} = require('mongomem')
const express = require('express')
const request = require('supertest')
const mongo = require('../../util/mongo')
const routes = require('..')

test.before('start server', async () => {
  MongoDBServer.port = 27021 // Temp fix
  await MongoDBServer.start()
  await mongo.connect(await MongoDBServer.getConnectionString())
})

test.beforeEach('clean database', async () => {
  await mongo.db.collection('bases_locales').deleteMany({})
})

test.after.always('cleanup', async () => {
  await mongo.disconnect()
  await MongoDBServer.tearDown()
})

function getApp() {
  const app = express()
  app.use(routes)
  return app
}

const GENERATED_VARS = ['_id', '_updated', '_created', 'token']
const KEYS = ['nom', 'description', 'emails', 'token', '_updated', '_created', '_id', 'communes']
const SAFE_FIELDS = ['nom', 'description', '_updated', '_created', '_id', 'communes']

test.serial('create a BaseLocale', async t => {
  const {body, status} = await request(getApp()).post('/bases-locales').send({
    nom: 'foo',
    description: 'bar',
    emails: ['me@domain.tld']
  })

  t.is(status, 201)
  t.deepEqual(omit(body, GENERATED_VARS), {
    nom: 'foo',
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: []
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
      emails: ['"emails" is required']
    }
  })
})

test.serial('get all BaseLocale', async t => {
  const _idBalA = new mongo.ObjectID()
  const _idBalB = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalA,
    nom: 'foo',
    description: 'foo',
    emails: ['me@domain.tld'],
    communes: [],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalB,
    nom: 'fobaro',
    description: 'bar',
    emails: ['you@domain.tld'],
    communes: [],
    token: 'hello',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {body, status} = await request(getApp())
    .get('/bases-locales')

  t.is(status, 200)
  t.is(body.length, 2)
  t.true(SAFE_FIELDS.every(k => k in body[0]))
  t.is(Object.keys(body[0]).length, SAFE_FIELDS.length)
})

test.serial('get a BaseLocal / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {body, status} = await request(getApp())
    .get(`/bases-locales/${_id}`).set({Authorization: 'Token coucou'})
  t.is(status, 200)
  t.true(KEYS.every(k => k in body))
  t.is(Object.keys(body).length, KEYS.length)
})

test.serial('get a BaseLocal / without admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {body, status} = await request(getApp())
    .get(`/bases-locales/${_id}`)

  t.is(status, 200)
  t.true(SAFE_FIELDS.every(k => k in body))
  t.is(Object.keys(body).length, SAFE_FIELDS.length)
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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status, body} = await request(getApp())
    .put(`/bases-locales/${_id}`)
    .set({Authorization: 'Token coucou'})
    .send({emails: []})

  t.is(status, 400)
  t.deepEqual(body, {
    code: 400,
    message: 'Invalid payload',
    validation: {
      emails: ['"emails" must contain at least 1 items']
    }
  })
})

test.serial('delete a BaseLocal / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {body, status} = await request(getApp())
    .put(`/bases-locales/${_id}/communes/27115`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 200)
  t.is(body.communes.length, 1)
  t.is(body.communes[0], '27115')
})

test.serial('add a commune to a BaseLocal / invalid commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: [],
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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: ['27115'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {body, status} = await request(getApp())
    .delete(`/bases-locales/${_id}/communes/27115`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 200)
  t.deepEqual(body.communes, [])
})

test.serial('remove a commune from a BaseLocal / invalid commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: ['27115'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: ['27115'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .delete(`/bases-locales/${_id}/communes/27115`)

  t.is(status, 403)
  const baseLocal = await mongo.db.collection('bases_locales').findOne({_id})
  t.deepEqual(baseLocal.communes, ['27115'])
})

test.serial('renew token / with admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: ['27115'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: ['27115'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

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
    description: 'bar',
    emails: ['me@domain.tld'],
    communes: ['27115'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const {status} = await request(getApp())
    .post(`/bases-locales/${_id}/token/renew`)

  t.is(status, 403)
  const baseLocal = await mongo.db.collection('bases_locales').findOne({_id})
  t.is(baseLocal.token, 'coucou')
})