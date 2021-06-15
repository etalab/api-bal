const test = require('ava')
const request = require('supertest')
const express = require('express')
const {MongoMemoryServer} = require('mongodb-memory-server')
const mongo = require('../../util/mongo')
const {prepareContoursCommunes} = require('../../../lib/util/contours-communes')
const routes = require('../stats')

const mongod = new MongoMemoryServer()

function getApp() {
  const app = express()
  app.use(routes)
  return app
}

const SAFE_FIELDS = ['nom', '_updated', '_created', '_id', 'communes']

test.before('start server', async () => {
  await mongo.connect(await mongod.getUri())
})

test.before('prepare contours communes', async () => {
  await prepareContoursCommunes()
})

test.after.always('cleanup', async () => {
  await mongo.disconnect()
  await mongod.stop()
})

test.beforeEach('clean database', async () => {
  await mongo.db.collection('bases_locales').deleteMany({})
  await mongo.db.collection('communes').deleteMany({})
})

test.serial('get Bases Locales with a code departement', async t => {
  const _idBalA = new mongo.ObjectID()
  const _idBalB = new mongo.ObjectID()
  const _idBalC = new mongo.ObjectID()

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalA,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _idBalA, code: '54084'})

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalB,
    nom: 'fobaro',
    emails: ['you@domain.tld'],
    token: 'hello',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _idBalB, code: '54222'})

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalC,
    nom: 'fobaro',
    emails: ['you@domain.tld'],
    token: 'hello',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _idBalC, code: '33345'})

  const {body, status} = await request(getApp())
    .get('/departements/54')
  t.is(status, 200)
  t.is(body.length, 2)
  t.true(SAFE_FIELDS.every(k => k in body[0]))
  t.is(Object.keys(body[0]).length, SAFE_FIELDS.length)
})

test.serial('get Bases Locales with code departement / invalid code departement', async t => {
  const _id = new mongo.ObjectID()

  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '54084'})

  const {status, body} = await request(getApp())
    .get('/departements/20')
  t.is(status, 404)
  t.is(body.code, 404)
  t.is(body.message, 'Le département 20 n’existe pas.')
})

test.serial('get couverture BAL', async t => {
  const _idBalA = new mongo.ObjectID()
  const _idBalB = new mongo.ObjectID()
  const _idBalC = new mongo.ObjectID()
  const _idBalD = new mongo.ObjectID()

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalA,
    nom: 'foo',
    emails: ['me@domain.co'],
    status: 'ready-to-publish',
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _idBalA, code: '54084'})

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalB,
    nom: 'foo',
    emails: ['me@domain.co'],
    status: 'draft',
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _idBalB, code: '57222'})

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalC,
    nom: 'foo',
    published: true,
    emails: ['me@domain.co'],
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _idBalC, code: '69123'})

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalD,
    nom: 'foo',
    status: 'draft',
    emails: ['me@domain.co'],
    enableComplement: false,
    token: 'coucou',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _idBalD, code: '54084'})
  await mongo.db.collection('communes').insertOne({_bal: _idBalD, code: '57222'})
  await mongo.db.collection('communes').insertOne({_bal: _idBalD, code: '69123'})

  const {body, status} = await request(getApp())
    .get('/couverture-bal')

  t.is(status, 200)
  t.is(body.type, 'FeatureCollection')
  t.is(body.features.length, 3)
})
