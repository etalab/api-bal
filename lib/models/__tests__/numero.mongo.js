const test = require('ava')
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
  const idBal = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  const referenceDate = new Date('2019-01-01')

  await mongo.db.collection('bases_locales').insertOne({
    _id: idBal,
    _updated: referenceDate
  })
  await mongo.db.collection('voies').insertOne({
    _id,
    _bal: idBal,
    _updated: referenceDate
  })
  const numero = await Numero.create(_id, {
    numero: 42,
    suffixe: 'foo',
    comment: 'bar',
    positions: []
  })

  const keys = ['_id', '_bal', 'commune', '_updated', '_created', 'voie', 'numero', 'suffixe', 'comment', 'positions']
  t.true(keys.every(k => k in numero))
  t.is(Object.keys(numero).length, 10)

  const bal = await mongo.db.collection('bases_locales').findOne({_id: idBal})
  t.deepEqual(numero._created, bal._updated)

  const voie = await mongo.db.collection('voies').findOne({_id})
  t.deepEqual(numero._created, voie._updated)
})

test('create a numero / invalid numero type', t => {
  const idVoie = new mongo.ObjectID()
  return t.throwsAsync(Numero.create(idVoie, {
    numero: '042',
    suffixe: 'foo',
    positions: []
  }), 'Invalid payload')
})

test('create a numero / minimal', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('voies').insertOne({_id})
  const numero = await Numero.create(_id, {numero: 42})

  const keys = ['_id', '_bal', 'commune', '_updated', '_created', 'voie', 'numero', 'comment', 'suffixe', 'positions']
  t.true(keys.every(k => k in numero))
  t.is(Object.keys(numero).length, 10)
})

test('create a numero / voie do not exists', t => {
  const _id = new mongo.ObjectID()
  return t.throwsAsync(Numero.create(_id, {numero: 42}, 'Voie not found'))
})

test('importMany', async t => {
  const idBal = new mongo.ObjectID()
  const idVoie = new mongo.ObjectID()

  const numero1 = {voie: idVoie, numero: 42, commune: '12345', _created: new Date('2019-01-01'), _updated: new Date('2019-01-05')}
  const numero2 = {voie: idVoie, numero: 24, commune: '12345'}

  await Numero.importMany(idBal, [numero1, numero2], {validate: false})

  const numeros = await mongo.db.collection('numeros').find({_bal: idBal, voie: idVoie}).toArray()
  t.is(numeros.length, 2)
  t.true(numeros.some(n => n.numero === 24))
  t.true(numeros.some(n => n.numero === 42))
  const n42 = numeros.find(n => n.numero === 42)
  t.deepEqual(n42._created, new Date('2019-01-01'))
  t.deepEqual(n42._updated, new Date('2019-01-05'))
})

test('update a numero', async t => {
  const idBal = new mongo.ObjectID()
  const idVoie = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  const referenceDate = new Date('2019-01-01')

  await mongo.db.collection('bases_locales').insertOne({
    _id: idBal,
    _updated: referenceDate
  })
  await mongo.db.collection('voies').insertOne({
    _id: idVoie,
    _bal: idBal,
    commune: '12345',
    _updated: referenceDate
  })
  await mongo.db.collection('numeros').insertOne({
    _id,
    _bal: idBal,
    commune: '12345',
    voie: idVoie,
    numero: 42,
    suffixe: 'foo',
    positions: [],
    _created: referenceDate,
    _updated: referenceDate
  })

  const numero = await Numero.update(_id, {
    numero: 24,
    suffixe: 'bar',
    comment: 'Commentaire de numéro 123 !',
    positions: [{
      point: {type: 'Point', coordinates: [0, 0]},
      source: 'source',
      type: 'entrée'
    }]
  })

  t.is(numero.numero, 24)
  t.is(numero.suffixe, 'bar')
  t.is(numero.comment, 'Commentaire de numéro 123 !')
  t.is(numero.positions.length, 1)
  t.is(Object.keys(numero).length, 10)

  const bal = await mongo.db.collection('bases_locales').findOne({_id: idBal})
  t.notDeepEqual(numero._created, bal._updated)

  const voie = await mongo.db.collection('voies').findOne({_id: idVoie})
  t.notDeepEqual(numero._created, voie._updated)
})

test('update a numero / not found', t => {
  const _id = new mongo.ObjectID()
  return t.throwsAsync(() => Numero.update(_id, {numero: 42}), 'Numero not found')
})

test('delete a numero', async t => {
  const idBal = new mongo.ObjectID()
  const idVoie = new mongo.ObjectID()
  const _id = new mongo.ObjectID()
  const referenceDate = new Date('2019-01-01')

  await mongo.db.collection('bases_locales').insertOne({
    _id: idBal,
    _updated: referenceDate
  })
  await mongo.db.collection('voies').insertOne({
    _bal: idBal,
    _id: idVoie,
    commune: '12345',
    _updated: referenceDate
  })
  await mongo.db.collection('numeros').insertOne({
    _bal: idBal,
    voie: idVoie,
    _id,
    commune: '12345',
    numero: 42,
    suffixe: 'foo',
    positions: [],
    _created: referenceDate,
    _updated: referenceDate
  })

  await Numero.remove(_id)

  const numero = await mongo.db.collection('numeros').findOne({_id})
  t.falsy(numero)

  const bal = await mongo.db.collection('bases_locales').findOne({_id: idBal})
  t.notDeepEqual(referenceDate, bal._updated)

  const voie = await mongo.db.collection('voies').findOne({_id: idVoie})
  t.notDeepEqual(referenceDate, voie._updated)
})
