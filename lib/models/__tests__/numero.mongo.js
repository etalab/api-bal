import test from 'ava'

const {MongoDBServer} = require('mongomem')
const mongo = require('../../util/mongo')
const Numero = require('../numero')

test.before('start server', async () => {
  MongoDBServer.port = 27020 // Temp fix
  await MongoDBServer.start()
  await mongo.connect(await MongoDBServer.getConnectionString())
})

test.after.always('cleanup', async () => {
  await mongo.disconnect()
  await MongoDBServer.tearDown()
})

test('create a numero', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('voies').insertOne({_id})
  const numero = await Numero.create(_id, {
    numero: 42,
    suffixe: 'foo',
    positions: []
  })

  const keys = ['_id', '_bal', 'commune', '_updated', '_created', 'voie', 'numero', 'suffixe', 'positions']
  t.true(keys.every(k => k in numero))
  t.is(Object.keys(numero).length, 9)
})

test('create a numero / voie do not exists', t => {
  const _id = new mongo.ObjectID()
  return t.throwsAsync(Numero.create(_id, {numero: 42}, 'Voie not found'))
})

test('update a numero', async t => {
  const idBal = new mongo.ObjectID()
  const idVoie = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  await mongo.db.collection('voies').insertOne({_id: idVoie, _bal: idBal, commune: '12345'})
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: idBal,
    commune: '12345',
    voie: idVoie,
    numero: 42,
    suffixe: 'foo',
    positions: [],
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const numero = await Numero.update(_id, {
    numero: 24,
    suffixe: 'bar',
    positions: [{
      point: {type: 'Point', coordinates: [0, 0]},
      source: 'source',
      type: 'entrée'
    }]
  })

  t.is(numero.numero, 24)
  t.is(numero.suffixe, 'bar')
  t.is(numero.positions.length, 1)
  t.is(Object.keys(numero).length, 9)
})

test('update a numero / not found', t => {
  const _id = new mongo.ObjectID()
  return t.throwsAsync(() => Numero.update(_id, {numero: 42}), 'Numero not found')
})

test('delete a numero', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: _id,
    commune: '12345',
    voie: _id,
    numero: 42,
    suffixe: 'foo',
    positions: [],
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await Numero.remove(_id)
  const numero = await mongo.db.collection('numeros').findOne({_id})
  t.falsy(numero)
})