const async       = require('async');
const SchemaRule  = require('./schema-rule');
const VirtualRule = require('./virtual-rule');


class Schema {

  constructor(rules = {}, opts = {}) {
    this._statics        = {};
    this._methods        = {};
    this._paths          = {};
    this._virtualPaths   = {};
    this._hooks          = { pre: {}, post: {} };
    this._appliedPlugins = [];
    if (rules) { this.add(rules); }
  }

  add(rules = {}) {
    const rec = (path, rules) => {
      for (let field in rules) {
        const subPath = path ? path + '.' + field : field;

        if (typeof rules[field] === 'string') {
          rules[field] = { type: rules[field] };
        }

        if (!(rules[field] instanceof Object)) { continue; }

        if (typeof rules[field].type === 'string') {
          this._paths[subPath] = new SchemaRule(rules[field]);
          continue;
        }

        return rec(subPath, rules[field]);
      }
    };
    debugger;
    rec('', rules);
    return this;
  }

  get(path) {
    return this._paths[path];
  }

  method(propertyName, fn) {
    if (fn) {
      this._methods[propertyName] = fn;
      return this;
    }
    return this._methods[propertyName];
  }

  static(propertyName, fn) {
    if (fn) {
      this._statics[propertyName] = fn;
      return this;
    }
    return this._statics[propertyName];
  }

  virtual(path, opts) {
    this._virtualPaths[path] = new VirtualRule(opts);
    return this;
  }

  pre(hookName, handler) {
    this._hooks.pre[hookName] || (this._hooks.pre[hookName] = []);
    this._hooks.pre[hookName].push(handler);
    return this;
  }

  post(hookName, handler) {
    this._hooks.post[hookName] || (this._hooks.post[hookName] = []);
    this._hooks.post[hookName].push(handler);
    return this;
  }

  execute(hookName, ctx, ...args) {
    const cb = args.pop();
    const fn = args.pop();
    this._hooks.pre[hookName]  || (this._hooks.pre[hookName]  = []);
    this._hooks.post[hookName] || (this._hooks.post[hookName] = []);

    async.eachSeries(this._hooks.pre[hookName], (preHandler, cb) => {
      preHandler.call(ctx, ...args, cb);
    }, (err) => {
      if (err) { return cb(err); }

      fn.call(ctx, (err, ...args) => {
        if (err) { return cb(err); }

        async.eachSeries(this._hooks.post[hookName], (postHandler, cb) => {
          postHandler.call(ctx, ...args, cb);
        }, cb);
      });
    });

    return this;
  }

  validate(cb) {

  }

  plugin(plugin, opts = {}) {
    if (this._appliedPlugins.indexOf(plugin) > -1) { return; }
    this._appliedPlugins.push(plugin);
    plugin(this, opts);
    return this;
  }
}


module.exports = Schema;
