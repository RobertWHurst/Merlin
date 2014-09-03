
// modules
var test = require('tape');
var util = require('util');
var es = require('event-stream');

// libs
var Merlin = require('../lib/merlin');
var agumentModel = require('../lib/static-model');
var CountStream = require('../lib/count-stream');
var ModelStream = require('../lib/model-stream');
var ModelSet = require('../lib/model-set');
var staticModelPrototype = agumentModel.staticModelPrototype;

// test libs
var testDriver = require('./lib/test-driver');

// test fixtures
var SimpleModel = require('./fixtures/simple-model');

// test globals
var RelatedModel;
var merlin;


test('staticModelPrototype{}', function(t) {
  t.equal(typeof staticModelPrototype, 'object');
  t.end();
});

test('setup', function(t) {
  merlin = new Merlin();
  merlin.driver(testDriver());
  merlin.model('SimpleModel', SimpleModel);
  RelatedModel = merlin.model('RelatedModel', {});
  merlin.connect(function(err) {
    t.error(err, 'does not error on connect');
    t.end();
  });
});

test('agumentModel(merlin, modelName, collectionName, Model)', function(t) {

  var Model = function() {};

  agumentModel(merlin, 'MODEL_NAME', 'COLLECTION_NAME', Model);

  t.equal(Model.modelName, 'MODEL_NAME', 'sets the model name');
  t.equal(Model.collectionName, 'COLLECTION_NAME', 'sets the collection name');
  t.equal(Model.merlin, merlin, 'attaches merlin');
  t.deepEqual(Model.relations, {}, 'creates a relations object');
  t.deepEqual(Model.references, {}, 'creates a references object');
  t.equal(Model.schema, null, 'creates a schema property');
  t.equal(Model.defaults, null, 'creates a defaults property');
  if (Model.getPrototype) {
    t.equal(
      Model.getPrototype(),
      staticModelPrototype,
      'sets staticModelPrototype as the prototype'
    );
  } else {
    t.equal(
      Model.__proto__,
      staticModelPrototype,
      'sets staticModelPrototype as the prototype'
    );
  }

  t.end();
});

test('Model.index(fieldPath, opts)', function(t) {
  SimpleModel.index('fieldPath', { _: 'opts' }, function(err) {
    t.equal(
      testDriver.index.args[0],
      'simpleModels',
      'collectionName equals simpleModels'
    );
    t.deepEqual(
      testDriver.index.args[1],
      { _: 'opts' },
      'opts equals { _: \'opts\' }'
    );
    t.equal(
      testDriver.index.args[2],
      'fieldPath',
      'fieldPath equals fieldPath'
    );
    t.error(err, 'should not error');
    t.end();
  });
});

test('Model.count(query, opts, cb)', function(t) {
  var count = testDriver.count.data = Math.floor(Math.random() * 100);
  SimpleModel.count({ _: 'query' }, { _: 'opts' }, function(err, _count) {
    t.error(err, 'should not error');
    t.equal(
      testDriver.count.args[0],
      'simpleModels',
      'collectionName equals simpleModels'
    );
    t.deepEqual(
      testDriver.count.args[1],
      { _: 'opts' },
      'opts equals { _: \'opts\' }'
    );
    t.deepEqual(
      testDriver.count.args[2].query,
      { _: 'query' },
      'query.query equals { _: \'query\' }'
    );
    t.equal(_count, count, 'count is correct');
    t.end();
  });
});

