const test = require('ava')
const {MongoMemoryServer} = require('mongodb-memory-server')
const mongo = require('../../util/mongo')
const BaseLocale = require('../base-locale')
const {getAssignedParcelles} = require('../base-locale')
const {mockBan54} = require('../../populate/__mocks__/ban')

const mongod = new MongoMemoryServer()

test.before('start server', async () => {
  await mongo.connect(await mongod.getUri())
})

test.after.always('cleanup', async () => {
  await mongo.disconnect()
  await mongod.stop()
})

test('create a BaseLocale', async t => {
  const baseLocale = await BaseLocale.create({
    nom: 'foo',
    emails: ['me@domain.co']
  })
  const keys = ['nom', 'status', 'emails', 'token', '_updated', '_created', '_id']
  t.true(keys.every(k => k in baseLocale))
  t.true(baseLocale.status === 'draft')
  t.is(Object.keys(baseLocale).length, 7)
})

test('create a BaseLocale / minimal', async t => {
  const baseLocale = await BaseLocale.create({nom: 'foo', emails: ['me@domain.co']})
  const keys = ['nom', 'status', 'emails', 'token', '_updated', '_created', '_id']
  t.true(keys.every(k => k in baseLocale))
  t.is(Object.keys(baseLocale).length, 7)
})

test('create a BaseLocale / without nom', async t => {
  const error = await t.throwsAsync(() => BaseLocale.create({emails: ['me@domain.co']}))

  t.deepEqual(error.validation, {
    nom: ['"nom" is required']
  })

  t.is(error.message, 'Invalid payload')
})

test('create a BaseLocale / empty nom', async t => {
  const error = await t.throwsAsync(() => BaseLocale.create({nom: '', emails: ['me@domain.co']}))

  t.deepEqual(error.validation, {
    nom: ['"nom" is not allowed to be empty']
  })

  t.is(error.message, 'Invalid payload')
})

test('create a BaseLocale / demo', async t => {
  const baseLocale = await BaseLocale.createDemo({
    commune: '27115',
    populate: false
  })
  const keys = ['nom', 'status', 'token', '_updated', '_created', '_id']
  t.true(keys.every(k => k in baseLocale))
  t.is(Object.keys(baseLocale).length, 6)
  t.is(baseLocale.nom, 'Adresses de Breux-sur-Avre [démo]')
  t.truthy(await mongo.db.collection('communes').findOne({_bal: baseLocale._id, code: '27115'}))
  t.is(baseLocale.status, 'demo')
})

test('create a demo BaseLocale / invalid commune', async t => {
  try {
    await BaseLocale.createDemo({
      commune: '00000',
      populate: false
    })

    t.fail()
  } catch (error) {
    t.deepEqual(error.validation, {
      commune: ['Code commune inconnu']
    })

    t.is(error.message, 'Invalid payload')
  }
})

test('create a BaseLocale / populate demo', async t => {
  mockBan54()
  const baseLocale = await BaseLocale.createDemo({
    commune: '54084',
    populate: true
  })

  const voie = await mongo.db.collection('voies').findOne({_bal: baseLocale._id, commune: '54084'})
  t.truthy(voie)
})

test('update a BaseLocale', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'foo',
    emails: ['me@domain.co', 'me2@domain.co'],
    token: 'coucou',
    status: 'draft',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })

  const baseLocale = await BaseLocale.update(_id, {
    nom: 'foo2',
    emails: ['me2@domain.co', 'me3@domain.co'],
    status: 'ready-to-publish',
    token: 'hack'
  })

  t.is(baseLocale.nom, 'foo2')
  t.deepEqual(baseLocale.emails, ['me2@domain.co', 'me3@domain.co'])
  t.is(baseLocale.token, 'coucou')
  t.is(baseLocale.status, 'ready-to-publish')
  t.is(Object.keys(baseLocale).length, 7)
})

test('update a BaseLocale / not found', t => {
  const _id = new mongo.ObjectID()
  return t.throwsAsync(() => BaseLocale.update(_id, {nom: 'foo'}), {message: 'BaseLocale not found'})
})

