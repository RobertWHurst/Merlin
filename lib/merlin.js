
// modules
var fleck = require('fleck');
var Duplex = require('stream').Duplex;
var util = require('util');
var Schema = require('merlin-schema').Schema;
var guard = require('type-guard');

// libs
var processModel = require('./static-model');
var Model = require('./model');
var HookHub = require('./hook-hub');

/**
 * Callback executed completion.
 * @callback ErrorCallback
 * @param {Error|Null} err Error if any occurred.
 */

/**
 * Callback executed upon count completion.
 * @callback CountCallback
 * @param {Error|Null} err   Error if any occurred.
 * @param {Number}     count Total number of records matching the count
 *                           query.
 */


/**
 * Merlin constructor.
 * @constructor
 * @param {Object} [opts] Instance options.
 */
function Merlin(opts) {
  var self = this;
  HookHub.call(self);

  // set defualts.
  opts = opts || {};
  opts.pruneForeignKeys = opts.pruneForeignKeys !== false;
  opts.autoPopulateByQuery = opts.autoPopulateByQuery !== false;
  opts.skipSchemaValidation = opts.skipSchemaValidation !== false;
  opts.idKey = opts.idKey || 'id';
  opts.pluralForeignKey = opts.pluralForeignKey || '{modelName}Ids';
  opts.singularForeignKey = opts.singularForeignKey || '{modelName}Id';

  // validate
  guard('opts', opts, 'object');
  guard('opts.pruneForeignKeys', opts.pruneForeignKeys, 'boolean');
  guard('opts.autoPopulateByQuery', opts.autoPopulateByQuery, 'boolean');
  guard('opts.skipSchemaValidation', opts.skipSchemaValidation, 'boolean');
  guard('opts.idKey', opts.idKey, 'string');
  guard('opts.pluralForeignKey', opts.pluralForeignKey, 'string');
  guard('opts.singularForeignKey', opts.singularForeignKey, 'string');

  // setup the instance.
  self.opts = opts;
  self.status = 'init';
  self.models = {};
  self._driver = null;
  self._plugins = [];
};
util.inherits(Merlin, HookHub);


////////////////////////////
// System Related Methods //
////////////////////////////

/**
 * Connect to the database.
 * @param  {ErrorCallback} [cb] Callback executed upon completion.
 */
Merlin.prototype.connect = function(cb) {
  var self = this;

  // set defaults
  cb = cb || function() {};

  // validate args
  if (typeof cb != 'function') { throw new Error('cb must be a function'); }
  if (!self._driver) {
    throw new Error(
      'A driver must be registered with merlin before connect is called'
    );
  }

  // connect
  return self._driver.connect(function(err) {
    if (err) { return cb(err); }

    for (var modelName in self.models) {
      var Model = self.models[modelName];
      Model.merlin = self;
      new Model();
    }
    self.status = 'connected';
    self.triggerHook('connected', self);
    cb(null);
  });
};

/**
 * Disconnect from the database.
 * @param  {ErrorCallback} [cb] Callback executed upon completion.
 */
Merlin.prototype.close = function(cb) {
  var self = this;

  // set defaults
  cb = cb || function() {};

  // validate args
  guard('cb', cb, 'function');

  // close connection
  return self._driver.close(function(err) {
    if (err) { return cb(err); }
    self.status = 'ready';
    self.triggerHook('close', self);
    cb(null);
  })
};

/**
 * Set the driver merlin will use to interact with the database.
 * @param  {Object|Null} driver Driver object.
 * @return {Object|Null}        Driver object.
 */
Merlin.prototype.driver = function(driver) {
  var self = this;

  // check status
  if (self.status == 'connected') {
    throw new Error('cannot change driver while connected');
  }

  // if the driver is not null
  if (driver !== null) {

    // construct the driver
    driver = self._construct(driver);

    // validate args
    guard('driver', driver, [ 'object', 'null' ]);
    // ensure the driver has the required methods
    guard('driver.connect', driver.connect, 'function');
    guard('driver.index', driver.index, 'function');
    guard('driver.count', driver.count, 'function');
    guard('driver.find', driver.find, 'function');
    guard('driver.insert', driver.insert, 'function');
    guard('driver.update', driver.update, 'function');
    guard('driver.remove', driver.remove, 'function');
  }

  // update the status, set the driver and return
  if (driver === null) {
    self.status = 'init';
  } else {
    self.status = 'ready';
  }
  return self._driver = driver;
};

/**
 * Add a plugin to merlin.
 * @param  {Object} plugin Plugin instance.
 * @return {Object}        Plugin instance.
 */
Merlin.prototype.plugin = function(plugin) {
  var self = this;

  // construct the plugin
  plugin = self._construct(plugin);

  // validate args
  guard('plugin', plugin, 'object');
  if (self.status == 'connected') {
    throw new Error('cannot add plugin while connected.');
  }
  if (self.status == 'init') {
    throw new Error('cannot add plugin without a driver.');
  }

  // add the plugin and return
  self.triggerHook('plugin', plugin);
  self._plugins.push(plugin);
  return plugin;
};

/**
 * Retreves or registers a model by name.
 * @param  {String}             modelName Model name.
 * @param  {Model}      [model] Model constructor.
 * @return {Model|Null}         Model constructor.
 */
Merlin.prototype.model = function(modelName, Model, opts) {
  var self = this;

  // default args
  opts = opts || {};
  opts.collectionName = opts.collectionName ||
    fleck.pluralize(modelName.charAt(0).toLowerCase() + modelName.substr(1));

  // convert schema definitions to models
  if (Model === true) {
    Model = self._createModel();
  } else if (typeof Model == 'object' && Model.constructor == Object) {
    Model = self._createModel(Model);
  }

  // validate args
  guard('modelName', modelName, 'string');
  guard('Model', Model, [ 'function', 'undefined' ]);
  guard('opts', opts, 'object');

  // check state and add the model
  if (Model) {
    if (self.status == 'connected') {
      throw new Error('cannot register a model while connected.');
    }
    if (self.status == 'init') {
      throw new Error('cannot register a model without a driver.');
    }
    Model = processModel(self, modelName, opts.collectionName, Model);
    self.triggerHook('model', Model, undefined);
    self.models[modelName] = Model;
  }

  // return
  return self.models[modelName] || null;
};

/**
 * Construct a driver or middleware factory, or class.
 * @private
 * @param  {Function} constructable Factory or constructor.
 * @return {Object}                 Instance.
 */
Merlin.prototype._construct = function(Constructable) {
  var self = this;
  guard('Constructable', Constructable, 'function');
  var instance = null;
  try {
    instance = Constructable(self);
    if (typeof instance != 'object') { throw ''; }
  } catch (e) {
    instance = new Constructable(self);
  }
  return instance;
};

/**
 * Generates a model.
 * @param  {Object}       [rules]   Schema rules
 * @return {MerlinModel}           Merlin model instance.
 */
Merlin.prototype._createModel = function(rules) {

  // create the named model.
  function MerlinModel() {
    Model.apply(this, arguments);
  };
  util.inherits(MerlinModel, Model);

  // attach a schema if given.
  if (typeof rules == 'object') {
    if (rules.constructor != Schema) { schema = new Schema(rules); }
    MerlinModel.schema = schema;
  }

  // return the model.
  return MerlinModel;
};

module.exports = Merlin;

