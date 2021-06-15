const test = require('ava')
const {MongoMemoryServer} = require('mongodb-memory-server')
const mongo = require('../../lib/util/mongo')

const {migrateCommune} = require('../2021-03-19-communes-collection')

const mongod = new MongoMemoryServer()

test.before('start server', async () => {
  await mongo.connect(await mongod.getUri())
})

test.after.always('cleanup', async () => {
  await mongo.disconnect()
  await mongod.stop()
})

test('migrate BaseLocale communes to collection', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co'],
    communes: ['27115', '54084'],
    token: 'coucou',
    status: 'draft',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  await migrateCommune()

  const baseLocale = await mongo.db.collection('bases_locales').findOne({_id})

  t.falsy(baseLocale.communes)
  t.truthy(await mongo.db.collection('communes').find({_bal: _id, code: '27115'}))
  t.truthy(await mongo.db.collection('communes').find({_bal: _id, code: '54084'}))
})
