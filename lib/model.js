
// modules
var clone = require('clone');
var Schema = require('merlin-schema').Schema;
var Delta = require('merlin-delta').Delta;
var util = require('util');
var guard = require('type-guard');

// libs
var HookHub = require('./hook-hub');
var ModelSet = require('./model-set');
var CountStream = require('./count-stream');


/**
 * Callback executed upon insert, find, update, or remove completion.
 * @callback ModelSetCallback
 * @param {Error|Null} err        Error if any occurred.
 * @param {ModelSet}   [modelSet] ModelSet containing models of all the
 *                                records effected.
 */

/**
 * Callback executed upon create, findOne, findById, updateOne, updateById,
 * removeOne, or removeById completion.
 * @callback ModelCallback
 * @param {Error|Null} err     Error if any occurred.
 * @param {Model}      [model] Model of the record effected.
 */

/**
 * Model constructor.
 * @constructor Model
 * @param {Object} [record] record data.
 * @param {Object} [opts]   Model options.
 */
function Model(record, opts) {
  var self = this;
  HookHub.call(self);

  guard('opts', opts, [ 'object', 'undefined' ]);
  guard('record', record, [ 'object', 'undefined' ]);

  // set defaults
  opts = opts || {};
  record = record || null;
  opts.newModel = opts.newModel !== false;
  opts.catalystModel = opts.catalystModel === true;

  // validate args
  if (self.constructor == Model) {
    throw new Error('Model cannot be constructed directly');
  }
  if (!self.constructor.merlin) {
    throw new Error('Model must be registered with merlin');
  }

  // check for reserved properties
  if (record !== null) {
    for (var prop in record) {
      if (record.hasOwnProperty(prop) && Model.prototype[prop]) {
        throw new Error(prop + ' is a reserved property');
      }
    }
  }

  // setup the instance
  self.newModel = opts.newModel;
  self.catalystModel = opts.catalystModel;
  delete opts.newModel;
  delete opts.catalystModel;
  self.opts = opts;
  self.cache = null;
  self.status = 'init';
  self._reservedProperties = [];
  self._saveCallbacks = [];

  // if this is a catalyst model then return
  if (opts.catalystModel) { return; }

  // extract the sub model records.
  if (record !== null) {
    var subModelRecords = self._extractSubModelRecords(record);

    // set the cache and instance record
    self._setCache(record);
    self._setRecord(record);

    // create the sub models
    self._createSubModels(subModelRecords);
  }
}
util.inherits(Model, HookHub);

Model.prototype.index = function(fieldPath, opts) {
  var self = this;
  self.constructor.index(fieldPath, opts);
};

/**
 * Set the model schema (if not set previously).
 * @param  {Object}  rules Schema rules.
 * @param  {Boolean} force Force update the schema even if one has already
                           been set.
 * @return {Boolean}       True if the schema was updated, false if not.
 */
Model.prototype.setSchema = function(rules, force) {
  var self = this;
  if (self.constructor.schema === null || force) {
    self.constructor.schema = new Schema(rules);
    return true;
  }
  return false;
};

/**
 * Set the model schema (if not set previously).
 */
Model.prototype.hasOne = function() {
  var self = this;
  return self.constructor.hasOne.apply(self.constructor, arguments);
};

Model.prototype.hasMany = function() {
  var self = this;
  return self.constructor.hasMany.apply(self.constructor, arguments);
};

Model.prototype.manyHaveOne = function() {
  var self = this;
  return self.constructor.manyHaveOne.apply(self.constructor, arguments);
};

Model.prototype.belongsToOne = function() {
  var self = this;
  return self.constructor.belongsToOne.apply(self.constructor, arguments);
};

Model.prototype.belongsToMany = function() {
  var self = this;
  return self.constructor.belongsToMany.apply(self.constructor, arguments);
};

Model.prototype.manybelongToOne = function() {
  var self = this;
  return self.constructor.manybelongToOne.apply(self.constructor, arguments);
};

Model.prototype.setDefaults = function(defaults) {
  var self = this;
  guard('defaults', defaults, [ 'object', 'null' ]);
  return self.constructor.defaults = defaults;
};