test('transform to draft', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'Base Adresse Locale [DEMO]',
    token: 'coucou',
    status: 'demo',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  const baseLocaleDemo = await BaseLocale.fetchOne(_id)
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})

  const baseLocale = await BaseLocale.transformToDraft(baseLocaleDemo, {
    nom: 'foo2',
    email: 'me2@domain.co'
  })

  t.is(baseLocale.nom, 'foo2')
  t.deepEqual(baseLocale.emails, ['me2@domain.co'])
  t.is(baseLocale.status, 'draft')
  t.is(Object.keys(baseLocale).length, 7)
})

test('transform to draft / default nom', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    nom: 'Base Adresse Locale [DEMO]',
    token: 'coucou',
    status: 'demo',
    _created: new Date('2019-01-01'),
    _updated: new Date('2019-01-01')
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})
  const baseLocaleDemo = await BaseLocale.fetchOne(_id)

  const baseLocale = await BaseLocale.transformToDraft(baseLocaleDemo, {
    email: 'me2@domain.co'
  })

  t.is(baseLocale.nom, 'Adresses de Breux-sur-Avre')
  t.deepEqual(baseLocale.emails, ['me2@domain.co'])
  t.is(baseLocale.status, 'draft')
  t.is(Object.keys(baseLocale).length, 7)
})

test('remove a BaseLocale', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({_id, nom: 'foo'})
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})
  await mongo.db.collection('voies').insertOne({_bal: _id, nom: 'foo'})
  await mongo.db.collection('numeros').insertOne({_bal: _id, numero: 1})

  await BaseLocale.remove(_id)

  t.falsy(await mongo.db.collection('bases_locales').findOne({_id}))
  t.falsy(await mongo.db.collection('communes').findOne({_bal: _id}))
  t.falsy(await mongo.db.collection('voies').findOne({_bal: _id}))
  t.falsy(await mongo.db.collection('numeros').findOne({_bal: _id}))
})

test('cleanContent', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({_id, nom: 'foo'})
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '27115'})
  await mongo.db.collection('voies').insertOne({_bal: _id, nom: 'foo'})
  await mongo.db.collection('numeros').insertOne({_bal: _id, numero: 1})

  await BaseLocale.cleanContent(_id)

  t.truthy(await mongo.db.collection('bases_locales').findOne({_id}))
  t.falsy(await mongo.db.collection('communes').findOne({_bal: _id}))
  t.falsy(await mongo.db.collection('voies').findOne({_bal: _id}))
  t.falsy(await mongo.db.collection('numeros').findOne({_bal: _id}))
})

test('renew token', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    token: 'coucou',
    emails: ['toto@domain.co']
  })

  const baseLocale = await BaseLocale.renewToken(_id)

  t.not(baseLocale.token, 'coucou')
  t.is(baseLocale.token.length, 20)
})

test('add a commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    token: 'coucou'
  })

  await BaseLocale.addCommune(_id, '54084')

  t.truthy(await mongo.db.collection('communes').findOne({_bal: _id, code: '54084'}))
})

test('add a commune / invalid code commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    token: 'coucou'
  })

  await t.throwsAsync(() => BaseLocale.addCommune(_id, '00000'))
})

test('clean a commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    token: 'coucou'
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '54084'})
  await mongo.db.collection('voies').insertOne({_bal: _id, nom: 'foo', commune: '54084'})
  await mongo.db.collection('numeros').insertOne({_bal: _id, numero: 1, commune: '54084'})

  await BaseLocale.cleanCommune(_id, '54084')

  t.truthy(await mongo.db.collection('communes').findOne({_bal: _id, code: '54084'}))
  t.falsy(await mongo.db.collection('voies').findOne({_bal: _id, commune: '54084'}))
  t.falsy(await mongo.db.collection('numeros').findOne({_bal: _id, commune: '54084'}))
})

