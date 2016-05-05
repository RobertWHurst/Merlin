const DocumentCache = require('./document-cache');


class Document {

  constructor() {
    this.__$       = {};
    this.__$.cache = {};
  }

  set(obj, includeCache) {
    const rec = (ctx, obj) => {
      for (let prop in obj) {
        if (obj[prop] instanceof Object) {
          if (!(ctx[prop] instanceof Object)) { ctx[prop] = {}; }
          rec(ctx[prop], obj[prop]);
        }
      }
    };
    rec(this, obj);
  }

  getDelta() {

  }
}


module.exports = Document;
