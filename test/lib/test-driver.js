
var mi6 = require('mi6');
var es = require('event-stream');

exports = module.exports = function(opts) {
  return function(viceroy) {
    return new TestDriver(viceroy, opts);
  };
};
exports.index = {
  args: [],
  spy: null
};
exports.count = {
  args: [],
  data: 0,
  spy: null
};
exports.find = {
  args: [],
  data: [],
  spy: null
};
exports.insert = {
  args: [],
  data: [],
  spy: null
};
exports.update = {
  args: [],
  data: 0,
  spy: null
};
exports.remove = {
  args: [],
  data: 0,
  spy: null
};

function TestDriver(viceroy, opts) {
  var self = this;

  var index = exports.index.spy = mi6(self, 'index');
  var count = exports.count.spy = mi6(self, 'count');
  var find = exports.find.spy = mi6(self, 'find');
  var insert = exports.insert.spy = mi6(self, 'insert');
  var update = exports.update.spy = mi6(self, 'update');
  var remove = exports.remove.spy = mi6(self, 'remove');

  index.callsThrough();
  count.callsThrough();
  find.callsThrough();
  insert.callsThrough();
  update.callsThrough();
  remove.callsThrough();
}

TestDriver.prototype.connect = function(cb) {
  cb(null);
};

TestDriver.prototype.index = function(collectionName, opts, fieldPath, cb) {
  exports.index.args = Array.prototype.slice.call(arguments, 0);
  cb(null);
};

TestDriver.prototype.count = function(collectionName, opts, query) {
  exports.count.args = Array.prototype.slice.call(arguments, 0);
  return es.readArray([ exports.count.data ]);
};

TestDriver.prototype.find = function(collectionName, opts, query) {
  exports.find.args = Array.prototype.slice.call(arguments, 0);
  return es.readArray(exports.find.data);
};

TestDriver.prototype.insert = function(collectionName, opts) {
  exports.insert.args = Array.prototype.slice.call(arguments, 0);

  var duplex = es.through();

  var toArray = es.writeArray(function(err, array) {
    if (err) { return duplexStream.emit('error', err); }
    exports.insert.args.push(array);
    es.readArray(array).pipe(duplex);
  });

  duplex.pipe(toArray);
  return duplex;
};

TestDriver.prototype.update = function(collectionName, opts, query, delta) {
  exports.update.args = Array.prototype.slice.call(arguments, 0);
  return es.readArray([ exports.update.data ]);
};

TestDriver.prototype.remove = function(collectionName, opts, query) {
  exports.remove.args = Array.prototype.slice.call(arguments, 0);
  return es.readArray([ exports.remove.data ]);
};

TestDriver.prototype.reset = function() {
  this.index.reset();
  this.count.reset();
  this.find.reset();
  this.insert.reset();
  this.update.reset();
  this.remove.reset();
};
