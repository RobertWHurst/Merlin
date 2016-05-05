

class Driver {

  constructor() {
    this.isConnected = false;
  }

  connect(url, opts, cb) {
    throw new Error('driver must implement connect');
  }

  disconnect(cb) {
    throw new Error('driver must implement disconnect');
  }
}


module.exports = Driver;
