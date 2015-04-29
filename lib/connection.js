var  jsforce = require('jsforce');
var   moment = require('moment');
var Promise = require('bluebird');

var conn
  , oneHourMillis = 1000 * 60 * 60;

var VSForce = function(config){
  if(!config || !config.Endpoint || !config.SecurityToken || !config.Password || !config.Username){
    throw new Error('Missing SalesForce credentials');
  }
  this.config = JSON.parse(JSON.stringify(config));
  this.pool = [];
};

VSForce.prototype.query = function(query){
  return this.getConnection()
    .then(function(conn){
      return new Promise(function(resolve, reject){
        conn.query(query, function (err, res) {
          if(err) return reject(err);
          resolve(res);
        });
      });
    });
};


/**
 * getConnection
 * @returns {promise|*|Function|promise|promise|promise}
 */
VSForce.prototype.getConnection = function() {
  return this.checkConnDuration()
    .then(function(renew) {
      if(!renew&&!this.config.newConn&&conn.loginUrl===this.config.Endpoint) return Promise.resolve();
      this.config.newConn=false;

      conn = new jsforce.Connection({
        loginUrl: this.config.Endpoint,
        accessToken: this.config.SecurityToken
      });

      return new Promise(function(resolve, reject){
        conn.login(this.config.Username, this.config.Password + this.config.SecurityToken, function(err, res){
          if(err) return reject(err);
          resolve(res);
        });
      }.bind(this))
      .then(function(){
        return conn;
      });
    }.bind(this));
};

  /**
   * checkConnDuration
   * @param conn
   */
VSForce.prototype.checkConnDuration = function(){
  // No connection, create one.
  if(!this.conn) return Promise.resolve(true);

  return new Promise(function(resolve, reject){

    var dur = moment().subtract(conn._initializedAt).valueOf()
      , calcDur = (dur/oneHourMillis);

    console.log('Duration of connection: '+calcDur+' hours');

    // Connection still valid, don't renew
    if(calcDur<10) return resolve(false);

    console.log('Logging out connection at: '+calcDur);
    conn.logout(function(err) {
      if (err) return reject(err);
      console.log('Session has been expired.');
      resolve(true);
    });
  });
};

module.exports = VSForce;
