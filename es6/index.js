var Promise = require('bluebird')
  , debug = require('debug')('pool-party');

require("babel").transform("code", { optional: ["runtime"] });

module.exports = class PoolParty {

  constructor({
      min       = 1,
      max       = 8,
      highWater = 0.75,
      timeout   = 1000 * 60 * 60,
      validate  = () => true,
      decorate  = [],
      factory   = null,
      destroy   = null,
    } = {}) {

    if (highWater > 1) highWater = 1;
    if (highWater < min / max) highWater = min / max;

    this.config = {
      min,
      max,
      highWater,
      timeout,
      validate,
      decorate,
      destroy,
      factory,
    };

    if(typeof this.config.factory !== 'function'){
      throw new Error('Pool party requires a factory. Gotta invite the cool kids!');
    }

    this.config.decorate.forEach((method) => {
      this[method] = (arg) => {
        return this.decorate.call(this, method, arg);
      };
    });

    // Highest number of active connections
    this.highWater = 0;

    // List of promised connections
    this.connections = new Set();

    // List of inactive promised connections
    this.pool = [];

    // List of unfufilled requests
    this.queue = [];
    debug('Pool party started. Max connections: %d', this.config.max);
  }

  decorate(fnName, args){
    debug('Decorating connection method "%s"', fnName);
    var connection = this.acquire();
    return Promise.using(connection.disposer(() => {
        this.release(connection);
      }), function(conn){
        debug('Connecting via decorated method "%s"', fnName);
        return conn[fnName](args);
    });
  }

  connect(fn){
    debug('Connecting via #connect helper');
    var connection = this.acquire();
    return Promise.using(connection.disposer(() => {
        this.release(connection);
      }), function(conn){
        if(fn) return fn.bind(conn, conn)();
        return conn;
    });
  }

  /**
   * PoolParty.acquire
   * @return {Disposer} [description]
   */
  acquire(){

    // No available connections
    if(!this.pool.length){
      // Creating new connection
      if(this.connections.size < this.config.max) return this.create();

      // Maxed out connections, adding to queue
      return this.enqueue();
    }

    // Get first pool connection
    var resource = this.pool.shift();

    // If it's valid, use that connection
    if(this.isValid(resource)) {
      return resource;
    }

    // If it's not, recurse (pool length should be shorter)
    return this.acquire();
  }

  drain(){
    // TODO, drain all connections
  }

  create() {

    var createPromise = this.config.factory();
    this.connections.add(createPromise);

    debug('Creating connection. Connection count: %d', this.connections.size);

    // Increment connection count and update highwater-mark
    if(this.highWater < this.connections.size){
      this.highWater = this.connections.size;
    }
    return createPromise
      .then((resource) => {
        resource._initializedAt = Date.now();

        this.connections.add(resource);
        this.connections.delete(createPromise);
        return resource;
      })
      .catch(() => {
        createPromise.then(function(conn){
          this.destroy(conn);
        });
      });
  }

  enqueue(){
    debug('Queueing connection.');
    return new Promise((resolve, reject) => {
      this.queue.push({resolve,reject});
    });
  }

  release(conn){

    // Resolve waiting promise with last connection
    if(this.queue.length) return this.queue.shift().resolve(conn);

    // Check if highWater is higher than config says to keep
    if(this.connections.size - this.pool.length > this.highWater * this.config.highWater) {
      debug('Draining connection.');
      return conn.then((_conn) => this.destroy(_conn));
    }

    // No waiting connections. Release to the pool.
    debug('Releasing connection to pool.');
    return this.pool.push(conn);
  }

  destroy(conn){
    debug('Destroying connection.');
    this.connections.delete(conn);
    return this.config.destroy(conn).catch(function(){});
  }

  isValid(conn){
    var dur = Date.now() - conn._initializedAt;

    if(dur>this.config.timeout){
      this.destroy(conn);
      return false;
    }

    // Connection still valid, don't renew
    return this.config.validate(conn);
  }
};
