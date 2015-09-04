'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Set = require('babel-runtime/core-js/set')['default'];

var Promise = require('bluebird'),
    debug = require('debug')('pool-party');

require("babel").transform("code", { optional: ["runtime"] });

module.exports = (function () {
  function PoolParty() {
    var _this = this;

    var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    var _ref$min = _ref.min;
    var min = _ref$min === undefined ? 1 : _ref$min;
    var _ref$max = _ref.max;
    var max = _ref$max === undefined ? 8 : _ref$max;
    var _ref$highWater = _ref.highWater;
    var highWater = _ref$highWater === undefined ? 0.75 : _ref$highWater;
    var _ref$timeout = _ref.timeout;
    var timeout = _ref$timeout === undefined ? 1000 * 60 * 60 : _ref$timeout;
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

    if (highWater > 1) highWater = 1;
    if (highWater < min / max) highWater = min / max;

    this.config = {
      min: min,
      max: max,
      highWater: highWater,
      timeout: timeout,
      validate: validate,
      decorate: decorate,
      destroy: destroy,
      factory: factory
    };

    if (typeof this.config.factory !== 'function') {
      throw new Error('Pool party requires a factory. Gotta invite the cool kids!');
    }

    this.config.decorate.forEach(function (method) {
      _this[method] = function (arg) {
        return _this.decorate.call(_this, method, arg);
      };
    });

    // Highest number of active connections
    this.highWater = 0;

    // List of promised connections
    this.connections = new _Set();

    // List of inactive promised connections
    this.pool = [];

    // List of unfufilled requests
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
        if (fn) return fn.bind(conn, conn)();
        return conn;
      });
    }

    /**
     * PoolParty.acquire
     * @return {Disposer} [description]
     */
  }, {
    key: 'acquire',
    value: function acquire() {

      // No available connections
      if (!this.pool.length) {
        // Creating new connection
        if (this.connections.size < this.config.max) return this.create();

        // Maxed out connections, adding to queue
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
      // TODO, drain all connections
    }
  }, {
    key: 'create',
    value: function create() {
      var _this4 = this;

      var createPromise = this.config.factory();
      this.connections.add(createPromise);

      debug('Creating connection. Connection count: %d', this.connections.size);

      // Increment connection count and update highwater-mark
      if (this.highWater < this.connections.size) {
        this.highWater = this.connections.size;
      }
      return createPromise.then(function (resource) {
        resource._initializedAt = Date.now();

        _this4.connections.add(resource);
        _this4.connections['delete'](createPromise);
        return resource;
      })['catch'](function () {
        createPromise.then(function (conn) {
          this.destroy(conn);
        });
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
      var _this6 = this;

      // Resolve waiting promise with last connection
      if (this.queue.length) return this.queue.shift().resolve(conn);

      // Check if highWater is higher than config says to keep
      if (this.connections.size - this.pool.length > this.highWater * this.config.highWater) {
        debug('Draining connection.');
        return conn.then(function (_conn) {
          return _this6.destroy(_conn);
        });
      }

      // No waiting connections. Release to the pool.
      debug('Releasing connection to pool.');
      return this.pool.push(conn);
    }
  }, {
    key: 'destroy',
    value: function destroy(conn) {
      debug('Destroying connection.');
      this.connections['delete'](conn);
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