/**
 * Clone the model.
 * @return {Model} Clone model instance.
 */
Model.prototype.clone = function() {
  var self = this;
  return new self.constructor(self._getRecord(true), self.opts);
};

/**
 * Count related records
 * @param  {String}      fieldPath Relation path
 * @param  {Object}      query     Query
 * @param  {Object}      [opts]    Count opts
 * @param  {Function}    [cb]      Executed upon completion
 * @return {CountStream}           Count stream
 */
Model.prototype.count = function(fieldPath, query, opts, cb) {
  var self = this;
  if (typeof opts == 'function') { cb = opts; opts = {}; }

  // validate args
  guard('fieldPath', fieldPath, 'string');
  guard('query', query, 'object');
  guard('opts', opts, [ 'object', 'undefined' ]);
  guard('cb', cb, [ 'function', 'undefined' ]);

  // set defaults
  opts = opts || {};

  var subModelType = self._getSubModelTypeByFieldPath(fieldPath);

  var SubModel = null;
  if (subModelType === 'relation') {
    SubModel = self._getSubModelRelationByFieldPath(fieldPath);
    query = self._scopeRelationQuery(query);
  }

  else if (subModelType === 'reference') {
    SubModel = self._getSubModelReferenceByFieldPath(fieldPath);
    query = self._scopeReferenceQuery(query);
  }

  if (!SubModel) {
    throw new Error('cannot find model associated with path ' + fieldPath);
  }

  return SubModel.count(query, opts, cb);
};

/**
 * Fetch related records
 * @param  {String}      fieldPath Relation path
 * @param  {Object}      query     Query
 * @param  {Object}      [opts]    Fetch opts
 * @param  {Function}    [cb]      Executed upon completion
 * @return {ModelStream}           Model stream
 */
Model.prototype.find = function(fieldPath, query, opts, cb) {
  var self = this;

  if (typeof opts == 'function') { cb = opts; opts = {}; }

  // validate args
  guard('fieldPath', fieldPath, 'string');
  guard('query', query, 'object');
  guard('opts', opts, [ 'object', 'undefined' ]);
  guard('cb', cb, [ 'function', 'undefined' ]);

  // set defaults
  opts = opts || {};

  var subModelType = self._getSubModelTypeByFieldPath(fieldPath);

  var SubModel = null;
  if (subModelType === 'relation') {
    SubModel = self._getSubModelRelationByFieldPath(fieldPath);
    query = self._scopeRelationQuery(query);
  }

  else if (subModelType === 'reference') {
    SubModel = self._getSubModelReferenceByFieldPath(fieldPath);
    query = self._scopeReferenceQuery(query);
  }

  if (!SubModel) {
    throw new Error('cannot find model associated with path ' + fieldPath);
  }

  return SubModel.find(query, opts, cb);
};

/**
 * Fetch the first related record
 * @param  {String}      fieldPath Relation path
 * @param  {Object}      query     Query
 * @param  {Object}      [opts]    Fetch opts
 * @param  {Function}    [cb]      Executed upon completion
 * @return {Model}                 Model
 */
Model.prototype.findOne = function(fieldPath, query, opts, cb) {
  var self = this;

  if (typeof opts == 'function') { cb = opts; opts = {}; }

  // validate args
  guard('fieldPath', fieldPath, 'string');
  guard('query', query, 'object');
  guard('opts', opts, [ 'object', 'undefined' ]);
  guard('cb', cb, [ 'function', 'undefined' ]);

  // set defaults
  opts = opts || {};

  // find the record
  query.$limit = 1;
  var rout = self.find(fieldPath, query, opts);

  // callback and return
  if (cb) { rout.first(cb); }
  return rout;
};

/**
 * Fetch a related record by id
 * @param  {String}      fieldPath Relation path
 * @param  {Object}      id        id
 * @param  {Object}      [opts]    Fetch opts
 * @param  {Function}    [cb]      Executed upon completion
 * @return {Model}                 Model
 */
