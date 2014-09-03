
// modules
var fleck = require('fleck');
var Query = require('merlin-query').Query;
var Delta = require('merlin-delta').Delta;
var clone = require('clone');
var extend = require('extend');
var guard = require('type-guard');
var es = require('event-stream');
var objPath = require('object-path');

// libs
var ModelStream = require('./model-stream');
var CountStream = require('./count-stream');
var PopulateStream = require('./populate-stream');
var HookHub = require('./hook-hub');

// namespace object
var staticModelPrototype = {};

//////////////////////////
// Hook related methods //
//////////////////////////

/**
 * Attach each of the hook handler methods to
 * the static model.
 */
HookHub.call(staticModelPrototype);
for (var methodName in HookHub.prototype) {
  staticModelPrototype[methodName] = HookHub.prototype[methodName];
}

////////////////////////////
// Driver related methods //
////////////////////////////

/**
 * Indexes a field path of a model.
 * @alias  Model.index
 * @param  {String}        fieldPath Model path to the field to be indexed.
 * @param  {Object}        [opts]    Indexing options.
 * @param  {ErrorCallback} [cb]      Callback executed on completion.
 */
staticModelPrototype.index = function(fieldPath, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('fieldPath', fieldPath, 'string');
  guard('opts', opts, 'object');

  // index
  self.triggerHook('index', fieldPath, opts);
  self.merlin._driver.index(
    self.collectionName,
    opts,
    fieldPath,
    function(err) {
      if (cb) {
        if (err) { return cb(err); }
        cb(null);
      }
    }
  );
};

/**
 * Counts the number of records matching the given query.
 * @alias  Model.count
 * @param  {Object}        query  Merlin query object.
 * @param  {Object}        [opts] Query options.
 * @param  {CountCallback} [cb]   Callback executed on completion.
 * @return {CountStream}          Count stream.
 */
staticModelPrototype.count = function(query, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};
  query = query || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('query', query, 'object');
  guard('opts', opts, 'object');

  // create the query
  self.triggerHook('query', query);
  query = new Query(query);

  // before hook
  self.triggerHook('beforeCount', query, opts);

  // run count
  var cout = self.merlin._driver.count(self.collectionName, opts, query);

  // after hook
  cout = cout.pipe(es.mapSync(function(count) {
    self.triggerHook('afterCount', count, opts);
    return count;
  }));

  // convert stream to count stream
  cout = cout.pipe(new CountStream());

  if (cb) { cout.count(cb); }
  return cout;
};

/**
 * Finds all records matching the given query.
 * @alias  Model.find
 * @param  {Object}           query  Merlin query object.
 * @param  {Object}           [opts] Query options.
 * @param  {ModelSetCallback} [cb]   Callback executed on completion.
 * @return {ModelStream}             Model stream.
 */
staticModelPrototype.find = function(query, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('query', query, 'object');
  guard('opts', opts, 'object');

  // create the opts
  var subQueries = self._depopulate(query);
  query = new Query(query);

  // before find hook
  var rout = es.through();
  var rin = rout;
  self.triggerHook('beforeFind', query, opts, function(err) {
    if (err) { return rin.emit('error', err); }

    // find the records
    self.merlin._driver.find(self.collectionName, opts, query).pipe(rin);
  });

  // after find hook
  rout = rout.pipe(es.map(function(record, cb) {
    self.triggerHook('afterFind', record, opts, function(err) {
      if (err) { return cb(err); }
      cb(null, record);
    });
  }));

  // TODO: populate sub models without populate stream
  if (subQueries && self.merlin.opts.autoPopulateByQuery) {
    // rout = rout.pipe(es.map(function(record, cb) {
    //   cb(record);
    // }));
    rout = rout.pipe(
      new PopulateStream(self, query, { rawMode: opts.rawMode })
    );
  }

  // convert to a model stream
  rout = rout.pipe(new ModelStream(self, { rawMode: opts.rawMode }));

  // callback and return
  if (cb) { rout.all(cb); }
  return rout;
};

staticModelPrototype.all = function(opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('opts', opts, 'object');

  // find the record
  var rout = self.find({}, opts);

  // callback and return
  if (cb) { rout.all(cb); }
  return rout;
};