test('Model.count(query, opts) -> countStream', function(t) {
  var count = testDriver.count.data = Math.floor(Math.random() * 100);
  var cout = SimpleModel.count({ _: 'QUERY' }, { _: 'OPT' });
  t.equal(cout.constructor, CountStream);
  cout.count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.count(query) -> countStream', function(t) {
  var count = testDriver.count.data = Math.floor(Math.random() * 100);
  SimpleModel.count({ _: 'QUERY' }).count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.count()', function(t) {
  var count = testDriver.count.data = Math.floor(Math.random() * 100);
  SimpleModel.count().count(function(err, _count) {
    t.error(err, 'should not error');
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.on(\'beforeCount\', cb)', function(t) {
  var hookTriggered = false;
  SimpleModel.on('beforeCount', function handler(query, opts) {
    SimpleModel.off('beforeCount', handler);
    t.deepEqual(
      query.query,
      { _: 'query' },
      'query is passed to event handler'
    );
    t.deepEqual(opts, { _: 'opts' }, 'opts is passed to event handler');
    hookTriggered = true;
  });
  SimpleModel.count({ _: 'query' }, { _: 'opts' }).count(function(err) {
    t.error(err, 'does not error');
    t.ok(hookTriggered, 'beforeCount hook is triggered');
    t.end();
  });
});

test('Model.on(\'afterCount\', cb)', function(t) {
  var count = testDriver.count.data = Math.floor(Math.random() * 100);
  var hookTriggered = false;
  SimpleModel.on('afterCount', function handler(_count, opts) {
    SimpleModel.off('afterCount', handler);
    t.equal(_count, count, 'count is passed to hook handler');
    t.deepEqual(opts, { _: 'opts' }, 'opts is passed to hook handler');
    hookTriggered = true;
  });
  SimpleModel.count({ _: 'query' }, { _: 'opts' }).count(function(err) {
    t.error(err, 'does not error');
    t.ok(hookTriggered, 'afterCount hook is triggered');
    t.end();
  });
});

test('Model.find(query, opts, cb)', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.find({ _: 'query' }, { _: 'opts' }, function(err, modelSet) {
    t.error(err, 'should not error');
    t.equal(
      testDriver.find.args[0],
      'simpleModels',
      'collectionName equals simpleModels'
    );
    t.deepEqual(
      testDriver.find.args[1],
      { _: 'opts' },
      'opts equals { _: \'opts\' }'
    );
    t.deepEqual(
      testDriver.find.args[2].query,
      { _: 'query' },
      'query.query equals { _: \'query\' }'
    );
    t.equal(
      modelSet.constructor,
      ModelSet,
      'modelSet is an instance of ModelSet'
    );
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.find(query, opts) -> modelStream', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  var rout = SimpleModel.find({ _: 'query' }, { _: 'opts' });
  t.equal(rout.constructor, ModelStream);
  rout.all(function(err, modelSet) {
    t.error(err);
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.find(query) -> modelStream', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.find({ _: 'query' }).all(function(err, modelSet) {
    t.error(err);
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.on(\'beforeFind\', cb)', function(t) {
  var hookTriggered = false;
  SimpleModel.on('beforeFind', function handler(query, opts) {
    SimpleModel.off('beforeFind', handler);
    t.deepEqual(
      query.query,
      { _: 'query' },
      'query is passed to the hook handler'
    );
    t.deepEqual(
      opts,
      { _: 'opts' },
      'opts is passed to the hook handler'
    );
    hookTriggered = true;
  });
  var rout = SimpleModel.find(
    { _: 'query' },
    { _: 'opts' },
    function(err, modelSet) {
      t.error(err);
      t.ok(hookTriggered, 'beforeFind hook is triggered');
      t.end();
    }
  );
});

test('Model.on(\'afterFind\', cb)', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  var i = 0;
  SimpleModel.on('afterFind', function handler(record, opts) {
    t.deepEqual(
      record,
      records[i],
      'each record is passed to the hook handler'
    );
    t.deepEqual(
      opts,
      { _: 'opts' },
      'opts is passed to the hook handler'
    );
    i += 1;
    if (i > 1) {
      SimpleModel.off('afterFind', handler);
    }
  });
  var rout = SimpleModel.find(
    { _: 'query' },
    { _: 'opts' },
    function(err, modelSet) {
      t.error(err);
      t.equal(i, 2, 'beforeFind hook is triggered');
      t.end();
    }
  );
});

test('Model.all(opts, cb)', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.all({ _: 'opts' }, function(err, modelSet) {
    t.error(err, 'should not error');
    t.equal(
      testDriver.find.args[0],
      'simpleModels',
      'collectionName equals simpleModels'
    );
    t.deepEqual(
      testDriver.find.args[1],
      { _: 'opts' },
      'opts equals { _: \'opts\' }'
    );
    t.deepEqual(
      testDriver.find.args[2].query,
      {},
      'query.query equals {}'
    );
    t.equal(
      modelSet.constructor,
      ModelSet,
      'modelSet is an instance of ModelSet'
    );
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.all(opts) -> modelStream', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  var rout = SimpleModel.all({ _: 'opts' });
  t.equal(rout.constructor, ModelStream);
  rout.all(function(err, modelSet) {
    t.error(err);
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.all() -> modelStream', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.all().all(function(err, modelSet) {
    t.error(err);
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.findOne(query, opts, cb)', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.findOne({ _: 'query' }, { _: 'opts' }, function(err, model) {
    t.error(err, 'should not error');
    t.equal(
      testDriver.find.args[0],
      'simpleModels',
      'collectionName equals simpleModels'
    );
    t.deepEqual(
      testDriver.find.args[1],
      { _: 'opts' },
      'opts equals { _: \'opts\' }'
    );
    t.deepEqual(
      testDriver.find.args[2].query,
      { _: 'query' },
      'query.query equals { _: \'query\' }'
    );
    t.deepEqual(
      testDriver.find.args[2].opts,
      { limit: 1 },
      'query.opts equals { limit: 1 }'
    );
    t.equal(
      model.constructor,
      SimpleModel,
      'model is an instance of Model'
    );
    t.deepEqual(model.record(), records[0], 'the first record is in the model');
    t.end();
  });
});

test('Model.findOne(query, opts) -> modelStream', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  var rout = SimpleModel.findOne({ _: 'query' }, { _: 'opts' });
  t.equal(rout.constructor, ModelStream);
  rout.first(function(err, model) {
    t.error(err);
    t.deepEqual(model.record(), records[0], 'the first record is in the model');
    t.end();
  });
});

test('Model.findOne(query) -> modelStream', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.findOne({ _: 'query' }).first(function(err, model) {
    t.error(err);
    t.deepEqual(model.record(), records[0], 'the first record is in the model');
    t.end();
  });
});

test('Model.findById(id, opts, cb)', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.findById('id', { _: 'opts' }, function(err, model) {
    t.error(err, 'should not error');
    t.equal(
      testDriver.find.args[0],
      'simpleModels',
      'collectionName equals simpleModels'
    );
    t.deepEqual(
      testDriver.find.args[1],
      { _: 'opts' },
      'opts equals { _: \'opts\' }'
    );
    t.deepEqual(
      testDriver.find.args[2].query,
      { id: 'id' },
      'query.query equals { id: \'id\' }'
    );
    t.deepEqual(
      testDriver.find.args[2].opts,
      { limit: 1 },
      'query.opts equals { limit: 1 }'
    );
    t.equal(
      model.constructor,
      SimpleModel,
      'model is an instance of Model'
    );
    t.deepEqual(model.record(), records[0], 'the first record is in the model');
    t.end();
  });
});

test('Model.findById(id, opts) -> modelStream', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  var rout = SimpleModel.findById('id', { _: 'opts' });
  t.equal(rout.constructor, ModelStream);
  rout.first(function(err, model) {
    t.error(err);
    t.deepEqual(model.record(), records[0], 'the first record is in the model');
    t.end();
  });
});

test('Model.findById(id) -> modelStream', function(t) {
  var records = testDriver.find.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.findById('id').first(function(err, model) {
    t.error(err);
    t.deepEqual(model.record(), records[0], 'the first record is in the model');
    t.end();
  });
});

test('Model.insert(records, opts, cb)', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.insert(records, { _: 'opts' }, function(err, modelSet) {
    t.error(err, 'should not error');
    t.equal(
      testDriver.insert.args[0],
      'simpleModels',
      'collectionName equals simpleModels'
    );
    t.deepEqual(
      testDriver.insert.args[1],
      { _: 'opts' },
      'opts equals { _: \'opts\' }'
    );
    t.equal(
      modelSet.constructor,
      ModelSet,
      'modelSet is an instance of ModelSet'
    );
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.insert(records, opts) -> modelStream', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  var rout = SimpleModel.insert(records, { _: 'opts' });
  t.equal(rout.constructor, ModelStream);
  rout.all(function(err, modelSet) {
    t.error(err);
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.insert(records) -> modelStream', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.insert(records).all(function(err, modelSet) {
    t.error(err);
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('stream -> Model.insert() -> modelStream', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  es.readArray(records).pipe(SimpleModel.insert()).all(function(err, modelSet) {
    t.error(err);
    t.deepEqual(modelSet.records(), records, 'records are in the modelSet');
    t.end();
  });
});

test('Model.on(\'beforeInsert\', cb)', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  var i = 0;
  SimpleModel.on('beforeInsert', function handler(record, opts) {
    t.deepEqual(
      record,
      records[i],
      'each record is passed to the hook handler'
    );
    t.deepEqual(
      opts,
      { _: 'opts' },
      'opts is passed to the hook handler'
    );
    i += 1;
    if (i > 1) {
      SimpleModel.off('beforeInsert', handler);
    }
  });
  SimpleModel.insert(records, { _: 'opts' }, function(err) {
    t.error(err);
    t.equal(i, 2, 'beforeInsert hook is triggered');
    t.end();
  });
});

test('Model.on(\'afterInsert\', cb)', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  var i = 0;
  SimpleModel.on('afterInsert', function handler(record, opts) {
    t.deepEqual(
      record,
      records[i],
      'each record is passed to the hook handler'
    );
    t.deepEqual(
      opts,
      { _: 'opts' },
      'opts is passed to the hook handler'
    );
    i += 1;
    if (i > 1) {
      SimpleModel.off('afterInsert', handler);
    }
  });
  SimpleModel.insert(records, { _: 'opts' }, function(err) {
    t.error(err);
    t.equal(i, 2, 'afterInsert hook is triggered');
    t.end();
  });
});

test('Model.create(record, opts, cb)', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.create(records[0], { _: 'opts' }, function(err, model) {
    t.error(err, 'should not error');
    t.equal(
      testDriver.insert.args[0],
      'simpleModels',
      'collectionName equals simpleModels'
    );
    t.deepEqual(
      testDriver.insert.args[1],
      { _: 'opts' },
      'opts equals { _: \'opts\' }'
    );
    t.equal(
      model.constructor,
      SimpleModel,
      'model is an instance of Model'
    );
    t.deepEqual(model.record(), records[0], 'the record is in the model');
    t.end();
  });
});

test('Model.create(record, opts) -> modelStream', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  var rout = SimpleModel.create(records[0], { _: 'opts' });
  t.equal(rout.constructor, ModelStream);
  rout.first(function(err, model) {
    t.error(err);
    t.deepEqual(model.record(), records[0], 'the record is in the model');
    t.end();
  });
});

test('Model.create(record) -> modelStream', function(t) {
  var records = testDriver.insert.data = [ { _: 'record1' }, { _: 'record2' } ];
  SimpleModel.create(records[0]).first(function(err, model) {
    t.error(err);
    t.deepEqual(model.record(), records[0], 'the record is in the model');
    t.end();
  });
});

test('Model.update(query, delta, opts, cb)', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  SimpleModel.update(
    { _: 'query' },
    { $set: { _: 'delta' } },
    { _: 'opts' },
    function(err, _count) {
      t.error(err, 'should not error');
      t.equal(
        testDriver.update.args[0],
        'simpleModels',
        'collectionName equals simpleModels'
      );
      t.deepEqual(
        testDriver.update.args[1],
        { _: 'opts' },
        'opts equals { _: \'opts\' }'
      );
      t.deepEqual(
        testDriver.update.args[2].query,
        { _: 'query' },
        'query.query equals { _: \'query\' }'
      );
      t.deepEqual(
        testDriver.update.args[3].diff,
        { $set: { _: 'delta' } },
        'delta.diff equals { $set: { _: \'delta\' } }'
      );
      t.equal(count, _count, 'count is correct');
      t.end();
    }
  );
});

test('Model.update(query, delta, opts) -> countStream', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  var cout = SimpleModel.update(
    { _: 'QUERY' },
    { $set: { _: 'delta' } },
    { _: 'OPT' }
  );
  t.equal(cout.constructor, CountStream);
  cout.count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.update(query, delta) -> countStream', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  SimpleModel.update(
    { _: 'QUERY' },
    { $set: { _: 'delta' } }
  ).count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.on(\'beforeUpdate\', cb)', function(t) {
  var hookTriggered = false;
  SimpleModel.on('beforeUpdate', function handler(query, delta, opts) {
    SimpleModel.off('beforeUpdate', handler);
    t.deepEqual(
      query.query,
      { _: 'query' },
      'query is passed to the hook handler'
    );
    t.deepEqual(
      delta.diff,
      { $set: { _: 'delta' } },
      'delta is passed to the hook handler'
    );
    t.deepEqual(
      opts,
      { _: 'opts' },
      'opts is passed to the hook handler'
    );
    hookTriggered = true;
  });
  SimpleModel.update(
    { _: 'query' },
    { $set: { _: 'delta' } },
    { _: 'opts' },
    function(err) {
      t.error(err);
      t.ok(hookTriggered, 'beforeUpdate hook is triggered');
      t.end();
    }
  );
});

test('Model.on(\'afterUpdate\', cb)', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  var hookTriggered = false;
  SimpleModel.on('afterUpdate', function handler(_count, opts) {
    SimpleModel.off('afterUpdate', handler);
    t.deepEqual(
      _count,
      count,
      'count is passed to the hook handler'
    );
    t.deepEqual(
      opts,
      { _: 'opts' },
      'opts is passed to the hook handler'
    );
    hookTriggered = true;
  });
  SimpleModel.update(
    { _: 'query' },
    { $set: { _: 'delta' } },
    { _: 'opts' },
    function(err) {
      t.error(err);
      t.ok(hookTriggered, 'beforeUpdate hook is triggered');
      t.end();
    }
  );
});

test('Model.updateOne(query, delta, opts, cb)', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  SimpleModel.updateOne(
    { _: 'query' },
    { $set: { _: 'delta' } },
    { _: 'opts' },
    function(err, _count) {
      t.error(err, 'should not error');
      t.equal(
        testDriver.update.args[0],
        'simpleModels',
        'collectionName equals simpleModels'
      );
      t.deepEqual(
        testDriver.update.args[1],
        { _: 'opts' },
        'opts equals { _: \'opts\' }'
      );
      t.deepEqual(
        testDriver.update.args[2].query,
        { _: 'query' },
        'query.query equals { _: \'query\' }'
      );
      t.deepEqual(
        testDriver.update.args[2].opts,
        { limit: 1 },
        'query.opts equals { limit: 1 }'
      );
      t.deepEqual(
        testDriver.update.args[3].diff,
        { $set: { _: 'delta' } },
        'delta.diff equals { $set: { _: \'delta\' } }'
      );
      t.equal(count, _count, 'count is correct');
      t.end();
    }
  );
});

test('Model.updateOne(query, delta, opts) -> countStream', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  var cout = SimpleModel.updateOne(
    { _: 'QUERY' },
    { $set: { _: 'delta' } },
    { _: 'OPT' }
  );
  t.equal(cout.constructor, CountStream);
  cout.count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.updateOne(query, delta) -> countStream', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  SimpleModel.updateOne(
    { _: 'QUERY' },
    { $set: { _: 'delta' } }
  ).count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.updateById(id, delta, opts, cb)', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  SimpleModel.updateById(
    'id',
    { $set: { _: 'delta' } },
    { _: 'opts' },
    function(err, _count) {
      t.error(err, 'should not error');
      t.equal(
        testDriver.update.args[0],
        'simpleModels',
        'collectionName equals simpleModels'
      );
      t.deepEqual(
        testDriver.update.args[1],
        { _: 'opts' },
        'opts equals { _: \'opts\' }'
      );
      t.deepEqual(
        testDriver.update.args[2].query,
        { id: 'id' },
        'query.query equals { id: \'id\' }'
      );
      t.deepEqual(
        testDriver.update.args[2].opts,
        { limit: 1 },
        'query.opts equals { limit: 1 }'
      );
      t.deepEqual(
        testDriver.update.args[3].diff,
        { $set: { _: 'delta' } },
        'delta.diff equals { $set: { _: \'delta\' } }'
      );
      t.equal(count, _count, 'count is correct');
      t.end();
    }
  );
});