Model.prototype.findById = function(fieldPath, id, opts, cb) {
  var self = this;

  if (typeof opts == 'function') { cb = opts; opts = {}; }

  // validate args
  guard('fieldPath', fieldPath, 'string');
  guard('id', id, [ 'string', 'number' ]);
  guard('opts', opts, [ 'object', 'undefined' ]);
  guard('cb', cb, [ 'function', 'undefined' ]);

  // set defaults
  opts = opts || {};

  // find the record
  var query = {};
  query[self.constructor.idKey()] = id;
  var rout = self.findOne(fieldPath, query, opts);

  // callback and return
  if (cb) { rout.first(cb); }
  return rout;
};

/**
 * Insert related records
 * @param  {String}      fieldPath Relation path
 * @param  {Object}      records   An array of records
 * @param  {Object}      [opts]    Insert opts
 * @param  {Function}    [cb]      Executed upon completion
 * @return {ModelStream}           Model stream
 */
// Model.prototype.insert = function(fieldPath, records, opts, cb) {
//   var self = this;

//   if (typeof opts == 'function') { cb = opts; opts = {}; }

//   // validate args
//   guard('fieldPath', fieldPath, 'string');
//   guard('records', records, [ 'array', 'undefined' ]);
//   guard('opts', opts, [ 'object', 'undefined' ]);
//   guard('cb', cb, [ 'function', 'undefined' ]);

//   // set defaults
//   opts = opts || {};

//   var subModelType = self._getSubModelTypeByFieldPath(fieldPath);

//   var SubModel = null;
//   if (subModelType === 'relation') {
//     SubModel = self._getSubModelRelationByFieldPath(fieldPath);
//     query = self._scopeRelationQuery(query);
//   }

//   else if (subModelType === 'reference') {
//     SubModel = self._getSubModelReferenceByFieldPath(fieldPath);
//     query = self._scopeReferenceQuery(query);
//   }

//   if (!SubModel) {
//     throw new Error('cannot find model associated with path ' + fieldPath);
//   }

//   return SubModel.insert(records, opts, cb);
// };

/**
 * Insert a related record
 * @param  {String}      fieldPath Relation path
 * @param  {Object}      record    Record
 * @param  {Object}      [opts]    Insert opts
 * @param  {Function}    [cb]      Executed upon completion
 * @return {Model}                 Model
 */
// Model.prototype.create = function(fieldPath, record, opts, cb) {

//   // set defaults
//   if(typeof opts == 'function') { cb = opts; opts = {}; }
//   opts = opts || {};
//   var _cb = cb || function(err) { if(err) { throw err; } };

//   // validate args
//   if(cb && typeof cb != 'function') { throw new Error('cb must be a function'); }
//   if(typeof fieldPath != 'string') { return _cb(new Error('fieldPath must be a string')); }
//   if(record === null || typeof record != 'object') { return _cb(new Error('record must be an object')); }
//   if(opts === null || typeof opts != 'object') { return _cb(new Error('opts must be an object')); }

//   // create the record
//   var rout = this.insert(fieldPath, [record], opts);

//   // callback and return
//   if(cb) { rout.first(cb); }
//   return rout;
// };

/**
 * Update related records
 * @param  {String}      fieldPath Relation path
 * @param  {Object}      query     Query
 * @param  {Object}      delta     Delta
 * @param  {Object}      [opts]    Insert opts
 * @param  {Function}    [cb]      Executed upon completion
 * @return {Model}                 Model
 */
// Model.prototype.update = function(fieldPath, query, delta, opts, cb) {
//   var _this = this;

//   // set defaults
//   if(typeof opts == 'function') { cb = opts; opts = {}; }
//   opts = opts || {};
//   var _cb = cb || function(err) { if(err) { throw err; } };

//   // validate args
//   if(cb && typeof _cb != 'function') { throw new Error('cb must be a function'); }
//   if(typeof fieldPath != 'string') { return _cb(new Error('fieldPath must be a string')); }
//   if(query === null || typeof query != 'object') { return _cb(new Error('query must be an object')); }
//   if(this.constructor._stripSubQueries(query)) { return _cb(new Error('query cannot contain sub queries when used with update')); }
//   if(delta === null || typeof delta != 'object') { return _cb(new Error('delta must be an object')); }
//   if(opts === null || typeof opts != 'object') { return _cb(new Error('opts must be an object')); }

