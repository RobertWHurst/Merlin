const assert = require('assert');
const sinon  = require('sinon');
const Schema = require('../lib/schema')


describe('new Schema(rules) -> this', () => {

  it('rules given are added to the instance', sinon.test(() => {
    const schema = new Schema({ field: { type: 'string' } });
    assert.equal(schema._paths.field.type, 'string');
  }));

  describe('#add(rules) -> this', () => {

    it('adds rules to the schema', () => {
      const schema = new Schema();
      schema.add({ field: { type: 'string' } });
      assert.equal(schema._paths.field.type, 'string');
    });

    it('returns this', () => {
      const schema = new Schema();
      assert.equal(schema.add(), schema);
    });
  });

  describe('#get(path) -> schemaRule', () => {

    it('gets a schemaRule at a given path', () => {
      const schema = new Schema({ field: { type: 'string' } });
      assert.equal(schema.get('field').type, 'string');
    });
  });

  describe('#method(name, fn) -> this', () => {

    it('sets a method for the model', () => {
      const schema   = new Schema();
      const methodFn = function () {};
      schema.method('methodName', methodFn);
      assert.equal(schema._methods.methodName, methodFn);
    });

    it('returns this', () => {
      const schema = new Schema();
      assert.equal(schema.method('methodName', function() {}), schema);
    });
  });

  describe('#method(name) -> fn', () => {

    it('returns a method by name', () => {
      const schema   = new Schema();
      const methodFn = function () {};
      schema._methods.methodName = methodFn;
      assert.equal(schema.method('methodName'), methodFn);
    });
  });

  describe('#static(name, fn) -> this', () => {

    it('sets a static method for the model', () => {
      const schema   = new Schema();
      const methodFn = function () {};
      schema.static('methodName', methodFn);
      assert.equal(schema._statics.methodName, methodFn);
    });

    it('returns this', () => {
      const schema = new Schema();
      assert.equal(schema.static('methodName', function() {}), schema);
    });
  });

  describe('#static(name) -> fn', () => {

    it('returns a static method by name', () => {
      const schema   = new Schema();
      const methodFn = function () {};
      schema._statics.methodName = methodFn;
      assert.equal(schema.static('methodName'), methodFn);
    });
  });

  describe('#virtual(path, opts) -> this', () => {

    it('adds a virtual rule to the instance', () => {
      const schema = new Schema();
      const opts   = { get() {}, set() {} };
      schema.virtual('field', opts);
      assert.equal(schema._virtualPaths.field.get, opts.get);
      assert.equal(schema._virtualPaths.field.set, opts.set);
    });

    it('returns this', () => {
      const schema = new Schema();
      assert.equal(schema.virtual('field', {}), schema);
    });
  });

  describe('#pre(hookName, handler) -> this', () => {

    it('registers a pre hook handler with a hook name', () => {
      const schema      = new Schema();
      const hookHandler = () => {};
      schema.pre('hookName', hookHandler);
      assert.ok(schema._hooks.pre.hookName.includes(hookHandler));
    });

    it('returns this', () => {
      const schema = new Schema();
      assert.equal(schema.pre('hookName', () => {}), schema);
    });
  });

  describe('#post(hookName, handler) -> this', () => {

    it('registers a post hook handler with a hook name', () => {
      const schema      = new Schema();
      const hookHandler = () => {};
      schema.post('hookName', hookHandler);
      assert.ok(schema._hooks.post.hookName.includes(hookHandler));
    });

    it('returns this', () => {
      const schema = new Schema();
      assert.equal(schema.post('hookName', () => {}), schema);
    });
  });

  describe('#execute(hookName, ctx, ...args, fn, cb) -> this', () => {

    it('runs pre handlers, fn and post handlers', () => {
      const schema   = new Schema();
      const handler1 = sinon.stub().callsArg(0);
      const handler2 = sinon.stub().callsArg(0);
      const handler3 = sinon.stub().callsArg(0);
      const fn       = sinon.stub().callsArg(0);
      const handler4 = sinon.stub().callsArg(0);
      const handler5 = sinon.stub().callsArg(0);
      const handler6 = sinon.stub().callsArg(0);
      const cb       = sinon.stub();
      schema._hooks.pre.hookName  = [handler1, handler2, handler3];
      schema._hooks.post.hookName = [handler4, handler5, handler6];
      schema.execute('hookName', null, fn, cb);
      sinon.assert.called(handler1);
      sinon.assert.called(handler2);
      sinon.assert.called(handler3);
      sinon.assert.called(fn);
      sinon.assert.called(handler4);
      sinon.assert.called(handler5);
      sinon.assert.called(handler6);
      sinon.assert.called(cb);
    });

    it('passes args to pre handlers', () => {
      const schema  = new Schema();
      const handler = sinon.stub().callsArg(3);
      schema._hooks.pre.hookName = [handler];
      schema.execute('hookName', null, 1, 2, 3, () => {}, () => {});
      sinon.assert.calledWith(handler, 1, 2, 3);
    });

    it('passes fn callback args to post handlers', () => {
      const schema  = new Schema();
      const fn      = sinon.stub().callsArgWith(0, null, 4, 5, 6);
      const handler = sinon.stub().callsArg(3);
      schema._hooks.post.hookName = [handler];
      schema.execute('hookName', null, fn, () => {});
      sinon.assert.calledWith(handler, 4, 5, 6);
    });

    it('bails and calls back with errors in pre', () => {
      const schema   = new Schema();
      const err      = new Error();
      const handler1 = sinon.stub().callsArgWith(0, err);
      const handler2 = sinon.stub().callsArg(0);
      const fn       = sinon.stub().callsArg(0);
      const handler3 = sinon.stub().callsArg(0);
      const handler4 = sinon.stub().callsArg(0);
      const cb       = sinon.stub();
      schema._hooks.pre.hookName  = [handler1, handler2];
      schema._hooks.post.hookName = [handler3, handler4];
      schema.execute('hookName', null, fn, cb);
      sinon.assert.called(handler1);
      sinon.assert.notCalled(handler2);
      sinon.assert.notCalled(fn);
      sinon.assert.notCalled(handler3);
      sinon.assert.notCalled(handler4);
      sinon.assert.calledWith(cb, err);
    });

    it('bails and calls back with errors in fh', () => {
      const schema   = new Schema();
      const err      = new Error();
      const handler1 = sinon.stub().callsArg(0);
      const handler2 = sinon.stub().callsArg(0);
      const fn       = sinon.stub().callsArgWith(0, err);
      const handler3 = sinon.stub().callsArg(0);
      const handler4 = sinon.stub().callsArg(0);
      const cb       = sinon.stub();
      schema._hooks.pre.hookName  = [handler1, handler2];
      schema._hooks.post.hookName = [handler3, handler4];
      schema.execute('hookName', null, fn, cb);
      sinon.assert.called(handler1);
      sinon.assert.called(handler2);
      sinon.assert.called(fn);
      sinon.assert.notCalled(handler3);
      sinon.assert.notCalled(handler4);
      sinon.assert.calledWith(cb, err);
    });

    it('bails and calls back on errors in post', () => {
      const schema   = new Schema();
      const err      = new Error();
      const handler1 = sinon.stub().callsArg(0);
      const handler2 = sinon.stub().callsArg(0);
      const fn       = sinon.stub().callsArg(0);
      const handler3 = sinon.stub().callsArgWith(0, err);
      const handler4 = sinon.stub().callsArg(0);
      const cb       = sinon.stub();
      schema._hooks.pre.hookName  = [handler1, handler2];
      schema._hooks.post.hookName = [handler3, handler4];
      schema.execute('hookName', null, fn, cb);
      sinon.assert.called(handler1);
      sinon.assert.called(handler2);
      sinon.assert.called(fn);
      sinon.assert.called(handler3);
      sinon.assert.notCalled(handler4);
      sinon.assert.calledWith(cb, err);
    });

    it('returns this', () => {
      const schema = new Schema();
      assert.equal(schema.execute('hookName', null, () => {}, () => {}), schema);
    });
  });

  describe('#validate(record, cb) -> [err]', () => {

  });

  describe('#plugin(fn) -> this', () => {

    it('accepts and executes the plugin passing it the instance', () => {
      const schema   = new Schema();
      const pluginFn = sinon.stub();
      schema.plugin(pluginFn);
      sinon.assert.calledWith(pluginFn, schema);
    });

    it('passes through plugin opts', () => {
      const schema     = new Schema();
      const pluginFn   = sinon.stub();
      const pluginOpts = {};
      schema.plugin(pluginFn, pluginOpts);
      sinon.assert.calledWith(pluginFn, schema, pluginOpts);
    });

    it('only applies a plugin once', () => {
      const schema   = new Schema();
      const pluginFn = sinon.stub();
      schema.plugin(pluginFn);
      schema.plugin(pluginFn);
      sinon.assert.calledOnce(pluginFn);
    });
  });
});
