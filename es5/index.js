'use strict';

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var Promise = require('bluebird'),
    _ = require('lodash');

var oneHourMillis = 1000 * 60 * 60;

module.exports = (function () {
  function PoolParty(config) {
    var _this = this;

    _classCallCheck(this, PoolParty);

    if (typeof config.factory !== 'function') {
      throw new Error('Pool party requires a factory. Gotta invite the cool kids!');
    }
    this.connectionCount = 0;
    this.config = _.extend({
      min: 1,
      max: 2,
      timeout: oneHourMillis,
      validate: function validate() {
        return true;
      }
    }, config);

    this.highWater = 0;
    this.pool = [];
    this.queue = [];
    setInterval(function () {
      return console.log('Connections: %d, Pool: %d, Queue: %d, Highwater: %d', _this.connectionCount, _this.pool.length, _this.queue.length, _this.highWater);
    }, 10000);
  }

  _createClass(PoolParty, [{
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
        return this.enqueue();
      }

      // Get first pool connection
      var resource = this.pool.shift();

      // If it's valid, use that connection
      if (this.isValid(resource)) {
        return resource;
      }

      // If it's not, recurse (pool length should be shorter)
      return this.acquire();
    }
  }, {
    key: 'drain',
    value: function drain() {
      var _this2 = this;

      var count = arguments[0] === undefined ? 1 : arguments[0];

      // Check if less that 75% of connections in use
      var isLowTide = this.connectionCount - this.pool.length < this.connectionCount * 0.75;

      if (isLowTide) {

        // Destroy connection
        this.pool.pop().then(function (conn) {
          return _this2.destroy(conn);
        });
      }
      return isLowTide;
    }
  }, {
    key: 'create',
    value: function create() {

      // Increment connection count and update highwater-mark
      if (this.highWater < ++this.connectionCount) {
        this.highWater = this.connectionCount;
      }
      return this.config.factory().then(function (resource) {
        resource._initializedAt = Date.now();
        return resource;
      })['catch'](function () {
        this.connectionCount--;
      });
    }
  }, {
    key: 'enqueue',
    value: function enqueue() {
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        _this3.queue.push({ resolve: resolve, reject: reject });
      });
    }
  }, {
    key: 'release',
    value: function release(conn) {
      // No waiting connections. Release to the pool.
      if (!this.queue.length) {
        return this.drain() || this.pool.push(conn);
      }

      // Resolve waiting promise with last connection
      var promise = this.queue.shift();
      promise.resolve(conn);
    }
  }, {
    key: 'destroy',
    value: function destroy(conn) {
      --this.connectionCount;
      // --this.highWater;
      return this.config.destroy(conn)['catch'](function () {});
    }
  }, {
    key: 'isValid',
    value: function isValid(conn) {
      var dur = Date.now() - conn._initializedAt;

      if (dur > this.config.timeout) {
        this.destroy(conn);
        return false;
      }

      // Connection still valid, don't renew
      return this.config.validate(conn);
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
      var _this4 = this;

      var connection = this.acquire();
      return Promise.using(connection.disposer(function () {
        _this4.release(connection);
      }), function (conn) {
        return conn[fnName](arg);
      });
    }
  }]);

  return PoolParty;
})();