//   var subModelType = this._getSubModelTypeByFieldPath(fieldPath);

//   var SubModel = null;
//   if(subModelType === 'relation') {
//     SubModel = this._getSubModelRelationByFieldPath(fieldPath);
//     query = this._scopeRelationQuery(query);
//   }

//   else if(subModelType === 'reference') {
//     SubModel = this._getSubModelReferenceByFieldPath(fieldPath);
//     query = this._scopeReferenceQuery(query);
//   }

//   if(!SubModel) { return _cb(new Error('cannot find model associated with path ' + fieldPath)); }

//   return SubModel.update(query, delta, opts, cb);
// };

// Model.prototype.updateOne = function(fieldPath, query, delta, opts, cb) {

//   // set defaults
//   if(typeof opts == 'function') { cb = opts; opts = {}; }
//   opts = opts || {};
//   var _cb = cb || function(err) { if(err) { throw err; } };

//   // validate args
//   if(cb && typeof cb != 'function') { throw new Error('cb must be a function'); }
//   if(typeof fieldPath != 'string') { return _cb(new Error('fieldPath must be a string')); }
//   if(query === null || typeof query != 'object') { return _cb(new Error('query must be an object')); }
//   if(this.constructor._stripSubQueries(query)) { return _cb(new Error('query cannot contain sub queries when used with update')); }
//   if(delta === null || typeof delta != 'object') { return _cb(new Error('delta must be an object')); }
//   if(opts === null || typeof opts != 'object') { return _cb(new Error('opts must be an object')); }

//   // update the record
//   opts.single = true;
//   var cout = this.update(fieldPath, query, delta, opts);

//   // callback and return
//   if(cb) { cout.count(cb); }
//   return cout;
// };
// Model.prototype.updateById = function() {

//   // set defaults
//   if(typeof opts == 'function') { cb = opts; opts = {}; }
//   opts = opts || {};
//   var _cb = cb || function(err) { if(err) { throw err; } };

//   // validate args
//   if(cb && typeof cb != 'function') { throw new Error('cb must be a function'); }
//   if(typeof fieldPath != 'string') { return _cb(new Error('fieldPath must be a string')); }
//   if(typeof id != 'string') { return _cb(new Error('id must be a string')); }
//   if(delta === null || typeof delta != 'object') { return _cb(new Error('delta must be an object')); }
//   if(opts === null || typeof opts != 'object') { return _cb(new Error('opts must be an object')); }

//   // update the record
//   var query = {};
//   query[this.constructor.idKey()] = id;
//   var cout = this.updateOne(fieldPath, query, delta, opts);

//   // callback and return
//   if(cb) { cout.count(cb); }
//   return cout;
// };

// Model.prototype.remove = function(fieldPath, query, opts, cb) {

// };

// Model.prototype.removeOne = function(fieldPath, query, opts, cb) {

// };

// Model.prototype.removeById = function(fieldPath, id, opts, cb) {

// };

/**
 * Get/Set the model record.
 * @param  {Object}  [record]   Record data.
 * @param  {Boolean} [setCache] If true then reset the cache.
 * @return {Object}             Record data.
 */
Model.prototype.record = function(record, setCache) {
  var self = this;

  guard('record', record, [ 'object', 'undefined' ]);
  guard('setCache', setCache, [ 'boolean', 'undefined' ]);

  if (record) {
    if (setCache) { self._setCache(record); }
    return self._setRecord(record);
  } else {
    return self._getRecord();
  }
};

/**
 * Reset the model to the state saved in the database.
 * @param  {ModelCallback} [cb] Callback executed on completion.
 */
Model.prototype.reset = function(cb) {
  var self = this;
  guard('cb', cb, [ 'function', 'undefined' ]);
  self._setCache(null);
  self._setRecord(null);
  if (self._id) {
    self.constructor.findById(self._id, {
      rawMode: true
    }, function(err, record) {
      self._setCache(record);
      self._setRecord(record);
      if (cb) {
        cb(null, self);
      }
    });
  }
};

/**
 * Save the model.
 * @param  {ModelCallback} [cb]     Callback executed on completion.
 */
