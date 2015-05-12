
# Pool Party

<img src="http://www.meridianumc.com/wp-content/uploads/2014/06/pool-party.jpg" height="400" />

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][downloads-url]

## Installation
```sh
$ npm install --save pool-party
```

## Features

  * Connection pooling
  * Queued requests
  * ES5/6 support (written in ES6, transpiled with Babel)
  * Connection timeout
  * Custom connection validation method
  * Decorate existing connection instance with poolable requests
  * High-water mark to drain connections under low load

## Dive In!

```
var PoolParty = require('pool-party');

var db = new PoolParty({
  // Options
});
```

### Options

<hr>

#### `factory`

**type** `function` (__Required__)

Function to create new connections. *Must* return a connection wrapped in a {Promise}

<hr>

#### `destroy`

**type** `function` (__Required__)

Function to terminate connections *Must* return a `true/false` wrapped in a {Promise}

<hr>

#### `min`

**type** `number`

**default** `0`

Minimum number of connections to keep open

<hr>

#### `max`

**type** `number`

**default** `8`

Maximum number of connection to have open

<hr>

#### `timeout`

**type** `milliseconds`

**default** `1000 * 60 * 60`

Maximum life of a connection before termination

<hr>

#### `validate`

**type** `function`

**default** ```function(){
  return true;
}```

Function to determine if a connection is still valid

<hr>

#### `decorate`

**type** `array`

**default** `[]`

Array of `string` method names on the {Connection} class to be "decorated". A decorated method must return a promise.

<hr>

## Dive in!

<a href="https://github.com/SethTippetts/pool-party/tree/master/examples">Click here</a> to view more examples.

```
var PoolParty = require('pool-party');
var Promise = require('bluebird');
var jsforce = require('jsforce');

// Create a "pool" instance
var db = new PoolParty({
  factory: function(){

    // Create a conneciton instance
    var conn = new jsforce.Connection({
      loginUrl: // LOGIN_URL,
      accessToken: // TOKEN
    });

    // Methods that aren't promisified can't be decorated
    conn.query = Promise.promisify(conn.query, conn);
    conn.login = Promise.promisify(conn.login, conn);

    return conn.login(config.Username, config.Password + config.SecurityToken)
      .then(function(){
        // Return the connection, because `conn.login` doesn't
        return conn;
      });
  },
  destroy: function(conn){
    return new Promise(function(resolve, reject) {
      conn.logout(function(err) {
        if (err) return reject(err);
        resolve(true);
      });
    });
  },
  decorate: ['query','sobject'],
  max: 10
});
```

#### Interact with data! Splash fight!

> Returns a promise with the transaction results

```
// Query data!
return db.query(/* SOQL Query */); // Returns a promise with query results

// Update stuff!
return db.sobject('Account__c')
  .then(function(sobject) {
    return sobject.update({/* Cool account stuff */});
  });
```

## Arm Floaties

Be sure not to create multiple PoolParty instances, each instance manages the connection pool so you don't have to!


> Ah, man. SalesForce peed in the pool...

[npm-image]: https://img.shields.io/npm/v/pool-party.svg
[npm-url]: https://www.npmjs.org/package/pool-party
[downloads-image]: https://img.shields.io/npm/dm/pool-party.svg
[downloads-url]: https://www.npmjs.org/package/pool-party