test('Model.updateById(id, delta, opts) -> countStream', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  var cout = SimpleModel.updateById(
    'id',
    { $set: { _: 'delta' } },
    { _: 'OPT' }
  );
  t.equal(cout.constructor, CountStream);
  cout.count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.updateById(query, delta) -> countStream', function(t) {
  var count = testDriver.update.data = Math.floor(Math.random() * 100);
  SimpleModel.updateById(
    'id',
    { $set: { _: 'delta' } }
  ).count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.remove(query, opts, cb)', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  SimpleModel.remove(
    { _: 'query' },
    { _: 'opts' },
    function(err, _count) {
      t.error(err, 'should not error');
      t.equal(
        testDriver.remove.args[0],
        'simpleModels',
        'collectionName equals simpleModels'
      );
      t.deepEqual(
        testDriver.remove.args[1],
        { _: 'opts' },
        'opts equals { _: \'opts\' }'
      );
      t.deepEqual(
        testDriver.remove.args[2].query,
        { _: 'query' },
        'query.query equals { _: \'query\' }'
      );
      t.equal(count, _count, 'count is correct');
      t.end();
    }
  );
});

test('Model.remove(query, opts) -> countStream', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  var cout = SimpleModel.remove(
    { _: 'QUERY' },
    { _: 'OPT' }
  );
  t.equal(cout.constructor, CountStream);
  cout.count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.remove(query) -> countStream', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  SimpleModel.remove(
    { _: 'QUERY' }
  ).count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.on(\'beforeRemove\', cb)', function(t) {
  var hookTriggered = false;
  SimpleModel.on('beforeRemove', function handler(query, opts) {
    SimpleModel.off('beforeRemove', handler);
    t.deepEqual(
      query.query,
      { _: 'query' },
      'query is passed to the hook handler'
    );
    t.deepEqual(
      opts,
      { _: 'opts' },
      'opts is passed to the hook handler'
    );
    hookTriggered = true;
  });
  SimpleModel.remove(
    { _: 'query' },
    { _: 'opts' },
    function(err) {
      t.error(err);
      t.ok(hookTriggered, 'beforeRemove hook is triggered');
      t.end();
    }
  );
});

