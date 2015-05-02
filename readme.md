# Pool Party

<img src="http://www.meridianumc.com/wp-content/uploads/2014/06/pool-party.jpg" height="400" />

### Install Package
```sh
$ npm install --save pool-party
```

### Create Instance

```
var PoolParty = require('pool-party');

var db = new PoolParty({
  // Configuration
});
```

#### Configuration
Property | Type | Description | Default
--- | --- | --- | ---
`factory` | `function` | Function to create new connections. *Must* return a connection wrapped in a {Promise} | `N/A`
`destroy` | `function` | Function to terminate connections *Must* return a `true/false` wrapped in a {Promise} | `N/A`
`min` | `number` | Minimum number of connections to keep open | `0`
`max` | `number` | Maximum number of connection to have open | `8
`timeout` | `milliseconds` | Maximum life of a connection before termination | `1000 * 60 * 60`
`validate` | `function` | Function to determine if a connection is still valid | `function(){return true;}`
`decorate` | `array` | Array of `string` method names on the {Connection} class to be "decorated". A decorated method must return a promise. | `[]`

### Dive in!



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
