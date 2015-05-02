# Pool Party
<img src="http://www.meridianumc.com/wp-content/uploads/2014/06/pool-party.jpg" height="400" />
## Basic Usage

### Create Instance

```
var PoolParty = require('vs-force/es5');

var db = new PoolParty({
  Username:        <Username>,
  Password:        <Password>,
  Endpoint:        <Endpoint>,
  LastChanged:     <LastChanged>,
  TargetSystem:    <TargetSystem>,
  SecurityToken:   <SecurityToken>,
  IntegrationName: <IntegrationName>
});
```

### Manipulate data

> Returns a promise with the transaction results

```
function updateAccount(account){
  return db.sobject('Account__c')
    .then(function(sobject) {
      return sobject.update(account);
    });
}
```

### Query data

> Returns a promise with the query results

```
function query(soql){
  return db.query(soql);
}
```

## Arm Floaties

Be sure not to create multiple PoolParty instances, each instance manages the connection pool so you don't have to!


> Ah, man. SalesForce peed in the pool...