/**
 * Finds the first record matching the given query.
 * @alias  Model.findOne
 * @param  {Object}        query  Merlin query object.
 * @param  {Object}        [opts] Query options.
 * @param  {ModelCallback} [cb]   Callback executed on completion.
 * @return {ModelStream}          Model stream.
 */
staticModelPrototype.findOne = function(query, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  query = query || {};
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('query', query, 'object');
  guard('opts', opts, 'object');

  // find the record
  query.$limit = 1;
  var rout = self.find(query, opts);

  // callback and return
  if (cb) { rout.first(cb); }
  return rout;
};

/**
 * Finds the record matching the given id.
 * @alias  Model.findById
 * @param  {String|Number} id     Record id.
 * @param  {Object}        [opts] Query options.
 * @param  {ModelCallback} [cb]   Callback executed on completion.
 * @return {ModelStream}          Model stream.
 */
staticModelPrototype.findById = function(id, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('id', id, [ 'string', 'number' ]);
  guard('opts', opts, 'object');

  // find the record
  var query = {};
  query[self.idKey()] = id;
  var rout = self.findOne(query, opts);

  // callback and return
  if (cb) { rout.first(cb); }
  return rout;
};

/**
 * Inserts all records given.
 * @alias  Model.insert
 * @param  {Array}            [records]   Array of records.
 * @param  {Object}           [opts]      Insertion options.
 * @param  {ModelSetCallback} [cb]        Callback executed on completion.
 * @return {ModelStream}      modelStream Model stream.
 */
staticModelPrototype.insert = function(records, opts, cb) {
  var self = this;

  // set defaults
  if (
    records !== null &&
    typeof records === 'object' &&
    typeof records.length !== 'number'
  ) { cb = opts; opts = records; records = null; }
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('records', records, [ 'array', 'undefined' ]);
  guard('opts', opts, 'object');

  // create record stream
  var rout = es.through();

  // convert an array to a stream
  if (records) {
    var rin = rout;
    process.nextTick(function() {
      es.readArray(records).pipe(rin);
    });
  }

  // TODO: create de-poplulated sub models
  rout = rout.pipe(es.mapSync(function(record) {
    self._depopulate(record);
    return record;
  }));

  // set defaults
  if (
    self.defaults &&
    typeof self.defaults === 'object'
  ) {
    rout = rout.pipe(es.mapSync(function(record) {
      for (var key in self.defaults) {
        if (record[key] === undefined) {
          if (typeof defaultRecord[key] === 'function') {
            record[key] = defaultRecord[key]();
          } else {
            record[key] = defaultRecord[key];
          }
        }
      }
      return record;
    }));
  }

  // validate the schema
  if (
    self.schema &&
    typeof self.schema === 'object' &&
    typeof self.schema.validate === 'function' &&
    !opts.skipSchemaValidation &&
    !self.merlin.opts.skipSchemaValidation
  ) {
    rout = rout.map(function(record, cb) {
      self.schema.validate(record, function(err) {
        if (err) { return cb(err); }
        cb(null, record);
      });
    });
  }

  // fire the before-insert event
  rout = rout.pipe(es.map(function(record, cb) {
    self.triggerHook('beforeInsert', record, opts, function(err) {
      if (err) { return cb(err); }
      cb(null, record);
    });
  }));

  // insert the records
  rout = rout.pipe(self.merlin._driver.insert(self.collectionName, opts));

  // first the after-insert event
  rout = rout.pipe(es.map(function(record, cb) {
    self.triggerHook('afterInsert', record, opts, function(err) {
      if (err) { return cb(err); }
      cb(null, record);
    });
  }));

  // TODO: poplulate sub models

  // convert to model stream
  rout = rout.pipe(new ModelStream(self, { rawMode: opts.rawMode }));

  // callback and return
  if (cb) { rout.all(cb); }
  return rout;
};

/**
 * Inserts the record given.
 * @alias  Model.create
 * @param  {Object}        record record.
 * @param  {Object}        [opts] Insertion options.
 * @param  {ModelCallback} [cb]   Callback executed on completion.
 * @return {ModelStream}          Model stream.
 */
staticModelPrototype.create = function(record, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('record', record, 'object');
  guard('opts', opts, 'object');

  // create the record
  var rout = self.insert([ record ], opts);

  // callback and return
  if (cb) { rout.first(cb); }
  return rout;
};

