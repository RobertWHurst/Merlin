const MongoClient = require('mongodb').MongoClient;


class MongoDriver extends Driver {

  constructor() {
    this._db = null;
  }

  connect(url, opts, cb) {
    MongoClient.connect(url, opts, (err, db) => {
      if (err) { return cb(err); }
      this._db = db;
    });
  }

  disconnect(cb) {
    this._db.close(cb);
  }
}


module.exports = MongoDriver;
