const {MongoClient, ObjectID} = require('mongodb')

class Mongo {
  async connect(connectionString) {
    this.client = await MongoClient.connect(connectionString || process.env.MONGODB_URL || 'mongodb://localhost:27017', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    this.db = this.client.db(process.env.MONGODB_DBNAME || 'api-bal')
  }

  async ensureIndexes() {
    await this.db.collection('communes').createIndex({_bal: 1, code: 1}, {unique: true})

    await this.db.collection('voies').createIndex({_bal: 1})
    await this.db.collection('voies').createIndex({_bal: 1, commune: 1})

    await this.db.collection('toponymes').createIndex({_bal: 1})
    await this.db.collection('toponymes').createIndex({_bal: 1, commune: 1})

    await this.db.collection('numeros').createIndex({_bal: 1})
    await this.db.collection('numeros').createIndex({_bal: 1, commune: 1})
    await this.db.collection('numeros').createIndex({voie: 1})
    await this.db.collection('numeros').createIndex({toponyme: 1})
  }

  disconnect(force) {
    if (this.client && this.client.isConnected()) {
      return this.client.close(force)
    }
  }

  parseObjectID(string) {
    try {
      return new ObjectID(string)
    } catch {
      return null
    }
  }

  decorateCreation(obj) {
    const now = new Date()
    obj._created = now
    obj._updated = now
  }

  decorateModification(obj) {
    obj._updated = new Date()
  }

  async touchDocument(collectionName, id, date = new Date()) {
    await this.db.collection(collectionName).updateOne(
      {_id: this.parseObjectID(id)},
      {$set: {_updated: date}}
    )
  }
}

module.exports = new Mongo()
module.exports.ObjectID = ObjectID
