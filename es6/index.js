var jsforce = require('jsforce')
  , Promise = require('bluebird')
  , _ = require('lodash');

var oneHourMillis = 1000 * 60 * 60;

module.exports = class VSForce {

  constructor(config) {
    if(!config || !config.Endpoint || !config.SecurityToken || !config.Password || !config.Username){
      throw new Error('Missing SalesForce credentials');
    }
    this.connectionCount = 0;
    this.config = _.extend({
      min: 1,
      max: 8,
      timeout: oneHourMillis
    }, config);
    this.pool = [];
    this.queue = [];
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
      return this.queue();
    }

    // Get first pool connection
    var resource = this.pool.shift();

    // If it's valid, use that connection
    if(this.isValid(resource)) return resource;

    // If it's not, recurse (pool length should be shorter)
    return this.aquire();
  }

  create() {

    console.log('Creating new connection');
    this.conn = new jsforce.Connection({
      loginUrl: this.config.Endpoint,
      accessToken: this.config.SecurityToken
    });

    this.conn.query = Promise.promisify(this.conn.query, this.conn);
    this.conn.login = Promise.promisify(this.conn.login, this.conn);

    return this.conn.login(this.config.Username, this.config.Password + this.config.SecurityToken)
      .then(() => {

        for(var prop in this.conn){
          console.log("PROPERTY", prop);
        }
        this.conn._initializedAt = Date.now();
        this.connectionCount++;
        return this.conn;
      })
      .disposer((conn) => this.release(conn));
  }

  queue(){
    return new Promise(function(resolve, reject){
      this.queue.push({resolve,reject});
    });
  }

  release(conn){
    console.log('Releasing connection');

    // No waiting connections. Release to the pool.
    if(!this.queue.length) return this.pool.push(conn);

    // Resolve waiting promise with last connection
    var promise = this.queue.shift();
    promise.resolve(conn);
  }

  destroy(conn){
    console.log('Destroying connection');
    return new Promise((resolve, reject) => {
      this.conn.logout((err) =>  {
        if (err) return reject(err);
        this.connectionCount--;
        resolve(true);
      });
    });
  }

  isValid(conn){
    var dur = Date.now() - conn._initializedAt;

    console.log('Duration of connection: '+calcDur+' hours');

    // Connection still valid, don't renew
    if(dur>this.config.timeout){
      this.destroy(conn)
      return false;
    }
    return true;
  }


  /**
   * getConnection
   * @returns {promise|*|Function|promise|promise|promise}
   */
  getConnection() {
    return Promise.using(this.aquire());
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
    return this.getConnection()
      .then((conn) => conn[fnName](arg));
  }
}