/**
 * Updates all records matching the given query with the given delta.
 * @alias  Model.update
 * @param  {Object}           query  Merlin query object.
 * @param  {Object}           delta  Merlin delta object.
 * @param  {Object}           [opts] Query options.
 * @param  {ModelSetCallback} [cb]   Callback executed on completion.
 * @return {CountStream}             Count stream.
 */
staticModelPrototype.update = function(query, delta, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('query', query, 'object');
  guard('delta', delta, 'object');
  guard('opts', opts, 'object');
  if (self._depopulate(query)) {
    throw new Error('query cannot contain sub queries when used with update');
  }

  // create the count stream
  var cout = new CountStream();

  // create the query and delta
  query = new Query(query);
  delta = new Delta(delta);

  // before find hook
  var cin = cout;
  self.triggerHook('beforeUpdate', query, delta, opts, function(err) {
    if (err) { return cout.emit('error', err); }

    // validate the delta then update
    if (
      self.schema &&
      !opts.skipSchemaValidation &&
      !self.merlin.opts.skipSchemaValidation
    ) {
      var patchObj = delta.patch({});
      self.schema.validate(patchObj, function(err) {
        if (err) { return cin.emit('error', err); }
        self.merlin._driver.update(
          self.collectionName,
          opts,
          query,
          delta
        ).pipe(cin);
      });
    } else {
      self.merlin._driver.update(
        self.collectionName,
        opts,
        query,
        delta
      ).pipe(cin);
    }
  });

  cout = cout.pipe(es.mapSync(function(count) {
    self.triggerHook('afterUpdate', count, opts);
    return count;
  }));

  cout = cout.pipe(new CountStream());

  // callback and return
  if (cb) { cout.count(cb); }
  return cout;
};

/**
 * Updates the first record matching the given query with the given delta.
 * @alias  Model.updateOne
 * @param  {Object}        query     Merlin query object.
 * @param  {Object}        [opts]    Query options.
 * @param  {ModelCallback} [cb]      Callback executed on completion.
 * @return {CountStream}             Count stream.
 */
staticModelPrototype.updateOne = function(query, delta, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};
  var _cb = cb || function(err) { if (err) { throw err; } };

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('query', query, 'object');
  guard('delta', delta, 'object');
  guard('opts', opts, 'object');
  if (self._depopulate(query)) {
    throw new Error('query cannot contain sub queries when used with update');
  }

  // update the record
  query.$limit = 1;
  var cout = self.update(query, delta, opts);

  // callback and return
  if (cb) { cout.count(cb); }
  return cout;
};

/**
 * Updates the record matching the given id with the given delta.
 * @alias  Model.updateById
 * @param  {String|Number} id          Record id.
 * @param  {Object}        [opts]      Query options.
 * @param  {ModelCallback} [cb]        Callback executed on completion.
 * @return {ModelStream}   modelStream Model stream.
 */
staticModelPrototype.updateById = function(id, delta, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};
  var _cb = cb || function(err) { if (err) { throw err; } };

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('id', id, [ 'number', 'string' ]);
  guard('delta', delta, 'object');
  guard('opts', opts, 'object');

  // update the record
  var query = {};
  query[self.idKey()] = id;
  var cout = self.updateOne(query, delta, opts);

  // callback and return
  if (cb) { cout.count(cb); }
  return cout;
};

/**
 * Removes all records matching the given query.
 * @alias  Model.remove
 * @param  {Object}           query       Merlin query object.
 * @param  {Object}           [opts]      Query options.
 * @param  {ModelSetCallback} [cb]        Callback executed on completion.
 * @return {ModelStream}      modelStream Model stream.
 */
staticModelPrototype.remove = function(query, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};
  var _cb = cb || function(err) { if (err) { throw err; } };

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('query', query, 'object');
  guard('opts', opts, 'object');
  if (self._depopulate(query)) {
    throw new Error('query cannot contain sub queries when used with update');
  }

  // create the query
  self.triggerHook('query', query);
  query = new Query(query);

  // before remove hook
  self.triggerHook('beforeRemove', query, opts);

  // remove the records
  var cout = self.merlin._driver.remove(self.collectionName, opts, query);

  // after remove hook
  cout = cout.pipe(es.mapSync(function(count) {
    self.triggerHook('afterRemove', count, opts);
    return count;
  }));

  cout = cout.pipe(new CountStream());

  // callback and return
  if (cb) { cout.count(cb); }
  return cout;
};

