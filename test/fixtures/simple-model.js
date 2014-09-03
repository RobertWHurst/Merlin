
var util = require('util');
var Model = require('../../lib/model');


function SimpleModel() {
  Model.apply(this, arguments);
}
util.inherits(SimpleModel, Model);


module.exports = SimpleModel;
