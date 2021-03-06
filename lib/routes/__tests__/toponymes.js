const test = require('ava')
const {MongoMemoryServer} = require('mongodb-memory-server')
const express = require('express')
const request = require('supertest')
const {omit} = require('lodash')
const mongo = require('../../util/mongo')
const routes = require('..')

const GENERATED_VARS = ['_id', '_updated', '_created']
const KEYS = ['_id', '_bal', 'nom', 'positions', 'parcelles', 'commune', '_created', '_updated']

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
  await mongo.db.collection('toponymes').deleteMany({})
})

function getApp() {
  const app = express()
  app.use(routes)
  return app
}

test.serial('create a toponyme', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status, body} = await request(getApp())
    .post(`/bases-locales/${_id}/communes/12345/toponymes`)
    .set({Authorization: 'Token coucou'})
    .send({nom: 'toponyme'})

  t.is(status, 201)
  t.deepEqual(omit(body, GENERATED_VARS), {
    _bal: _id.toHexString(),
    commune: '12345',
    nom: 'toponyme',
    positions: [],
    parcelles: []
  })
  t.true(KEYS.every(k => k in body))
  t.is(Object.keys(body).length, KEYS.length)
})

test.serial('create a toponyme / without nom', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status, body} = await request(getApp())
    .post(`/bases-locales/${_id}/communes/12345/toponymes`)
    .set({Authorization: 'Token coucou'})
    .send({position:
      {
        point: {type: 'Point', coordinates: [1, 1]},
        type: 'entrée',
        source: 'ban'
      }
    })

  t.is(status, 400)
  t.deepEqual(body, {
    code: 400,
    message: 'Invalid payload',
    validation: {
      nom: ['"nom" is required']
    }
  })
})

test.serial('create a toponyme / invalid base locale', async t => {
  const {status} = await request(getApp())
    .post('/bases-locales/12345/communes/12345/toponymes')
    .set({Authorization: 'Token coucou'})
    .send({nom: 'toponyme'})

  t.is(status, 404)
})

test.serial('create a toponyme / invalid commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status, body} = await request(getApp())
    .post(`/bases-locales/${_id}/communes/11111/toponymes`)
    .set({Authorization: 'Token coucou'})
    .send({nom: 'toponyme'})

  t.is(status, 400)
  t.is(body.code, 400)
  t.is(body.message, 'Cette commune n’a pas encore été ajoutée à la base.')
})

test.serial('create a toponyme / without admin token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status} = await request(getApp())
    .post(`/bases-locales/${_id}/communes/12345/toponymes`)
    .send({nom: 'toponyme'})

  t.is(status, 403)
  const toponymes = await mongo.db.collection('toponymes').find({}).toArray()
  t.deepEqual(toponymes, [])
})

test.serial('get all toponymes from a commune', async t => {
  const _idBal = new mongo.ObjectID()
  const _idToponyeA = new mongo.ObjectID()
  const _idToponyeB = new mongo.ObjectID()
  const _idToponyeC = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })
  await mongo.db.collection('toponymes').insertMany([{
    _idToponyeA,
    _bal: _idBal,
    nom: 'toponymeA',
    commune: '12345',
    positions: [],
    parcelles: [],
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  },
  {
    _idToponyeB,
    _bal: _idBal,
    nom: 'toponymeB',
    commune: '12345',
    positions: [],
    parcelles: [],
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  },
  {
    _idToponyeC,
    _bal: _idBal,
    nom: 'toponymeB',
    commune: '67890',
    positions: [],
    parcelles: [],
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  }])

  const {status, body} = await request(getApp())
    .get(`/bases-locales/${_idBal}/communes/12345/toponymes`)

  t.is(status, 200)
  t.is(body.length, 2)
})

test.serial('get all toponymes from a commune / invalid base locale', async t => {
  const {status} = await request(getApp())
    .get('/bases-locales/42/communes/12345/toponymes')

  t.is(status, 404)
})

test.serial('get a toponyme', async t => {
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
  await mongo.db.collection('toponymes').insertOne({
    _id,
    _bal: _idBal,
    nom: 'toponyme',
    commune: '12345',
    positions: [],
    parcelles: [],
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status, body} = await request(getApp())
    .get(`/toponymes/${_id}`)

  t.is(status, 200)
  t.deepEqual(omit(body, GENERATED_VARS), {
    _bal: _idBal.toHexString(),
    nom: 'toponyme',
    commune: '12345',
    positions: [],
    parcelles: []
  })
  t.true(KEYS.every(k => k in body))
  t.is(Object.keys(body).length, KEYS.length)
})

test.serial('get a toponyme / invalid toponyme', async t => {
  const {status} = await request(getApp())
    .get('/toponymes/42')

  t.is(status, 404)
})

test.serial('modify a toponyme', async t => {
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })
  await mongo.db.collection('toponymes').insertOne({
    _id,
    _bal: _idBal,
    nom: 'toponyme',
    commune: '12345',
    positions: [],
    parcelles: [],
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status, body} = await request(getApp())
    .put(`/toponymes/${_id}`)
    .set({Authorization: 'Token coucou'})
    .send({nom: 'Le Moulin'})

  t.is(status, 200)
  t.is(body.nom, 'Le Moulin')
})

test.serial('modify a toponyme / empty nom', async t => {
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })
  await mongo.db.collection('toponymes').insertOne({
    _id,
    _bal: _idBal,
    nom: 'toponyme',
    commune: '12345',
    positions: [],
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status, body} = await request(getApp())
    .put(`/toponymes/${_id}`)
    .set({Authorization: 'Token coucou'})
    .send({nom: ''})

  t.is(status, 400)
  t.deepEqual(body, {
    code: 400,
    message: 'Invalid payload',
    validation: {
      nom: ['"nom" is not allowed to be empty']
    }
  })
})

test.serial('delete a toponyme', async t => {
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })
  await mongo.db.collection('toponymes').insertOne({
    _id,
    _bal: _idBal,
    nom: 'toponyme',
    commune: '12345',
    positions: [],
    parcelles: [],
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status} = await request(getApp())
    .delete(`/toponymes/${_id}`)
    .set({Authorization: 'Token coucou'})

  t.is(status, 204)
  const toponyme = await mongo.db.collection('toponymes').findOne({_id})
  t.falsy(toponyme)
})

test.serial('delete a toponyme / invalid toponyme', async t => {
  const {status} = await request(getApp())
    .delete('/toponymes/42')

  t.is(status, 404)
})

test.serial('delete a toponyme / without admin token', async t => {
  const _idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBal,
    nom: 'foo',
    emails: ['me@domain.tld'],
    communes: ['12345'],
    token: 'coucou',
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })
  await mongo.db.collection('toponymes').insertOne({
    _id,
    _bal: _idBal,
    nom: 'toponyme',
    commune: '12345',
    positions: [],
    parcelles: [],
    _created: new Date('2021-01-01'),
    _updated: new Date('2021-01-01')
  })

  const {status} = await request(getApp())
    .delete(`/toponymes/${_id}`)

  t.is(status, 403)
})