/**
 * Removes the first record matching the given query.
 * @alias  Model.removeOne
 * @param  {Object}        query       Merlin query object.
 * @param  {Object}        [opts]      Query options.
 * @param  {ModelCallback} [cb]        Callback executed on completion.
 * @return {ModelStream}   modelStream Model stream.
 */
staticModelPrototype.removeOne = function(query, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('query', query, 'object');
  guard('opts', opts, 'object');
  if (self._depopulate(query)) {
    throw new Error('query cannot contain sub queries when used with update');
  }

  // remove and return
  query.$limit = 1;
  var cout = self.remove(query, opts);
  if (cb) { cout.count(cb); }
  return cout;
};

/**
 * Removes the record matching the given id.
 * @alias  Model.removeById
 * @param  {String|Number} id          Record id.
 * @param  {Object}        [opts]      Query options.
 * @param  {ModelCallback} [cb]        Callback executed on completion.
 * @return {ModelStream}   modelStream Model stream.
 */
staticModelPrototype.removeById = function(id, opts, cb) {
  var self = this;

  // set defaults
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);
  guard('id', id, [ 'number', 'string' ]);
  guard('opts', opts, 'object');

  // remove and return
  var query = {};
  query[self.idKey()] = id;
  var cout = self.removeOne(query, opts);
  if (cb) { cout.count(cb); }
  return cout;
};


//////////////////////////////
// Relation Related Methods //
//////////////////////////////

/**
 * Create/Modify has one relation.
 * @param  {String}  modelName Foreign model name.
 * @param  {Object}  opts      Relation opts.
 */
staticModelPrototype.hasOne = function(modelName, opts) {
  var self = this;
  opts = opts || {};
  guard('modelName', modelName, 'string');
  guard('opts', opts, [ 'object', 'string' ]);
  return self._createRelation('oneToOne', modelName, opts);
};

/**
 * Create/Modify has many relation.
 * @param  {String}  modelName Foreign model name.
 * @param  {Object}  opts      Relation opts.
 */
staticModelPrototype.hasMany = function(modelName, opts) {
  var self = this;
  opts = opts || {};
  guard('modelName', modelName, 'string');
  guard('opts', opts, [ 'object', 'string' ]);
  return self._createRelation('oneToMany', modelName, opts);
};

/**
 * Create/Modify many have one reference.
 * @param  {String}  modelName Foreign model name.
 * @param  {Object}  opts      Relation opts.
 */
staticModelPrototype.manyHaveOne = function(modelName, opts) {
  var self = this;
  opts = opts || {};
  guard('modelName', modelName, 'string');
  guard('opts', opts, [ 'object', 'string' ]);
  return self._createRelation('manyToOne', modelName, opts);
};

/**
 * Create/Modify belongs to one reference.
 * @param  {String}  modelName Foreign model name.
 * @param  {Object}  opts      Relation opts.
 */
staticModelPrototype.belongsToOne = function(modelName, opts) {
  var self = this;
  opts = opts || {};
  guard('modelName', modelName, 'string');
  guard('opts', opts, [ 'object', 'string' ]);
  return self._createReference('oneToOne', modelName, opts);
};

/**
 * Create/Modify belongs to one reference.
 * @param  {String}  modelName Foreign model name.
 * @param  {Object}  opts      Relation opts.
 */
staticModelPrototype.belongsToMany = function(modelName, opts) {
  var self = this;
  opts = opts || {};
  guard('modelName', modelName, 'string');
  guard('opts', opts, [ 'object', 'string' ]);
  return self._createReference('oneToMany', modelName, opts);
};

/**
 * Create/Modify belongs to one reference.
 * @param  {String}  modelName Foreign model name.
 * @param  {Object}  opts      Relation opts.
 */
staticModelPrototype.manyBelongToOne = function(modelName, opts) {
  var self = this;
  opts = opts || {};
  guard('modelName', modelName, 'string');
  guard('opts', opts, [ 'object', 'string' ]);
  return self._createReference('manyToOne', modelName, opts);
};

