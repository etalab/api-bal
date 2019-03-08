# API Bases Adresse Locales [![CircleCI](https://circleci.com/gh/etalab/api-bal/tree/master.svg?style=svg)](https://circleci.com/gh/etalab/api-bal/tree/master)



API permettant la gestion de bases d’adresses à l’échelon local

[![npm version](https://badgen.net/npm/v/@etalab/api-bal)](https://www.npmjs.com/package/@etalab/api-bal)
[![dependencies Status](https://david-dm.org/etalab/api-bal/status.svg)](https://david-dm.org/etalab/api-bal)
[![codecov](https://badgen.net/codecov/c/github/etalab/api-bal)](https://codecov.io/gh/etalab/api-bal)
[![XO code style](https://badgen.net/badge/code%20style/XO/cyan)](https://github.com/xojs/xo)

## Pré-requis

- [Node.js](https://nodejs.org) 10+
- [yarn](https://www.yarnpkg.com)
- [MongoDB](https://www.mongodb.com) 4+

## Utilisation

### Installation

```
yarn
```

### Démarrer le service

```
yarn start
```

### Lancer les tests

```
yarn test
```

## Configuration

Cette application utilise des variables d'environnement pour sa configuration.
Elles peuvent être définies classiquement ou en créant un fichier `.env` sur la base du modèle `.env.sample`.

| Nom de la variable | Description |
| --- | --- |
| `MONGODB_URL` | Paramètre de connexion à MongoDB |
| `MONGODB_DBNAME` | Nom de la base de données à utiliser |
| `PORT` | Port à utiliser pour l'API |

Toutes ces variables ont des valeurs par défaut que vous trouverez dans le fichier `.env.sample`.

## Licence

MIT
