

class Model extends Document {

  constructor(opts) {
    super(opts);

    this._hooks = { pre : {}, post: {} };
  }

  subClass(merlin, schema) {
    var SubModel = class extends Model {};

    for (var propertyName in schema.statics) {
      SubModel[propertyName] = schema.statics[propertyName];
    }
    for (var propertyName in schema.methods) {
      SubModel.prototype[propertyName] = schema.methods[propertyName];
    }

    SubModel.merlin = merlin;
    SubModel.schema = schema;

    return SubModel;
  }

  pre(hookName, fn) {
    this._hooks.pre[hookName] || (this._hooks.pre[hookName] = []);
    this._hooks.pre[hookName].push(fn);
  }

  post(hookName, fn) {
    this._hooks.post[hookName] || (this._hooks.post[hookName] = []);
    this._hooks.post[hookName].push(fn);
  }

  save(cb) {
    this.constructor.merlin;
  }

  _runHook(hookName, fn, cb) {
    const runHooks = (hooks, cb) => {
      if (!hooks) { return cb(null); }
      const rec = (i) => {
        if (i > hooks.length - 1) { return cb(null); }
        if (hooks[i].length) {
          return hooks[i]((err) => {
            if (err) { return cb(err); }
            rec(i + 1);
          });
        }
        hooks[i]();
        rec(i + 1);
      };
      rec(0);
    };
    runHooks(this._hooks.pre[hookName], (err) => {
      if (err) { return cb(err); }
      fn((err) => {
        if (err) { return cb(err); }
        runHooks(this._hooks.post[hookName], (err) => {
          if (err) { return cb(err); }
          cb(null);
        });
      });
    });
  }
}
