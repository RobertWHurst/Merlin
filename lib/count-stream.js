
var util = require('util');
var Transform = require('stream').Transform;
var guard = require('type-guard');

/**
 * CountStream constructor.
 * @constructor
 */
function CountStream() {
  Transform.call(this, { objectMode: true });
  this._count = null;
}
util.inherits(CountStream, Transform);

CountStream.prototype.count = function(cb) {

  guard('cb', cb, 'function');

  var count = null;
  this.on('error', function(err) {
    cb(err);
  });
  this.on('readable', function() {
    count = this.read();
  });
  this.on('end', function() {
    cb(null, count);
  });
};

CountStream.prototype._transform = function(count, enc, cb) {
  this._count = count|0;
  cb(null);
};

CountStream.prototype._flush = function(cb) {
  this.push(this._count);
  cb(null);
};


module.exports = CountStream;
