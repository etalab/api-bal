const express = require('express')
const bodyParser = require('body-parser')
const w = require('../util/w')
const BaseLocale = require('../models/base-locale')
const Voie = require('../models/voie')
const Numero = require('../models/numero')
const Toponyme = require('../models/toponyme')
const {ValidationError} = require('../util/payload')
const stats = require('./stats')

const app = new express.Router()

app.use(express.json())

function ensureIsAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.sendStatus(403)
  }

  next()
}

function checkIsAdmin(baseLocale, req) {
  return req.get('Authorization') === `Token ${baseLocale.token}`
}

app.param('baseLocaleId', w(async (req, res, next) => {
  const id = req.params.baseLocaleId
  const baseLocale = await BaseLocale.fetchOne(id)
  if (!baseLocale) {
    return res.sendStatus(404)
  }

  req.baseLocale = baseLocale
  req.isAdmin = checkIsAdmin(baseLocale, req)
  next()
}))

app.param('voieId', w(async (req, res, next) => {
  const id = req.params.voieId
  const voie = await Voie.fetchOne(id)
  if (!voie) {
    return res.sendStatus(404)
  }

  const baseLocale = await BaseLocale.fetchOne(voie._bal)

  req.voie = voie
  req.isAdmin = checkIsAdmin(baseLocale, req)
  next()
}))

app.param('numeroId', w(async (req, res, next) => {
  const id = req.params.numeroId
  const numero = await Numero.fetchOne(id)
  if (!numero) {
    return res.sendStatus(404)
  }

  const baseLocale = await BaseLocale.fetchOne(numero._bal)

  req.numero = numero
  req.isAdmin = checkIsAdmin(baseLocale, req)
  next()
}))

app.param('toponymeId', w(async (req, res, next) => {
  const id = req.params.toponymeId
  const toponyme = await Toponyme.fetchOne(id)
  if (!toponyme) {
    return res.sendStatus(404)
  }

  const baseLocale = await BaseLocale.fetchOne(toponyme._bal)

  req.toponyme = toponyme
  req.isAdmin = checkIsAdmin(baseLocale, req)
  next()
}))

app.route('/bases-locales')
  .get(w(async (req, res) => {
    const basesLocales = await BaseLocale.fetchAll()
    const basesLocalesExpanded = await Promise.all(basesLocales.map(bal => BaseLocale.expandModel(bal)))

    res.send(basesLocalesExpanded.map(bal => BaseLocale.filterSensitiveFields(bal)))
  }))
  .post(w(async (req, res) => {
    const baseLocale = await BaseLocale.create(req.body)
    res.status(201).send(baseLocale)
  }))

app.route('/bases-locales/create-demo')
  .post(w(async (req, res) => {
    const baseLocale = await BaseLocale.createDemo(req.body)
    res.status(201).send(baseLocale)
  }))

app.route('/bases-locales/:baseLocaleId')
  .get(w(async (req, res) => {
    const baseLocaleExpanded = await BaseLocale.expandModel(req.baseLocale)

    if (req.isAdmin) {
      res.send(baseLocaleExpanded)
    } else {
      res.send(BaseLocale.filterSensitiveFields(baseLocaleExpanded))
    }
  }))
  .put(ensureIsAdmin, w(async (req, res) => {
    if (req.baseLocale.status === 'demo') {
      return res.status(403).send({code: 403, message: 'Une Base Adresse Locale de démonstration ne peut pas être modifiée. Elle doit d’abord être transformée en brouillon.'})
    }

    const baseLocale = await BaseLocale.update(req.baseLocale._id, req.body)
    res.send(baseLocale)
  }))
  .delete(ensureIsAdmin, w(async (req, res) => {
    await BaseLocale.remove(req.baseLocale._id)
    res.sendStatus(204)
  }))

app.route('/bases-locales/:baseLocaleId/transform-to-draft')
  .post(ensureIsAdmin, w(async (req, res) => {
    const baseLocaleExpanded = await BaseLocale.expandModel(req.baseLocale)

    if (baseLocaleExpanded.status !== 'demo') {
      return res.status(403).send({
        code: 403,
        message: 'La Base Adresse Locale n’est pas une Base Adresse Locale de démonstration'
      })
    }

    const baseLocale = await BaseLocale.transformToDraft(baseLocaleExpanded, req.body)
    res.send(baseLocale)
  }))

app.route('/bases-locales/:baseLocaleId/upload')
  .post(ensureIsAdmin, bodyParser.raw({limit: '50mb', type: 'text/csv'}), w(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).send({code: 400, message: 'CSV file required'})
    }

    const result = await BaseLocale.importFile(req.baseLocale._id, req.body)
    res.send(result)
  }))

app.route('/bases-locales/recovery')
  .post(w(async (req, res) => {
    await BaseLocale.basesLocalesRecovery(req.body.email)
    res.sendStatus(200)
  }))

app.route('/bases-locales/:baseLocaleId/csv')
  .get(w(async (req, res) => {
    const csvFile = await BaseLocale.exportAsCsv(req.baseLocale._id)
    res.attachment('bal.csv').type('csv').send(csvFile)
  }))

