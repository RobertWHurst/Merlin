
// modules
var test = require('tape');

var Model = require('../lib/model');


test('new Model()', function(t) {
  t.throws(function() {
    new Model();
  }, 'cannot construct a model directly');
  t.end();
});