Model.prototype.save = function(cb) {
  var self = this;

  // validate
  guard('cb', cb, [ 'function', 'undefined' ]);

  // if this is a new model then create it.
  if (self.newModel) {
    self.constructor.create(self._getRecord(), {
      rawMode: true
    }, function(err, record) {
      if (err) {
        if (err) { cb(err); }
        return;
      }
      self._setCache(record);
      self._setRecord(record);
      if (cb) {
        cb(null, self);
      }
    });
  }

  // otherwise update it.
  else {
    self.constructor.updateById(self._id, self._getDelta().diff, function(err) {
      if (err) {
        if (err) { cb(err); }
        return;
      }
      self._setCache(self._getRecord());
      if (cb) {
        cb(null, self);
      }
    });
  }
};

Model.prototype.saveAll = function(cb) {
  var self = this;

  guard('cb', cb, [ 'function', 'undefined' ]);

  // save this model
  self.save(function(err) {
    if (err) {
      if (err) { cb(err); }
      return;
    }

    // collect the relation and reference paths
    var paths = [];
    for (var keyPath in self.constructor.relations) {
      paths.push(self.constructor.relations[keyPath].fieldPath);
    }
    for (var modelName in self.constructor.references) {
      for (var keyPath in self.constructor.references[modelName]) {
        paths.push(
          self.constructor.references[modelName][keyPath].foreignFieldPath
        );
      }
    }

    // process each path and save each populated model
    var j = paths.length;
    if (j == 0) {
      if (cb) { cb(null, self); }
      return;
    }

    for (var i = 0; i < paths.length; i += 1) {
      var ctx = _this;
      var chunks = paths[j].split('.');
      for (var k = 0; k < chunks.length; k += 1) {
        ctx = ctx[chunks[k]];
        if (!ctx) { break; }
      }
      if (ctx && typeof ctx == 'object' && typeof ctx.save == 'function') {
        ctx.save(function(err) {
          if (err) {
            j = 0;
            if (cb) { cb(err); }
            return;
          }
          j -= 1;
          if (j === 0) {
            if (cb) {
              cb(null, self);
            }
            return;
          }
        });
      }
    }
  });
};

/**
 * Remove the model from the database.
 * @param  {ModelCallback} [cb] Executed upon completion.
 */
Model.prototype.remove = function(cb) {
  var self = this;

  guard('cb', cb, [ 'function', 'undefined' ]);
  if (self.newModel) {
    throw new Error('Cannot call remove on new model');
  }

  var idKey = self.constructor.idKey();
  self.constructor.removeById(self[idKey], function(err, count) {
    if (err) {
      if (cb) { cb(err); }
      return;
    }
    delete self[idKey];
    if (cb) { cb(null); }
  });
};

Model.prototype.removeAll = function(cb) {
  var self = this;

  // validate args
  guard('cb', cb, [ 'function', 'undefined' ]);

  // save this model
  self.remove(function(err) {
    if (err) {
      return cb(err);
    }

    // collect the relation and reference paths
    var paths = [];
    for (var keyPath in self.constructor.relations) {
      paths.push(self.constructor.relations[keyPath].fieldPath);
    }
    for (var modelName in self.constructor.references) {
      for (var keyPath in self.constructor.references[modelName]) {
        paths.push(
          self.constructor.references[modelName][keyPath].foreignFieldPath
        );
      }
    }

    // process each path and save each populated model
    var j = paths.length;
    if (j == 0) {
      if (cb) { cb(null, self); }
      return;
    }
    for (var i = 0; i < paths.length; i += 1) {
      var ctx = _this;
      var chunks = paths[j].split('.');
      for (var k = 0; k < chunks.length; k += 1) {
        ctx = ctx[chunks[k]];
        if (!ctx) { break; }
      }
      if (ctx && typeof ctx == 'object' && typeof ctx.save == 'function') {
        ctx.save(function(err) {
          if (err) {
            j = 0;
            if (cb) { cb(err); }
            return;
          }
          j -= 1;
          if (j === 0) {
            if (cb) { cb(null, _this); }
            return;
          }
        });
      }
    }
  });
};

