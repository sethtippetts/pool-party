'use strict';

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var Promise = require('bluebird'),
    debug = require('debug')('pool-party');

var oneHourMillis = 1000 * 60 * 60;

module.exports = (function () {
  function PoolParty() {
    var _this = this;

    var _ref = arguments[0] === undefined ? {} : arguments[0];

    var _ref$min = _ref.min;
    var min = _ref$min === undefined ? 1 : _ref$min;
    var _ref$max = _ref.max;
    var max = _ref$max === undefined ? 8 : _ref$max;
    var _ref$timeout = _ref.timeout;
    var timeout = _ref$timeout === undefined ? oneHourMillis : _ref$timeout;
    var _ref$validate = _ref.validate;
    var validate = _ref$validate === undefined ? function () {
      return true;
    } : _ref$validate;
    var _ref$decorate = _ref.decorate;
    var decorate = _ref$decorate === undefined ? [] : _ref$decorate;
    var _ref$factory = _ref.factory;
    var factory = _ref$factory === undefined ? null : _ref$factory;
    var _ref$destroy = _ref.destroy;
    var destroy = _ref$destroy === undefined ? null : _ref$destroy;

    _classCallCheck(this, PoolParty);

    this.config = {
      min: min,
      max: max,
      timeout: timeout,
      validate: validate,
      decorate: decorate,
      destroy: destroy,
      factory: factory
    };

    if (typeof this.config.factory !== 'function') {
      throw new Error('Pool party requires a factory. Gotta invite the cool kids!');
    }
    this.connectionCount = 0;

    this.config.decorate.forEach(function (method) {
      _this[method] = function (arg) {
        return _this.decorate.call(_this, method, arg);
      };
    });

    this.highWater = 0;
    this.pool = [];
    this.queue = [];
    debug('Pool party started. Max connections: %d', this.config.max);
  }

  _createClass(PoolParty, [{
    key: 'decorate',
    value: function decorate(fnName, args) {
      var _this2 = this;

      debug('Decorating connection method "%s"', fnName);
      var connection = this.acquire();
      return Promise.using(connection.disposer(function () {
        _this2.release(connection);
      }), function (conn) {
        debug('Connecting via decorated method "%s"', fnName);
        return conn[fnName](args);
      });
    }
  }, {
    key: 'connect',
    value: function connect(fn) {
      var _this3 = this;

      debug('Connecting via #connect helper');
      var connection = this.acquire();
      return Promise.using(connection.disposer(function () {
        _this3.release(connection);
      }), function (conn) {
        return fn.bind(conn, conn)();
      });
    }
  }, {
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
      var _this4 = this;

      // Check if less that 75% of connections in use
      var isLowTide = this.connectionCount - this.pool.length < this.connectionCount * 0.75;

      if (isLowTide) {

        // Destroy connection
        this.pool.pop().then(function (conn) {
          return _this4.destroy(conn);
        });
      }
      return isLowTide;
    }
  }, {
    key: 'create',
    value: function create() {
      debug('Creating connection. Connection count: %d', this.connectionCount + 1);
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
      var _this5 = this;

      debug('Queueing connection.');
      return new Promise(function (resolve, reject) {
        _this5.queue.push({ resolve: resolve, reject: reject });
      });
    }
  }, {
    key: 'release',
    value: function release(conn) {

      // No waiting connections. Release to the pool.
      if (!this.queue.length) {
        debug('Releasing connection.');
        return this.drain() || this.pool.push(conn);
      }

      debug('Resolving queued promise.');
      // Resolve waiting promise with last connection
      var promise = this.queue.shift();
      promise.resolve(conn);
    }
  }, {
    key: 'destroy',
    value: function destroy(conn) {
      debug('Destroying connection.');
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
  }]);

  return PoolParty;
})();