test('Model.on(\'afterRemove\', cb)', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  var hookTriggered = false;
  SimpleModel.on('afterRemove', function handler(_count, opts) {
    SimpleModel.off('afterRemove', handler);
    t.deepEqual(
      _count,
      count,
      'count is passed to the hook handler'
    );
    t.deepEqual(
      opts,
      { _: 'opts' },
      'opts is passed to the hook handler'
    );
    hookTriggered = true;
  });
  SimpleModel.remove(
    { _: 'query' },
    { _: 'opts' },
    function(err) {
      t.error(err);
      t.ok(hookTriggered, 'afterRemove hook is triggered');
      t.end();
    }
  );
});

test('Model.removeOne(query, opts, cb)', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  SimpleModel.removeOne(
    { _: 'query' },
    { _: 'opts' },
    function(err, _count) {
      t.error(err, 'should not error');
      t.equal(
        testDriver.remove.args[0],
        'simpleModels',
        'collectionName equals simpleModels'
      );
      t.deepEqual(
        testDriver.remove.args[1],
        { _: 'opts' },
        'opts equals { _: \'opts\' }'
      );
      t.deepEqual(
        testDriver.remove.args[2].query,
        { _: 'query' },
        'query.query equals { _: \'query\' }'
      );
      t.deepEqual(
        testDriver.remove.args[2].opts,
        { limit: 1 },
        'query.opts equals { limit: 1 }'
      );
      t.equal(count, _count, 'count is correct');
      t.end();
    }
  );
});