Model.prototype.valueOf = function() {
  var self = this;
  return self._getRecord();
};

Model.prototype.toJSON = function() {
  var self = this;
  return self._getRecord(true);
};

Model.prototype.toString = function() {
  var self = this;
  return JSON.stringify(self);
};

/**
 * Set the model cache.
 * @private
 * @param  {Object} data Record data.
 * @return {Object}      Record data.
 */
Model.prototype._setCache = function(data) {
  var self = this;

  // validate
  guard('data', data, [ 'object', 'null' ]);

  if (data === null) { return self.cache = null; }

  self.cache = {};
  for (var property in data) {
    var val;
    if (data[property] !== null && typeof data[property] == 'object') {
      val = clone(data[property]);
    } else {
      val = data[property];
    }
    if (self._reservedProperties.indexOf(property) > -1) {
      property = '__' + property;
    }
    self.cache[property] = val;
  }
  return data;
};

/**
 * Set the model data.
 * @private
 * @param  {Object} data Record data.
 * @return {Object}      Record data.
 */
Model.prototype._setRecord = function(data) {
  var self = this;

  // validate
  guard('data', data, [ 'object', 'null' ]);

  // if the model is still initializing then
  // mark the reserved properties and move to
  // the ready state.
  if (self.status == 'init') {
    for (var property in self) {
      if (self.hasOwnProperty(property)) {
        self._reservedProperties.push(property);
      }
    }
    self.status = 'ready';
  }

  // delete any properties left behind by old
  // model data.
  else {
    for (var property in self) {
      if (
        self.hasOwnProperty(property) &&
        self._reservedProperties.indexOf(property) == -1
      ) { delete self[property]; }
    }
  }

  // apply the data to the model.
  if (data !== null) {
    for (var property in data) {
      var val;
      if (data[property] !== null && typeof data[property] == 'object') {
        val = clone(data[property]);
      } else {
        val = data[property];
      }
      if (self._reservedProperties.indexOf(property) > -1) {
        property = '__' + property;
      }
      self[property] = val;
    }
  }

  return data;
};

/**
 * Get the model data.
 * @private
 * @return {Object} Record data.
 */
Model.prototype._getRecord = function(includeSubRecords) {
  var self = this;

  // defaults
  includeSubRecords = includeSubRecords === true;

  // collection reserved properties,
  // reference paths, and relation paths.
  var reservedProperties = self._reservedProperties;
  var relationPaths = [];
  var referencePaths = [];
  for (var keyPath in self.constructor.relations) {
    relationPaths.push(self.constructor.relations[keyPath].fieldPath);
  }
  for (var modelName in self.constructor.references) {
    for (var keyPath in self.constructor.references[modelName]) {
      referencePaths.push(
        self.constructor.references[modelName][keyPath].foreignFieldPath
      );
    }
  }

  // loop through the model and collect all
  // for the data.
  var data = {};
  (function rec(path, ctx, data) {
    for (var prop in ctx) {
      if (ctx.hasOwnProperty(prop)) {
        var propPath = path && path + '.' + prop || prop;
        var val = ctx[prop];
        if (
          (path || reservedProperties.indexOf(propPath) === -1) &&
          (
            includeSubRecords || relationPaths.indexOf(propPath) === -1 &&
            referencePaths.indexOf(propPath) === -1
          )
        ) {
          if (
            prop === propPath &&
            prop.slice(0, 2) == '__' &&
            reservedProperties.indexOf(prop.slice(0, 2)) !== -1
          ) {
            prop = prop.slice(0, 2);
          }
          if (val !== null && typeof val == 'object') {
            if (typeof val._getRecord == 'function') {
              data[prop] = val._getRecord(true);
            } else if (typeof val._getRecords == 'function') {
              data[prop] = val._getRecords(true);
            } else if (val.constructor == Object) {
              if (!data[prop]) { data[prop] = {}; }
              rec(propPath, val, data[prop]);
            } else {
              data[prop] = clone(val);
            }
          } else {
            data[prop] = val;
          }
        }
      }
    }
  })('', self, data);

  return data;
};