staticModelPrototype.idKey = function() {
  var self = this;

  return self.merlin.opts.idKey;
};

staticModelPrototype.singularForeignKey = function(modelName) {
  var self = this;

  if (!modelName) {
    modelName = self.modelName.charAt(0).toLowerCase() +
      self.modelName.substr(1);
  }
  var singularForeignKey = self.merlin.opts.singularForeignKey;
  return singularForeignKey.replace('{modelName}', modelName);
};

staticModelPrototype.pluralForeignKey = function(modelName) {
  var self = this;

  if (!modelName) {
    modelName = self.modelName.charAt(0).toLowerCase() +
      self.modelName.substr(1);
  }
  var pluralForeignKey = self.merlin.opts.pluralForeignKey;
  return pluralForeignKey.replace('{modelName}', modelName);
};

/**
 * Create the relation.
 * @private
 * @param  {String}  modelName Foreign model name.
 * @param  {Object}  opts      Relation opts.
 */
staticModelPrototype._createRelation = function(type, modelName, opts) {
  var self = this;

  // defaults
  if (typeof opts === 'string') { opts = { path: opts }; }
  opts.type = type;
  opts.modelName = modelName;

  // get the foreign model.
  var ForeignModel = self.merlin.models[modelName];
  if (!ForeignModel) {
    throw new Error(modelName + ' is not a registered model');
  }

  // get the field name if needed.
  if (!opts.fieldPath || !opts.keyPath) {
    var fieldName = modelName.charAt(0).toLowerCase() + modelName.substr(1);

    // get the key and field paths
    switch (opts.type) {
      case 'manyToOne':
      case 'oneToOne':
        if (!opts.fieldPath) { opts.fieldPath = opts.path || fieldName; }
        if (!opts.keyPath) {
          opts.keyPath = self.singularForeignKey(opts.path || fieldName);
        }
        break;
      case 'oneToMany':
        if (!opts.fieldPath) {
          opts.fieldPath = opts.path || fleck.pluralize(fieldName);
        }
        if (!opts.keyPath) {
          opts.keyPath = self.pluralForeignKey(
            opts.path && fleck.singularize(opts.path) || fieldName
          );
        }
        break;
    }
  }

  // get the field name if needed.
  var foreignName = self.modelName;
  var foreignFieldName = foreignName.charAt(0).toLowerCase() +
    foreignName.substr(1);

  // get the foreign key path
  switch (opts.type) {
    case 'manyToOne':
      opts.foreignFieldPath = fleck.pluralize(foreignFieldName);
      break;
    case 'oneToMany':
    case 'oneToOne':
      opts.foreignFieldPath = foreignFieldName;
      break;
  }

  // delete path if given
  if (opts.path) { delete opts.path; }

  // save the relationship
  self.relations[opts.keyPath] = self.relations[opts.keyPath] || {};
  for (var property in opts) {
    self.relations[opts.keyPath][property] = opts[property];
  }

  // save the reference
  ForeignModel.references[self.modelName] =
    ForeignModel.references[self.modelName] || {};
  ForeignModel.references[self.modelName][opts.keyPath] =
    ForeignModel.references[self.modelName][opts.keyPath] || {};
  opts.modelName = self.modelName;
  for (var property in opts) {
    ForeignModel.references[self.modelName][opts.keyPath][property] =
      opts[property];
  }
};

/**
 * Create a reference to a foreign model.
 * @private
 * @param  {String} type      Reference type.
 * @param  {String} modelName Model name.
 * @param  {Object} opts      Reference opts.
 */
