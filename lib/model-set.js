
var util = require('util');
var guard = require('type-guard');


/**
 * ModelSet constructor.
 * @constructor
 * @param {Model}  Model   Model constructor.
 * @param {Object} [opts]  Model options.
 */
function ModelSet(Model, opts) {
  Array.call(this);

  // set defaults
  opts = opts || {};

  // validate args
  guard('Model', Model, 'function');
  if (!Model.merlin) {
    throw new Error('Model must be registered with merlin');
  }

  // setup instance
  this.Model = Model;
  this.rawMode = opts.rawMode === true;
}
util.inherits(ModelSet, Array);

/**
 * Create and save a record, add it to the model set.
 * @param  {Object}        data Record data.
 * @param  {ModelCallback} [cb] Callback executed on completion.
 * @return {ModelStream}        ModelStream containing effected models.
 */
ModelSet.prototype.create = function(record, cb) {
  var self = this;
  return self.Model.merlin._create(record, self.opts, function(err, model) {
    if (err) {
      cb(err);
    } else {
      cb(null, model);
    }
  });
};

/**
 * Push a model or record into the ModelSet.
 * @return {Number} Length of modelSet.
 */
ModelSet.prototype.push = function() {
  var self = this;
  var records = arguments.slice && arguments.slice(0) ||
    Array.prototype.slice.call(arguments, 0);
  for (var i = 0; i < records.length; i += 1) {
    guard('record[' + i + ']', records[i], 'object');
    if (!self.rawMode && records[i].constructor == Object) {
      records[i] = new self.Model(records[i], self.opts);
    }
  }
  return Array.prototype.push.apply(self, records);
};

/**
 * Get/Set the model set records.
 * @param  {Array} [data] Array of records.
 * @return {Array}        Array of records.
 */
ModelSet.prototype.records = function(records) {
  var self = this;
  if (records) {
    return self._setRecords(records);
  } else {
    return self._getRecords();
  }
};

/**
 * valueOf hook for model sets.
 * @return {Object} Record data.
 */
ModelSet.prototype.valueOf = function() {
  var self = this;
  return self._getRecords();
};

/**
 * Support method for JSON.stringify
 * @return {Object} Record data.
 */
ModelSet.prototype.toJSON = function() {
  var self = this;
  return self._getRecords(true);
};

/**
 * String value of the model set.
 * @return {String} JSON string.
 */
ModelSet.prototype.toString = function() {
  var self = this;
  return JSON.stringify(self);
};

/**
 * Get the model set data.
 * @private
 * @return {Array} An array of model set data.
 */
ModelSet.prototype._getRecords = function(stripPopulated) {
  var self = this;
  var arr = [];
  for (var i = 0; i < self.length; i += 1) {
    arr.push(self[i]._getRecord(stripPopulated));
  }
  return arr;
};

/**
 * Set the model set data.
 * @private
 * @param {Array} arr Array of records or models.
 */
ModelSet.prototype._setRecords = function(records) {
  var self = this;
  for (var i = 0; i < records.length; i += 1) {
    self.push(records[i]);
  }
  return records;
};


module.exports = ModelSet;