/**
 * Get the model delta.
 * @private
 * @return {Object} Model delta.
 */
Model.prototype._getDelta = function() {
  var self = this;
  return Delta.create(self.cache, self._getRecord());
};

Model.prototype._getRelationByFieldPath = function(fieldPath) {
  var self = this;
  for (var key in self.relations) {
    var relation = self.relations[key];
    if (relation.fieldPath === fieldPath) {
      return relation;
    }
  }
  return null;
};

Model.prototype._getReferenceByFieldPath = function(fieldPath) {
  var self = this;
  for (var modelName in self.references) {
    for (var key in self.references[modelName]) {
      var reference = self.references[modelName][key];
      if (reference.foreignFieldPath === fieldPath) {
        return reference;
      }
    }
  }
  return null;
};

/**
 * Extracts sub model data. Note that is modifies
 * the data object.
 * @param  {Object} data Model data.
 * @return {Object}      Extracted sub model data.
 */
Model.prototype._extractSubModelRecords = function(data) {
  var self = this;
  var subModelData = {};

  // grab the relations and the references.
  var relations = self.constructor.relations;
  var references = self.constructor.references;
  var models = self.constructor.merlin.models;

  // traverse and extract all of the sub model
  // data.
  for (var key in relations) {
    var relation = relations[key];
    var fieldPath = relation.fieldPath;
    var SubModel = models[relation.modelName];
    var chunks = fieldPath.split('.');
    var _data = data;
    for (var i = 0; i < chunks.length - 1; i += 1) {
      if (data[chunks[i]] === null || typeof data[chunks[i]] != 'object') {
        _data = null;
        break;
      }
      _data = data[chunks[i]];
    }
    _data = data[chunks[chunks.length - 1]];
    delete data[chunks[chunks.length - 1]];
    if (_data) {
      subModelData[fieldPath] = { Model: SubModel, records: _data };
    }
  }
  for (var modelName in references) {
    for (var key in references[modelName]) {
      var reference = references[modelName][key];
      var foreignFieldPath = reference.foreignFieldPath;
      var SubModel = models[reference.modelName];
      var chunks = foreignFieldPath.split('.');
      var _data = data;
      for (var i = 0; i < chunks.length - 1; i += 1) {
        if (data[chunks[i]] === null || typeof data[chunks[i]] != 'object') {
          _data = null;
          break;
        }
        _data = data[chunks[i]];
      }
      _data = data[chunks[chunks.length - 1]];
      delete data[chunks[chunks.length - 1]];
      if (_data) {
        subModelData[foreignFieldPath] = { Model: SubModel, records: _data };
      }
    }
  }

  // return the sub model data.
  return subModelData;
};

/**
 * Create sub models from extracted sub model data.
 * @param {Object} subRecords Sub model data object created by
 *                            _extractSubModelRecords.
 * @param {Object} [opts]     Sub model constructor opts.
 */
Model.prototype._createSubModels = function(subRecords, opts) {
  var self = this;

  // defaults
  opts = opts || {};

  // validate
  if (subRecords === null || typeof subRecords != 'object') {
    throw new Error('subRecords must be an object');
  }
  if (opts === null || typeof opts != 'object') {
    throw new Error('opts must be an object');
  }

  // loop through the sub model data.
  for (var fieldPath in subRecords) {

    // grab the sub model and records
    var SubModel = subRecords[fieldPath].Model;
    var records = subRecords[fieldPath].records;

    // create the sub model(s)
    var subModel;
    if (typeof records.length == 'number') {
      subModel = new ModelSet(SubModel);
      subModel.records(records);
    } else {
      subModel = new SubModel(records);
    }

    // TODO: bind the relationship between the sub models and the model itself

    // attach the sub model(s)
    var pathChunks = fieldPath.split('.');
    var ctx = self;
    for (var i = 0; i < pathChunks.length - 1; i += 1) {
      var chunk = pathChunks[i];
      if (ctx[chunk] === null || typeof ctx[chunk] != 'object') {
        ctx[chunk] = {};
      }
      ctx = ctx[chunk];
    }
    ctx[pathChunks[pathChunks.length - 1]] = subModel;
  }
};


module.exports = Model;
