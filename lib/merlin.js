const Schema = require('./schema');
const Driver = require('./driver');


class Merlin {

  constructor() {
    this._driver  = null;
    this._plugins = [];
    this._models  = {};
  }

  get isConnected() {
    return this._driver.isConnected;
  }

  driver(driver) {
    if (this.isConnected) { throw new Error('Cannot set new driver while connected'); }
    if (!(driver instanceof Driver)) { throw new Error('driver must be an instance of driver'); }

    this._driver = driver;
    return this;
  }

  plugin(plugin, opts) {
    if (this._plugins.indexOf(plugin) > -1) { return; }
    this._plugins.push([plugin, opts]);
    return this;
  }

  model(modelName, schema, opts) {
    if (schema) {
      if (!(schema instanceof Schema)) {
        schema = new Schema(opts);
      }
      for (let i = 0; i < this._plugins.length; i += 1) {
        schema.plugin(...this._plugins[i]);
      }
      this._models[modelName] = Model.subClass(this, schema, opts);
    }
    return this._models[modelName];
  }

  connect(url, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    this._driver.connect(url, opts, cb);
    return this;
  }

  disconnect(cb) {
    this._driver.disconnect(cb);
    return this;
  }
}


module.exports = Merlin;
