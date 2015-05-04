var Promise = require('bluebird')
  , debug = require('debug')('pool-party');

var oneHourMillis = 1000 * 60 * 60;

module.exports = class PoolParty {

  constructor({
      min       = 1,
      max       = 8,
      timeout   = oneHourMillis,
      validate  = () => true,
      decorate  = [],
      factory   = null,
      destroy   = null
    } = {}) {

    this.config = {
      min,
      max,
      timeout,
      validate,
      decorate,
      destroy,
      factory
    };

    if(typeof this.config.factory !== 'function'){
      throw new Error('Pool party requires a factory. Gotta invite the cool kids!');
    }
    this.connectionCount = 0;

    this.config.decorate.forEach((method) => {
      this[method] = (arg) => {
        return this.decorate.call(this, method, arg);
      };
    });

    this.highWater = 0;
    this.pool = [];
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
        return fn.bind(conn, conn)();
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
      if(this.connectionCount < this.config.max) return this.create();

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

    // Check if less that 75% of connections in use
    var isLowTide = this.connectionCount - this.pool.length  < this.connectionCount * 0.75;

    if(isLowTide){

      // Destroy connection
      this.pool.pop().then((conn) => this.destroy(conn));
    }
    return isLowTide;
  }

  create() {
    debug('Creating connection. Connection count: %d', this.connectionCount+1);
    // Increment connection count and update highwater-mark
    if(this.highWater < ++this.connectionCount){
      this.highWater = this.connectionCount;
    }
    return this.config.factory()
      .then((resource) => {
        resource._initializedAt = Date.now();
        return resource;
      })
      .catch(function(){
        this.connectionCount--;
      });
  }

  enqueue(){
    debug('Queueing connection.');
    return new Promise((resolve, reject) => {
      this.queue.push({resolve,reject});
    });
  }

  release(conn){

    // No waiting connections. Release to the pool.
    if(!this.queue.length) {
      debug('Releasing connection.');
      return this.drain() || this.pool.push(conn);
    }

    debug('Resolving queued promise.');
    // Resolve waiting promise with last connection
    var promise = this.queue.shift();
    promise.resolve(conn);
  }

  destroy(conn){
    debug('Destroying connection.');
    --this.connectionCount;
    // --this.highWater;
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
