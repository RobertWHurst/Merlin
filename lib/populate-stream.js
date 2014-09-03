
// modules
var util = require('util');
var Transform = require('stream').Transform;
var guard = require('type-guard');


/**
 * Populate stream
 * @param {Model} Model  Merlin Model.
 * @param {Object} query Query object.
 */
function PopulateStream(Model, query, opts) {
  var self = this;

  Transform.call(self, { objectMode: true });

  // validate
  guard('Model', Model, 'function');
  guard('query', query, 'object');
  guard('opts', opts, 'object');

  // setup
  self.Model = Model;
  self.query = query;
  self.opts = opts;
  self._queue = [];
}
util.inherits(PopulateStream, Transform);

/**
 * Get a sub query by field path.
 * @param  {String}      fieldPath Path to subQuery
 * @return {Object|Null}           Sub query object if found, otherwise
 */
PopulateStream.prototype._findSubQueryByPath = function(fieldPath) {
  var self = this;
  var pathChunks = fieldPath.split('.');
  var query = self.query;
  for (var i = 0; i < pathChunks.length; i += 1) {
    var fieldName = pathChunks[i];
    if (query === null || typeof query != 'object') { return null; }
    query = query[fieldName];
  }
  if (query && typeof query != 'object') { query = {}; }
  return query || null;
};

/**
 * Add a sub record to a record.
 * @param  {Object} record    Root record
 * @param  {String} fieldPath Field path to attach at
 * @param  {Object} subRecord Sub record
 */
PopulateStream.prototype._attachSubRecord = function(
  record, fieldPath, subRecord
) {
  var pathChunks = fieldPath.split('.');
  for (var i = 0; i < pathChunks.length - 1; i += 1) {
    var fieldName = pathChunks[i];
    if (record[fieldName] === null || typeof record[fieldName] != 'object') {
      record[fieldName] = {};
    }
  }
  record[pathChunks[pathChunks.length - 1]] = subRecord;
};

/**
 * Attach sub records/models to the record/model with in the stream.
 * @private
 * @param {Object|Model} record A record or model to attach sub models too.
 * @param {String}       enc
 * @param {Function}     cb     Executed once the record/model has been
                                processed.
 */
PopulateStream.prototype._transform = function(record, enc, cb) {
  var self = this;

  var relations = self.Model.relations;
  var references = self.Model.references;
  var models = self.Model.viceroy.models;

  // findout what relations need to be populated
  var keyPaths = Object.keys(relations);
  var j1 = keyPaths.length;
  for (var i = 0; i < keyPaths.length; i += 1) {
    var relation = relations[keyPaths[i]];
    var RelModel = models[relation.modelName];

    // add the relation ids to the query and
    // figure out the static method to call;
    // find, or findOne.
    var id;
    var method;
    if (relation.type == 'oneToMany') {
      id = { $in: record[relation.keyPath] };
      method = 'find';
    } else {
      id = record[relation.keyPath];
      method = 'findOne';
    }

    // create the sub query
    var subQuery = self._findSubQueryByPath(relation.fieldPath);
    subQuery[self.Model.idKey()] = id;

    // preform the find/findOne.
    RelModel[method](subQuery, {
      rawMode: self.opts.rawMode
    }, function(err, records) {
      if (err) { j1 = j2 = 0; return cb(err); }
      self._attachSubRecord(record, relation.fieldPath, records);
      j1 -= 1;
      if (j1 === 0 && j2 === 0) { self.push(record); cb(null); }
    });
  }

  // findout what references need to be populated
  var j2 = 0;
  for (var modelName in references) {
    keyPaths = Object.keys(references[modelName]);
    j2 += keyPaths.length;
    for (var j = 0; j < keyPaths.length; j += 1) {
      var reference = references[modelName][keyPaths[j]];
      var RefModel = models[reference.modelName];

      // figure out the static method to call;
      // find, or findOne.
      var method;
      if (reference.type == 'manyToOne') {
        method = 'find';
      } else {
        method = 'findOne';
      }

      // create the sub query
      var subQuery = self._findSubQueryByPath(reference.foreignFieldPath);
      subQuery[reference.keyPath] = record[self.Model.idKey()];

      // preform the find/findOne.
      RefModel[method](subQuery, {
        rawMode: self.opts.rawMode
      }, function(err, records) {
        if (err) { j1 = j2 = 0; return cb(err); }
        self._attachSubRecord(record, reference.foreignFieldPath, records);
        j2 -= 1;
        if (j1 === 0 && j2 === 0) { self.push(record); cb(null); }
      });
    }
  }
};


module.exports = PopulateStream;