test('Model.removeOne(query, opts) -> countStream', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  var cout = SimpleModel.removeOne(
    { _: 'QUERY' },
    { _: 'OPT' }
  );
  t.equal(cout.constructor, CountStream);
  cout.count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.removeOne(query) -> countStream', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  SimpleModel.removeOne(
    { _: 'QUERY' }
  ).count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.removeById(id, opts, cb)', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  SimpleModel.removeById(
    'id',
    { _: 'opts' },
    function(err, _count) {
      t.error(err, 'should not error');
      t.equal(
        testDriver.remove.args[0],
        'simpleModels',
        'collectionName equals simpleModels'
      );
      t.deepEqual(
        testDriver.remove.args[1],
        { _: 'opts' },
        'opts equals { _: \'opts\' }'
      );
      t.deepEqual(
        testDriver.remove.args[2].query,
        { id: 'id' },
        'query.query equals { id: \'id\' }'
      );
      t.deepEqual(
        testDriver.remove.args[2].opts,
        { limit: 1 },
        'query.opts equals { limit: 1 }'
      );
      t.equal(count, _count, 'count is correct');
      t.end();
    }
  );
});

test('Model.removeById(id, delta, opts) -> countStream', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  var cout = SimpleModel.removeById('id', { _: 'OPT' });
  t.equal(cout.constructor, CountStream);
  cout.count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.removeById(query) -> countStream', function(t) {
  var count = testDriver.remove.data = Math.floor(Math.random() * 100);
  SimpleModel.removeById('id').count(function(err, _count) {
    t.error(err);
    t.equal(count, _count, 'count is correct');
    t.end();
  });
});

