var jsforce = require('jsforce')
  , Promise = require('bluebird');

var oneHourMillis = 1000 * 60 * 60;

module.exports = class VSForce {
  constructor(config) {
    if(!config || !config.Endpoint || !config.SecurityToken || !config.Password || !config.Username){
      throw new Error('Missing SalesForce credentials');
    }
    this.config = JSON.parse(JSON.stringify(config));
    this.pool = [];
  }
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

  /**
   * getConnection
   * @returns {promise|*|Function|promise|promise|promise}
   */
  getConnection() {
    return this.checkConnDuration()
      .then((renew) => {
        if(!renew &&!this.config.newConn&&this.conn.loginUrl===this.config.Endpoint) return Promise.resolve(this.conn);
        this.config.newConn=false;

        this.conn = new jsforce.Connection({
          loginUrl: this.config.Endpoint,
          accessToken: this.config.SecurityToken
        });

        this.conn.query = Promise.promisify(this.conn.query, this.conn);
        this.conn.login = Promise.promisify(this.conn.login, this.conn);

        return this.conn.login(this.config.Username, this.config.Password + this.config.SecurityToken)
          .then(() => {
            this.conn._initializedAt = Date.now();
            return this.conn;
          });
      });
  }


  /**
   * checkConnDuration
   * @param conn
   */
  checkConnDuration(){
    // No connection, create one.
    if(!this.conn) return Promise.resolve(true);

    var dur = Date.now() - this.conn._initializedAt
      , calcDur = dur/oneHourMillis;

    console.log('Duration of connection: '+calcDur+' hours');

    // Connection still valid, don't renew
    if(calcDur<10) return Promise.resolve(false);

    return new Promise((resolve, reject) => {
      console.log('Logging out connection at: '+calcDur);
      this.conn.logout((err) =>  {
        if (err) return reject(err);
        console.log('Session has been expired.');
        resolve(true);
      });
    });
  }
}