staticModelPrototype._createReference = function(type, modelName, opts) {
  var self = this;

  // defaults
  opts = opts || {};
  if (typeof opts === 'string') { opts = { path: opts }; }
  opts.type = type;
  opts.modelName = modelName;

  // get the foreign model.
  var ForeignModel = self.merlin.models[modelName];
  if (!ForeignModel) {
    throw new Error('modelName must be the name of a registered model');
  }

  // get the field name if needed.
  var fieldName = modelName.charAt(0).toLowerCase() + modelName.substr(1);

  // get the key and field paths
  switch (opts.type) {
    case 'oneToMany':
    case 'oneToOne':
      if (!opts.fieldPath) { opts.fieldPath = fieldName; }
      if (!opts.keyPath) { opts.keyPath = self.singularForeignKey(fieldName); }
      break;
    case 'manyToOne':
      if (!opts.fieldPath) { opts.fieldPath = fleck.pluralize(fieldName); }
      if (!opts.keyPath) { opts.keyPath = self.pluralForeignKey(fieldName); }
      break;
  }

  // get the field name if needed.
  if (opts.path) { opts.foreignFieldPath = opts.path; delete opts.path; }
  if (!opts.foreignFieldPath) {
    var foreignName = self.modelName;
    var foreignFieldName = foreignName.charAt(0).toLowerCase() +
      foreignName.substr(1);

    // get the foreign key path.
    switch (opts.type) {
      case 'oneToMany':
        opts.foreignFieldPath = fleck.pluralize(foreignFieldName);
        break;
      case 'oneToOne':
      case 'manyToOne':
        opts.foreignFieldPath = foreignFieldName;
        break;
    }
  }

  // save the relationship.
  if (!ForeignModel.relations[opts.keyPath]) {
    ForeignModel.relations[opts.keyPath] = {};
  }
  for (var property in opts) {
    ForeignModel.relations[opts.keyPath][property] = opts[property];
  }

  // save the reference
  if (!self.references[ForeignModel.modelName]) {
    self.references[ForeignModel.modelName] = {};
  }
  if (!self.references[ForeignModel.modelName][opts.keyPath]) {
    self.references[ForeignModel.modelName][opts.keyPath] = {};
  }
  opts.modelName = self.modelName;
  for (var property in opts) {
    self.references[ForeignModel.modelName][opts.keyPath][property] =
      opts[property];
  }
};

staticModelPrototype._getModel = function(modelName) {
  var self = this;
  return self.merlin.models[modelName] || null;
};

staticModelPrototype._getSubRecordPaths = function() {
  var self = this;
  var subRecordPaths = [];
  for (var keyPath in self.relations) {
    subRecordPaths.push(self.relations[keyPath].fieldPath);
  }
  for (var foreignModelName in self.references) {
    for (var keyPath in self.references[foreignModelName]) {
      subRecordPaths.push(
        self.references[foreignModelName][keyPath].foreignFieldPath
      );
    }
  }
  return subRecordPaths;
};

staticModelPrototype._depopulate = function(record) {
  var self = this;
  var paths = self._getSubRecordPaths();
  var depopulated = null;
  for (var i = 0; i < paths.length; i += 1) {
    var path = paths[i];
    var subRecord = objPath.get(record, path);
    if (subRecord === true) {
      subRecord = {};
    }
    if (subRecord !== null && typeof subRecord === 'object') {
      if (!depopulated) {
        depopulated = {};
      }
      depopulated[path] = subRecord;
    }
  }
  return depopulated;
};

staticModelPrototype._populate = function(record, subRecords) {
  var self = this;
  for (var path in subRecords) {
    var subRecord = subRecords[path];
    objPath.set(record, path, subRecord);
  }
  return record;
};


////////////////////////
// Model Augmentation //
////////////////////////

/**
 * Augments a model with static model methods.
 * @alias  augmentModel
 * @private
 * @param  {Merlin}   merlin          Merlin instance.
 * @param  {String}   modelName        Model name.
 * @param  {String}   collectionName   Collection name.
 * @param  {Function} Model            Model constructor.
 * @return {Function}                  Model constructor.
 */
exports = module.exports = function(merlin, modelName, collectionName, Model) {

  // validate args
  guard('merlin', merlin, 'object');
  guard('modelName', modelName, 'string');
  guard('collectionName', collectionName, 'string');
  guard('Model', Model, 'function');

  // call hookhub constructor on the model
  HookHub.call(Model);

  // setup the static model
  Model.modelName = modelName;
  Model.collectionName = collectionName;
  Model.merlin = merlin;
  Model.relations = {};
  Model.references = {};
  Model.schema = null;
  Model.defaults = null;

  // attach static model object as the prototype
  // of the model constructor.
  if (typeof Object.setPrototypeOf === 'function') {
    Object.setPrototypeOf(Model, staticModelPrototype);
  } else {
    Model.__proto__ = staticModelPrototype;
  }

  // return the model
  return Model;
};
exports.staticModelPrototype = staticModelPrototype;
