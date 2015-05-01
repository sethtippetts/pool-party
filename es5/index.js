'use strict';

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var jsforce = require('jsforce'),
    Promise = require('bluebird'),
    _ = require('lodash');

var oneHourMillis = 1000 * 60 * 60;

module.exports = (function () {
  function VSForce(config) {
    _classCallCheck(this, VSForce);

    if (!config || !config.Endpoint || !config.SecurityToken || !config.Password || !config.Username) {
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

  _createClass(VSForce, [{
    key: 'acquire',

    /**
     * PoolParty.acquire
     * @return {Disposer} [description]
     */
    value: function acquire() {

      // No available connections
      if (!this.pool.length) {

        // Creating new connection
        if (this.connectionCount < this.config.max) {
          return this.create();
        } // Maxed out connections, adding to queue
        return this.queue();
      }

      // Get first pool connection
      var resource = this.pool.shift();

      // If it's valid, use that connection
      if (this.isValid(resource)) {
        return resource;
      } // If it's not, recurse (pool length should be shorter)
      return this.aquire();
    }
  }, {
    key: 'create',
    value: function create() {
      var _this = this;

      console.log('Creating new connection');
      this.conn = new jsforce.Connection({
        loginUrl: this.config.Endpoint,
        accessToken: this.config.SecurityToken
      });

      this.conn.query = Promise.promisify(this.conn.query, this.conn);
      this.conn.login = Promise.promisify(this.conn.login, this.conn);

      return this.conn.login(this.config.Username, this.config.Password + this.config.SecurityToken).then(function () {

        for (var prop in _this.conn) {
          console.log('PROPERTY', prop);
        }
        _this.conn._initializedAt = Date.now();
        _this.connectionCount++;
        return _this.conn;
      }).disposer(function (conn) {
        return _this.release(conn);
      });
    }
  }, {
    key: 'queue',
    value: function queue() {
      return new Promise(function (resolve, reject) {
        this.queue.push({ resolve: resolve, reject: reject });
      });
    }
  }, {
    key: 'release',
    value: function release(conn) {
      console.log('Releasing connection');

      // No waiting connections. Release to the pool.
      if (!this.queue.length) {
        return this.pool.push(conn);
      } // Resolve waiting promise with last connection
      var promise = this.queue.shift();
      promise.resolve(conn);
    }
  }, {
    key: 'destroy',
    value: function destroy(conn) {
      var _this2 = this;

      console.log('Destroying connection');
      return new Promise(function (resolve, reject) {
        _this2.conn.logout(function (err) {
          if (err) return reject(err);
          _this2.connectionCount--;
          resolve(true);
        });
      });
    }
  }, {
    key: 'isValid',
    value: function isValid(conn) {
      var dur = Date.now() - conn._initializedAt;

      console.log('Duration of connection: ' + calcDur + ' hours');

      // Connection still valid, don't renew
      if (dur > this.config.timeout) {
        this.destroy(conn);
        return false;
      }
      return true;
    }
  }, {
    key: 'getConnection',

    /**
     * getConnection
     * @returns {promise|*|Function|promise|promise|promise}
     */
    value: function getConnection() {
      return Promise.using(this.aquire());
    }
  }, {
    key: 'query',

    /**
     * PoolParty.query
     * @param  {SOQL Query} arg
     * @return {Promise}
     */
    value: function query(arg) {
      return this._wrap('query', arg);
    }
  }, {
    key: 'sobject',
    value: function sobject(arg) {
      return this._wrap('sobject', arg);
    }
  }, {
    key: '_wrap',
    value: function _wrap(fnName, arg) {
      return this.getConnection().then(function (conn) {
        return conn[fnName](arg);
      });
    }
  }]);

  return VSForce;
})();