test('Model.hasOne(modelName, opts)', function(t) {
  SimpleModel.hasOne('RelatedModel', {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath'
  });

  t.deepEqual(SimpleModel.relations.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'oneToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct relation');

  t.deepEqual(RelatedModel.references.SimpleModel.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'oneToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct reference');

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.hasOne(modelName, path)', function(t) {
  SimpleModel.hasOne('RelatedModel', 'path');

  t.deepEqual(SimpleModel.relations.pathId, {
    keyPath: 'pathId',
    fieldPath: 'path',
    type: 'oneToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct relation');

  t.deepEqual(RelatedModel.references.SimpleModel.pathId, {
    keyPath: 'pathId',
    fieldPath: 'path',
    type: 'oneToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct reference');

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.hasOne(modelName)', function(t) {
  SimpleModel.hasOne('RelatedModel');

  t.deepEqual(SimpleModel.relations.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  });

  t.deepEqual(RelatedModel.references.SimpleModel.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  });

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.hasMany(modelName, opts)', function(t) {
  SimpleModel.hasMany('RelatedModel', {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath'
  });

  t.deepEqual(SimpleModel.relations.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'oneToMany',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  });

  t.deepEqual(RelatedModel.references.SimpleModel.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'oneToMany',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  });

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.hasMany(modelName, path)', function(t) {
  SimpleModel.hasMany('RelatedModel', 'paths');

  t.deepEqual(SimpleModel.relations.pathIds, {
    keyPath: 'pathIds',
    fieldPath: 'paths',
    type: 'oneToMany',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  });

  t.deepEqual(RelatedModel.references.SimpleModel.pathIds, {
    keyPath: 'pathIds',
    fieldPath: 'paths',
    type: 'oneToMany',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  });

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.hasMany(modelName)', function(t) {
  SimpleModel.hasMany('RelatedModel');

  t.deepEqual(SimpleModel.relations.relatedModelIds, {
    keyPath: 'relatedModelIds',
    fieldPath: 'relatedModels',
    type: 'oneToMany',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  });

  t.deepEqual(RelatedModel.references.SimpleModel.relatedModelIds, {
    keyPath: 'relatedModelIds',
    fieldPath: 'relatedModels',
    type: 'oneToMany',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  });

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.manyHaveOne(modelName, opts)', function(t) {
  SimpleModel.manyHaveOne('RelatedModel', {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath'
  });

  t.deepEqual(SimpleModel.relations.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'manyToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModels'
  });

  t.deepEqual(RelatedModel.references.SimpleModel.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'manyToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModels'
  });

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.manyHaveOne(modelName, path)', function(t) {
  SimpleModel.manyHaveOne('RelatedModel', 'path');

  t.deepEqual(SimpleModel.relations.pathId, {
    keyPath: 'pathId',
    fieldPath: 'path',
    type: 'manyToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModels'
  });

  t.deepEqual(RelatedModel.references.SimpleModel.pathId, {
    keyPath: 'pathId',
    fieldPath: 'path',
    type: 'manyToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModels'
  });

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.manyHaveOne(modelName)', function(t) {
  SimpleModel.manyHaveOne('RelatedModel');

  t.deepEqual(SimpleModel.relations.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'manyToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModels'
  });

  t.deepEqual(RelatedModel.references.SimpleModel.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'manyToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModels'
  });

  SimpleModel.relations = {};
  RelatedModel.references = {};

  t.end();
});

