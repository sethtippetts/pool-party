var Promise = require('bluebird')
  , _ = require('lodash');

var oneHourMillis = 1000 * 60 * 60;

module.exports = class PoolParty {

  constructor(config) {
    if(typeof config.factory !== 'function'){
      throw new Error('Pool party requires a factory. Gotta invite the cool kids!');
    }
    this.connectionCount = 0;
    this.config = _.extend({
      min: 1,
      max: 2,
      timeout: oneHourMillis,
      validate: function(){return true;}
    }, config);

    this.highWater = 0;
    this.pool = [];
    this.queue = [];
    setInterval(() => console.log('Connections: %d, Pool: %d, Queue: %d, Highwater: %d', this.connectionCount, this.pool.length, this.queue.length, this.highWater), 10000);
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

  drain(count=1){

    // Check if less that 75% of connections in use
    var isLowTide = this.connectionCount - this.pool.length  < this.connectionCount * 0.75;

    if(isLowTide){

      // Destroy connection
      this.pool.pop().then((conn) => this.destroy(conn));
    }
    return isLowTide;
  }

  create() {

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
    return new Promise((resolve, reject) => {
      this.queue.push({resolve,reject});
    });
  }

  release(conn){
    // No waiting connections. Release to the pool.
    if(!this.queue.length) {
      return this.drain() || this.pool.push(conn);
    }

    // Resolve waiting promise with last connection
    var promise = this.queue.shift();
    promise.resolve(conn);
  }

  destroy(conn){
    --this.connectionCount;
    // --this.highWater;
    return this.config.destroy(conn).catch(function(){})
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

  /**
   * PoolParty.query
   * @param  {SOQL Query} arg
   * @return {Promise}
   */
  query(arg) {
    return this._wrap('query', arg);
  }
  sobject(arg) {
    return this._wrap('sobject', arg);
  }
  _wrap(fnName, arg) {
    var connection = this.acquire();
    return Promise.using(connection.disposer(() => {
        this.release(connection);
      }), function(conn){
        return conn[fnName](arg);
      });
  }
};