app.route('/bases-locales/:baseLocaleId/communes/:codeCommune')
  .put(ensureIsAdmin, w(async (req, res) => {
    const baseLocale = await BaseLocale.addCommune(req.baseLocale._id, req.params.codeCommune)
    const baseLocaleExpanded = await BaseLocale.expandModel(baseLocale)
    res.send(baseLocaleExpanded)
  }))
  .delete(ensureIsAdmin, w(async (req, res) => {
    const baseLocale = await BaseLocale.removeCommune(req.baseLocale._id, req.params.codeCommune)
    const baseLocaleExpanded = await BaseLocale.expandModel(baseLocale)
    res.send(baseLocaleExpanded)
  }))

app.route('/bases-locales/:baseLocaleId/communes/:codeCommune/geojson')
  .get(w(async (req, res) => {
    const geojsonStream = await BaseLocale.streamToGeoJSON(req.baseLocale._id, req.params.codeCommune)
    res.type('json')
    geojsonStream.pipe(res)
  }))

app.route('/bases-locales/:baseLocaleId/communes/:codeCommune/populate')
  .post(ensureIsAdmin, w(async (req, res) => {
    const baseLocale = await BaseLocale.populateCommune(req.baseLocale._id, req.params.codeCommune)
    res.send(baseLocale)
  }))

app.post('/bases-locales/:baseLocaleId/token/renew', ensureIsAdmin, w(async (req, res) => {
  const baseLocale = await BaseLocale.renewToken(req.baseLocale._id)
  res.send(baseLocale)
}))

app.route('/bases-locales/:baseLocaleId/communes/:codeCommune/voies')
  .post(ensureIsAdmin, w(async (req, res) => {
    const {codeCommune} = req.params
    if (!req.baseLocale.communes.includes(codeCommune)) {
      return res.status(400).send({code: 400, message: 'Cette commune n’a pas encore été ajoutée à la base.'})
    }

    const voie = await Voie.create(req.baseLocale._id, codeCommune, req.body)
    res.status(201).send(voie)
  }))
  .get(w(async (req, res) => {
    const voies = await Voie.fetchAll(req.baseLocale._id, req.params.codeCommune)
    res.send(voies)
  }))

app.route('/bases-locales/:baseLocaleId/communes/:codeCommune/toponymes')
  .post(ensureIsAdmin, w(async (req, res) => {
    const {codeCommune} = req.params
    if (!req.baseLocale.communes.includes(codeCommune)) {
      return res.status(400).send({code: 400, message: 'Cette commune n’a pas encore été ajoutée à la base.'})
    }

    const toponyme = await Toponyme.create(req.baseLocale._id, codeCommune, req.body)
    res.status(201).send(toponyme)
  }))
  .get(w(async (req, res) => {
    const toponymes = await Toponyme.fetchAll(req.baseLocale._id, req.params.codeCommune)
    res.send(toponymes)
  }))

app.route('/bases-locales/:baseLocaleId/communes/:codeCommune/parcelles')
  .get(w(async (req, res) => {
    const parcelles = await BaseLocale.getAssignedParcelles(req.params.baseLocaleId, req.params.codeCommune)
    res.send(parcelles)
  }))

app.route('/voies/:voieId')
  .get(w(async (req, res) => {
    res.send(req.voie)
  }))
  .put(ensureIsAdmin, w(async (req, res) => {
    const voie = await Voie.update(req.voie._id, req.body)
    res.send(voie)
  }))
  .delete(ensureIsAdmin, w(async (req, res) => {
    await Voie.remove(req.voie._id)
    res.sendStatus(204)
  }))

app.route('/voies/:voieId/numeros')
  .post(ensureIsAdmin, w(async (req, res) => {
    const numero = await Numero.create(req.voie._id, req.body)
    res.status(201).send(Numero.expandModel(numero))
  }))
  .get(w(async (req, res) => {
    const numeros = await Numero.fetchAll(req.voie._id)
    res.send(numeros.map(n => Numero.expandModel(n)))
  }))

app.route('/numeros/:numeroId')
  .get(w(async (req, res) => {
    res.send(Numero.expandModel(req.numero))
  }))
  .put(ensureIsAdmin, w(async (req, res) => {
    const numero = await Numero.update(req.numero._id, req.body)
    res.send(Numero.expandModel(numero))
  }))
  .delete(ensureIsAdmin, w(async (req, res) => {
    await Numero.remove(req.numero._id)
    res.sendStatus(204)
  }))

app.route('/toponymes/:toponymeId')
  .get(w(async (req, res) => {
    res.send(req.toponyme)
  }))
  .put(ensureIsAdmin, w(async (req, res) => {
    const toponyme = await Toponyme.update(req.toponyme._id, req.body)
    res.send(toponyme)
  }))
  .delete(ensureIsAdmin, w(async (req, res) => {
    await Toponyme.remove(req.toponyme._id)
    res.sendStatus(204)
  }))

app.route('/toponymes/:toponymeId/numeros')
  .get(w(async (req, res) => {
    const numeros = await Numero.fetchByToponyme(req.toponyme._id)
    res.send(numeros.map(n => Numero.expandModel(n)))
  }))

app.use('/stats', stats)

app.use((err, req, res, next) => {
  if (err) {
    if (err instanceof ValidationError) {
      const {message, validation} = err
      res.status(400).send({code: 400, message, validation})
    } else {
      res.status(500).send({code: 500, message: err.message})
      console.error(err)
    }
  }

  next()
})

module.exports = app
