/* eslint camelcase: off */
const test = require('ava')
const {roundCoordinate, formatCleInterop, createRow, exportAsCsv} = require('../csv-bal')
const {ObjectID} = require('../../util/mongo')

test('roundCoordinate', t => {
  t.is(roundCoordinate(1.11111111111111, 0), 1)
  t.is(roundCoordinate(1.11111111111111, 5), 1.11111)
  t.is(roundCoordinate(1.999999, 2), 2)
})

test('formatCleInterop', t => {
  t.is(formatCleInterop('12345', 'A100', 12), '12345_a100_00012')
  t.is(formatCleInterop('1a345', 'A100', 12), '1a345_a100_00012')
  t.is(formatCleInterop('1a345', 'A100', 12, 'bis'), '1a345_a100_00012_bis')
})

test('createRow', t => {
  t.deepEqual(createRow({
    codeCommune: '54084',
    codeVoie: 'XXXX',
    nomVoie: 'rue des peupliers',
    numero: 12,
    suffixe: 'bis',
    _updated: new Date('2019-01-01'),
    position: {
      source: 'Mairie',
      type: 'entrée',
      point: {
        type: 'Point',
        coordinates: [5.835188, 49.326038]
      }
    }
  }), {
    cle_interop: '54084_xxxx_00012_bis',
    uid_adresse: '',
    voie_nom: 'rue des peupliers',
    numero: '12',
    suffixe: 'bis',
    commune_insee: '54084',
    commune_nom: 'Mont-Bonvillers',
    position: 'entrée',
    long: '5.835188',
    lat: '49.326038',
    x: '906109.41',
    y: '6917751.73',
    source: 'Mairie',
    date_der_maj: '2019-01-01'
  })
})

test('exportAsCsv', async t => {
  const voie1 = {
    _id: new ObjectID(),
    commune: '54084',
    nom: 'allée des acacias',
    code: '6789',
    _updated: new Date('2019-01-01'),
    positions: [{
      type: 'segment',
      source: 'Mairie',
      point: {
        type: 'Point',
        coordinates: [5.834072, 49.324156]
      }
    }]
  }
  const voie2 = {
    _id: new ObjectID(),
    commune: '54084',
    nom: 'rue des aulnes',
    code: 'A100',
    _updated: new Date('2019-01-05'),
    positions: []
  }

  const numeros = [
    {
      voie: voie1._id,
      commune: '54084',
      numero: 1,
      suffixe: 'bis',
      positions: [],
      _updated: new Date('2019-02-01')
    },
    {
      voie: voie1._id,
      commune: '54084',
      numero: 6,
      positions: [{
        type: 'entrée',
        source: 'Mairie',
        point: {
          type: 'Point',
          coordinates: [5.83315, 49.324433]
        }
      }],
      _updated: new Date('2019-02-05')
    }
  ]

  const csv = await exportAsCsv({voies: [voie1, voie2], numeros})
  const expected = `cle_interop;uid_adresse;voie_nom;numero;suffixe;commune_insee;commune_nom;position;long;lat;x;y;source;date_der_maj
54084_6789_00001_bis;;allée des acacias;1;bis;54084;Mont-Bonvillers;;;;;;;2019-02-01
54084_6789_00006;;allée des acacias;6;;54084;Mont-Bonvillers;entrée;5.83315;49.324433;905967.72;6917567.98;Mairie;2019-02-05
54084_6789_99999;;allée des acacias;99999;;54084;Mont-Bonvillers;segment;5.834072;49.324156;906035.82;6917539.59;Mairie;2019-01-01
54084_a100_99999;;rue des aulnes;99999;;54084;Mont-Bonvillers;;;;;;;2019-01-05`.replace(/\n/g, '\r\n') + '\r\n'
  t.is(csv, expected)
})
