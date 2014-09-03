
var guard = require('type-guard');


/**
 * Hook handler constructor
 */
function HookHub() {
  var self = this;
  self._hookHandlers = {};
}


HookHub.prototype.getHookHandlers = function(hookName) {
  var self = this;

  guard('hookName', hookName, [ 'undefined', 'string' ]);

  if (typeof hookName == 'string') {
    return self._hookHandlers[hookName] || null;
  } else {
    var hookHandlers = [];
    for (var hookName in self._hookHandlers) {
      hookHandlers.push.apply(hookHandlers, self.getHookHandlers(hookName));
    }
    return hookHandlers;
  }
};


// TODO: Remove this confusing function
HookHub.prototype.forEachHookHandler = function(hookName, worker, cb) {
  var self = this;

  if (typeof hookName == 'function') {
    cb = worker;
    worker = hookName;
    hookName = null;
  }

  // validate
  guard('hookName', hookName, [ 'null', 'string' ]);
  guard('worker', worker, [ 'function' ]);
  guard('cb', cb, [ 'undefined', 'function' ]);

  var async = false;
  if (cb && worker.length > 1) {
    async = true;
  }

  if (typeof hookName == 'string') {
    var handlers = self._hookHandlers[hookName];
    if (handlers) {
      if (async) {
        (function rec(i, cb) {
          worker(handlers[i], function(err) {
            if (err && i > 0) { i = 0; return cb(err); }
            i += 1;
            if (i < handlers.length) {
              rec(i, cb);
            } else {
              cb(null);
            }
          });
        })(0, cb);
      } else {
        for (var i = 0; i < handlers.length; i += 1) {
          worker(handlers[i]);
        }
      }
    }
  } else {
    if (async) {
      (function rec(i, cb) {
        self.forEachHookHandler(hookName, worker, function(err) {
          if (err && i > 0) { i = 0; return cb(err); }
          i += 1;
          if (i < handlers.length) {
            rec(i, cb);
          } else {
            cb(null);
          }
        });
      })(0, cb);
    } else {
      for (var hookName in self._hookHandlers) {
        self.forEachHookHandler(hookName, worker);
      }
    }
  }
};

/**
 * Add a handler to a hook.
 * @param {String}   hookName Hook name.
 * @param {Function} handler  Hook handler.
 */
HookHub.prototype.addHookHandler = function(hookName, handler) {
  var self = this;

  // validate
  guard('hookName', hookName, 'string');
  guard('handler', handler, 'function');

  // add the handler
  if (!self._hookHandlers[hookName]) { self._hookHandlers[hookName] = []; }
  self._hookHandlers[hookName].push(handler);
};
HookHub.prototype.on = HookHub.prototype.addHookHandler;

/**
 * Remove a handler from a hook.
 * @param {String}   hookName Hook name.
 * @param {Function} handler  Hook handler.
 */
HookHub.prototype.removeHookHandler = function(hookName, handler) {
  var self = this;

  // validate
  guard('hookName', hookName, 'string');
  guard('handler', handler, 'function');

  // remove the handler
  if (!self._hookHandlers[hookName]) { return false; }
  var index = self._hookHandlers[hookName].indexOf(handler);
  if (index === -1) { return false; }
  self._hookHandlers[hookName].splice(index, 1);
  if (self._hookHandlers[hookName].length < 1) {
    delete self._hookHandlers[hookName];
  }
  return true;
};
HookHub.prototype.off = HookHub.prototype.removeHookHandler;

/**
 * Run a hook and call all bound handlers
 * @param {String}   hookName Hook name.
 * @param {...}      arg      Hook arguments.
 * @param {Function} cb       Executed upon hook completion.
 */
HookHub.prototype.triggerHook = function(hookName) {
  var self = this;

  // validate
  guard('hookName', hookName, 'string');

  // grab the hook args
  var args = Array.prototype.slice.apply(arguments, [ 1 ]);

  // grab the cb if present
  var cb = function(err) { if (err) { throw err; } };
  var asyncAllowed = false;
  if (typeof args[args.length - 1] == 'function') {
    cb = args.pop();
    asyncAllowed = true;
  }

  // grab the handlers
  if (!self._hookHandlers[hookName]) { return cb(null); }
  var handlers = self._hookHandlers[hookName].slice(0);

  // create a recusive loop to run each hook
  (function rec(i, cb) {
    var handler = handlers[i];

    // create a function for calling the next hook
    // handler.
    var next = function(err) {
      if (err) { return cb(err); }
      if (i < handlers.length - 1) {
        rec(i + 1, cb);
      } else {
        cb(null);
      }
    };

    // if the handler args length is greater than
    // the handler length, then add a callback.
    if (asyncAllowed && handler.length > args.length) {
      handler.apply(self, args.concat(next));
    } else {
      try { handler.apply(self, args); }
      catch (err) { return next(err); }
      next(null);
    }
  })(0, cb);
};
HookHub.prototype.emit = HookHub.prototype.triggerHook;


module.exports = HookHub;
