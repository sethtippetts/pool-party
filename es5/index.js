'use strict';

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var jsforce = require('jsforce'),
    Promise = require('bluebird');

var oneHourMillis = 1000 * 60 * 60;

module.exports = (function () {
  function VSForce(config) {
    _classCallCheck(this, VSForce);

    if (!config || !config.Endpoint || !config.SecurityToken || !config.Password || !config.Username) {
      throw new Error('Missing SalesForce credentials');
    }
    this.config = JSON.parse(JSON.stringify(config));
    this.pool = [];
  }

  _createClass(VSForce, [{
    key: 'query',
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
  }, {
    key: 'getConnection',

    /**
     * getConnection
     * @returns {promise|*|Function|promise|promise|promise}
     */
    value: function getConnection() {
      var _this = this;

      return this.checkConnDuration().then(function (renew) {
        if (!renew && !_this.config.newConn && _this.conn.loginUrl === _this.config.Endpoint) return Promise.resolve(_this.conn);
        _this.config.newConn = false;

        _this.conn = new jsforce.Connection({
          loginUrl: _this.config.Endpoint,
          accessToken: _this.config.SecurityToken
        });

        _this.conn.query = Promise.promisify(_this.conn.query, _this.conn);
        _this.conn.login = Promise.promisify(_this.conn.login, _this.conn);

        return _this.conn.login(_this.config.Username, _this.config.Password + _this.config.SecurityToken).then(function () {
          _this.conn._initializedAt = Date.now();
          return _this.conn;
        });
      });
    }
  }, {
    key: 'checkConnDuration',

    /**
     * checkConnDuration
     * @param conn
     */
    value: function checkConnDuration() {
      var _this2 = this;

      // No connection, create one.
      if (!this.conn) {
        return Promise.resolve(true);
      }var dur = Date.now() - this.conn._initializedAt,
          calcDur = dur / oneHourMillis;

      console.log('Duration of connection: ' + calcDur + ' hours');

      // Connection still valid, don't renew
      if (calcDur < 10) {
        return Promise.resolve(false);
      }return new Promise(function (resolve, reject) {
        console.log('Logging out connection at: ' + calcDur);
        _this2.conn.logout(function (err) {
          if (err) return reject(err);
          console.log('Session has been expired.');
          resolve(true);
        });
      });
    }
  }]);

  return VSForce;
})();