test('remove a commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    token: 'coucou'
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '54084'})
  await mongo.db.collection('voies').insertOne({_bal: _id, nom: 'foo', commune: '54084'})
  await mongo.db.collection('numeros').insertOne({_bal: _id, numero: 1, commune: '54084'})

  await BaseLocale.removeCommune(_id, '54084')

  t.falsy(await mongo.db.collection('communes').findOne({_bal: _id, code: '54084'}))
  t.falsy(await mongo.db.collection('voies').findOne({_bal: _id, commune: '54084'}))
  t.falsy(await mongo.db.collection('numeros').findOne({_bal: _id, commune: '54084'}))
})

test('populate a commune', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    token: 'coucou'
  })
  await mongo.db.collection('communes').insertOne({_bal: _id, code: '54084'})
  await mongo.db.collection('voies').insertOne({_bal: _id, nom: 'foo', commune: '54084'})
  await mongo.db.collection('numeros').insertOne({_bal: _id, numero: 1, commune: '54084'})

  mockBan54()
  await BaseLocale.populateCommune(_id, '54084')

  t.truthy(await mongo.db.collection('communes').findOne({_bal: _id, code: '54084'}))

  const voie = await mongo.db.collection('voies').findOne({_bal: _id, commune: '54084', nom: 'allée des acacias'})
  t.truthy(voie)
  t.is(await mongo.db.collection('numeros').countDocuments({_bal: _id, voie: voie._id, commune: '54084'}), 49)
  t.is(await mongo.db.collection('voies').countDocuments({_bal: _id, commune: '54084'}), 20)
  t.is(await mongo.db.collection('numeros').countDocuments({_bal: _id, commune: '54084'}), 445)
  t.is((await mongo.db.collection('numeros').distinct('voie', {_bal: _id, commune: '54084'})).length, 20)
})

test('find Bases Locales by codes communes', async t => {
  const _idBalA = new mongo.ObjectID()
  const _idBalB = new mongo.ObjectID()
  const _idBalC = new mongo.ObjectID()

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalA,
    token: 'coucou1'
  })
  await mongo.db.collection('communes').insertOne({
    _bal: _idBalA,
    code: '47192'
  })

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalB,
    token: 'coucou2'
  })
  await mongo.db.collection('communes').insertOne({
    _bal: _idBalB,
    code: '47178'
  })

  await mongo.db.collection('bases_locales').insertOne({
    _id: _idBalC,
    token: 'coucou'
  })
  await mongo.db.collection('communes').insertOne({
    _bal: _idBalC,
    code: '48678'
  })

  const basesLocales = await BaseLocale.fetchByCommunes(['47192', '47178', '47098'])

  t.deepEqual(basesLocales.map(({_id}) => _id), [_idBalA, _idBalB])
})

test('find Bases Locales by codes communes / no BAL found', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    token: 'coucou'
  })

  const basesLocales = await BaseLocale.fetchByCommunes(['77123'])

  t.is(basesLocales.length, 0)
})

test('Get all assigned parcelles', async t => {
  const _id = new mongo.ObjectID()
  await mongo.db.collection('bases_locales').insertOne({
    _id,
    token: 'coucou',
    communes: ['54084']
  })

  await mongo.db.collection('numeros').insertOne({_bal: _id, numero: 1, commune: '54084', parcelles: ['12345000AA0002']})
  await mongo.db.collection('numeros').insertOne({_bal: _id, numero: 2, commune: '54084', parcelles: ['12345000AA0001', '12345000AA0003']})
  await mongo.db.collection('numeros').insertOne({_bal: _id, numero: 3, commune: '54084'})
  await mongo.db.collection('toponymes').insertOne({_bal: _id, commune: '54084'})
  await mongo.db.collection('toponymes').insertOne({_bal: _id, commune: '54084', parcelles: ['12345000AA0003']})
  await mongo.db.collection('toponymes').insertOne({_bal: _id, commune: '54084', parcelles: ['12345000AA0004', '12345000AA0001']})

  const parcelles = await getAssignedParcelles(_id.toString(), '54084')

  t.is(parcelles.length, 4);
  ['12345000AA0001', '12345000AA0002', '12345000AA0003', '12345000AA0004'].forEach(p => {
    t.true(parcelles.includes(p))
  })
})
