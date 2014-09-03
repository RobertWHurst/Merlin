
// modules
var util = require('util');
var guard = require('type-guard');
var Transform = require('stream').Transform;

// libs
var ModelSet = require('./model-set');

/**
 * ModelStream constructor.
 * @constructor
 * @param {Model}  Model  Model constructor.
 * @param {Object} [opts] Model options.
 */
function ModelStream(Model, opts) {
  var self = this;

  // validate
  guard('Model', Model, 'function');
  guard('opts', opts, [ 'object', 'undefined' ]);
  if (!Model.merlin) {
    throw new Error('Model must be registered with merlin');
  }

  // defualts
  opts = opts || {};
  opts.rawMode = opts.rawMode === true;

  Transform.call(self, { objectMode: true });

  // setup instance
  self.Model = Model;
  self.rawMode = opts.rawMode;
  self.opts = opts;
}
util.inherits(ModelStream, Transform);

/**
 * Loop through each model as they stream.
 * @param  {ModelCallback} handler Function executed and passed each model
 *                                 as they stream.
 * @return {ModelStream}           instance of ModelStream the method was
 *                                 called upon.
 */
ModelStream.prototype.forEach = function(handler) {
  var self = this;
  guard('handler', handler, 'function');
  self.on('readable', function() {
    handler(null, self.read());
  });
  if (cb) {
    self.on('end', function() { handler(null, null); });
    self.on('error', function(err) { handler(err); });
  }
};

/**
 * Get the first model.
 * @param  {ModelCallback} handler Function executed and passed the first
 *                                 model once it comes in.
 * @return {ModelStream}           instance of ModelStream the method was
 *                                 called upon.
 */
ModelStream.prototype.first = function(handler) {
  var self = this;
  guard('handler', handler, 'function');
  var hasRecord = false;
  self.on('readable', function listener() {
    self.removeListener('readable', listener);
    handler(null, self.read());
    hasRecord = true;
  });
  self.on('end', function() {
    if (!hasRecord) { handler(null); }
  });
  self.on('error', function(err) { handler(err); });
};

/**
 * Get the the nth model in the stream.
 * @param  {ModelCallback} handler Function executed and passed the nth
 *                                 model once it comes in.
 * @return {ModelStream}           instance of ModelStream the method was
 *                                 called upon.
 */
ModelStream.prototype.at = function(index, handler) {
  var self = this;
  guard('index', index, 'number');
  guard('handler', handler, 'function');
  var hasRecord = false;
  var i = 0;
  self.on('readable', function listener() {
    if (i == index) {
      self.removeListener('readable', listener);
      handler(null, self.read());
      hasRecord = true;
    }
    self.read();
    i += 1;
  });
  self.on('end', function() {
    if (!hasRecord) { handler(null); }
  });
  self.on('error', function(err) { handler(err); });
};

/**
 * Get the last model.
 * @param  {ModelCallback} handler Function executed and passed the last
 *                                 model once it comes in.
 * @return {ModelStream}           instance of ModelStream the method was
 *                                 called upon.
 */
ModelStream.prototype.last = function(handler) {
  var self = this;
  guard('handler', handler, 'function');
  var model = null;
  self.on('readable', function() { model = self.read(); });
  self.on('end', function() { handler(null, model); });
  self.on('error', function(err) { handler(err); });
};

/**
 * Gather all the model and bundle them into a ModelStream as they stream.
 * @param  {ModelSetCallback} handler Function executed and passed each
 *                                    model as they stream.
 * @return {ModelStream}              instance of ModelStream the method
 *                                    was called upon.
 */
ModelStream.prototype.all = function(handler) {
  var self = this;
  guard('handler', handler, 'function');
  var arr;
  if (self.rawMode) {
    arr = [];
  } else {
    arr = new ModelSet(self.Model, self.opts);
  }
  self.on('readable', function() { arr.push(self.read()); });
  self.on('end', function() { handler(null, arr); });
  self.on('error', function(err) { handler(err); });
};

ModelStream.prototype.pipeJSON = function(stream) {
  var self = this;
  guard('stream', stream, 'write-stream');
  stream.write('[');
  var first = true;
  self.on('readable', function() {
    if (!first) { stream.write(','); }
    first = false;
    stream.write(JSON.stringify(self.read()));
  });
  self.on('end', function() {
    stream.end(']');
  });
};

/**
 * Transforms records passed to write into models,
 * then adds then pushes them into the stream.
 * @private
 * @param  {Object}        data Record data.
 * @param  {String}        enc  (ignored).
 * @param  {ErrorCallback} cb   Executed once transform is complete.
 */
ModelStream.prototype._transform = function(data, enc, cb) {
  var self = this;

  // if in raw mode then push the data.
  if (self.rawMode) {

    // check for reserved properties
    for (var prop in data) {
      if (data.hasOwnProperty(prop) && self.Model.prototype[prop]) {
        return cb(new Error(prop + ' is a reserved property'));
      }
    }
    self.push(data);
    cb(null);
  }

  // if not in raw mode then create a model for
  // each record, then push that model.
  else {
    if (data.constructor !== self.Model) {
      data = new self.Model(data, self.opts.modelOpts);
    }
    self.push(data);
    cb(null);
  }
};


module.exports = ModelStream;
