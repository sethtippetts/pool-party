var PoolParty = require('./es5');
if ('function' === typeof Map) PoolParty = require('./es6');

module.exports = exports = PoolParty.default || PoolParty;