test('Model.belongsToOne(modelName, opts)', function(t) {
  SimpleModel.belongsToOne('RelatedModel', {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath'
  });

  t.deepEqual(RelatedModel.relations.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'oneToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'oneToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});

test('Model.belongsToOne(modelName, path)', function(t) {
  SimpleModel.belongsToOne('RelatedModel', 'path');

  t.deepEqual(RelatedModel.relations.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'path'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'path'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});

test('Model.belongsToOne(modelName)', function(t) {
  SimpleModel.belongsToOne('RelatedModel');

  t.deepEqual(RelatedModel.relations.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});

test('Model.belongsToMany(modelName, opts)', function(t) {
  SimpleModel.belongsToMany('RelatedModel', {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath'
  });

  t.deepEqual(RelatedModel.relations.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'oneToMany',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModels'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'oneToMany',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModels'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});

test('Model.belongsToMany(modelName, path)', function(t) {
  SimpleModel.belongsToMany('RelatedModel', 'paths');

  t.deepEqual(RelatedModel.relations.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToMany',
    modelName: 'RelatedModel',
    foreignFieldPath: 'paths'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToMany',
    modelName: 'SimpleModel',
    foreignFieldPath: 'paths'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});

test('Model.belongsToMany(modelName)', function(t) {
  SimpleModel.belongsToMany('RelatedModel');

  t.deepEqual(RelatedModel.relations.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToMany',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModels'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.relatedModelId, {
    keyPath: 'relatedModelId',
    fieldPath: 'relatedModel',
    type: 'oneToMany',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModels'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});


test('Model.manyBelongToOne(modelName, opts)', function(t) {
  SimpleModel.manyBelongToOne('RelatedModel', {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath'
  });

  t.deepEqual(RelatedModel.relations.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'manyToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.keyPath, {
    keyPath: 'keyPath',
    fieldPath: 'fieldPath',
    type: 'manyToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});

test('Model.manyBelongToOne(modelName, path)', function(t) {
  SimpleModel.manyBelongToOne('RelatedModel', 'paths');

  t.deepEqual(RelatedModel.relations.relatedModelIds, {
    keyPath: 'relatedModelIds',
    fieldPath: 'relatedModels',
    type: 'manyToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'paths'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.relatedModelIds, {
    keyPath: 'relatedModelIds',
    fieldPath: 'relatedModels',
    type: 'manyToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'paths'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});

test('Model.manyBelongToOne(modelName)', function(t) {
  SimpleModel.manyBelongToOne('RelatedModel');

  t.deepEqual(RelatedModel.relations.relatedModelIds, {
    keyPath: 'relatedModelIds',
    fieldPath: 'relatedModels',
    type: 'manyToOne',
    modelName: 'RelatedModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct relation');

  t.deepEqual(SimpleModel.references.RelatedModel.relatedModelIds, {
    keyPath: 'relatedModelIds',
    fieldPath: 'relatedModels',
    type: 'manyToOne',
    modelName: 'SimpleModel',
    foreignFieldPath: 'simpleModel'
  }, 'sets up the correct reference');

  RelatedModel.relations = {};
  SimpleModel.references = {};

  t.end();
});

test('Model.idKey()', function(t) {
  var _idKey = merlin.opts.idKey;
  merlin.opts.idKey = 'key';
  t.equal(SimpleModel.idKey(), 'key');
  merlin.opts.idKey = _idKey;
  t.end();
});

test('Model.pluralForeignKey()', function(t) {
  var _pluralForeignKey = merlin.opts.pluralForeignKey;
  merlin.opts.pluralForeignKey = '{modelName}Keys';
  t.equal(SimpleModel.pluralForeignKey(), 'simpleModelKeys');
  merlin.opts.pluralForeignKey = _pluralForeignKey;
  t.end();
});

test('Model.singularForeignKey()', function(t) {
  var _singularForeignKey = merlin.opts.singularForeignKey;
  merlin.opts.singularForeignKey = '{modelName}Key';
  t.equal(SimpleModel.singularForeignKey(), 'simpleModelKey');
  merlin.opts.singularForeignKey = _singularForeignKey;
  t.end();
});

