
// modules
var Merlin = require('./lib/merlin');

exports = module.exports = new Merlin();
exports.Merlin = Merlin;
exports.Query = require('merlin-query').Query;
exports.Delta = require('merlin-delta').Delta;
exports.Schema = require('merlin-schema').Schema;
exports.Model = require('./lib/model');
exports.Model.staticPrototype = require('./lib/static-model')
  .staticModelPrototype;
exports.ModelSet = require('./lib/model-set');
exports.ModelStream = require('./lib/model-stream');
exports.PopulateStream = require('./lib/populate-stream');
exports.CountStream = require('./lib/count-stream');
exports.HookHub = require('./lib/hook-hub');
