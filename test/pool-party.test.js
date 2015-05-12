/* global describe, it, beforeEach */

var expect = require('chai').expect;
var Promise = require('bluebird');

var PoolParty = require('../es5')
  , config = {
  factory: function(){
    return Promise.resolve({
      query: function(q){
        return new Promise(function(resolve){
          setTimeout(function(){
            resolve({query: q});
          }, 1000);
        });
      }
    });
  },
  destroy: function(){
    return Promise.resolve(true);
  },
  decorate: ['query'],
  max: 10
};

describe('Pool Party', function(){
  var poolParty;
  beforeEach(function(){
    poolParty = new PoolParty(config);
  });
  describe('#constructor', function(){
    it('should extend default parameters', function(){
      expect(poolParty.config.min).to.equal(1);
      expect(poolParty.config.max).to.equal(10);
    });
    it('should have a connect function', function(){
      expect(poolParty.connect).to.be.a('function');
    });
    it('should resolve with a connection', function(done){
      poolParty.connect(function(conn){
        expect(conn).to.be.a('object');
        expect(conn.query).to.be.a('function');
        expect(poolParty.connections.size).to.equal(1);
        done();
      });
    });
  });

  describe('#connect', function(){
    it('should be public', function(){
      expect(poolParty.connect).to.be.a('function');
    });
    it('should never exceed max connection limit', function(){
      var resolve = function(){
        return Promise.resolve(true);
      };
      for(var i = 0; i < poolParty.config.max*4; i++){
        poolParty.connect(resolve);
      }
      expect(poolParty.connections.size).to.equal(poolParty.config.max);
    });
    it('should queue requests over the max connection limit', function(){
      var resolve = function(){
        return Promise.resolve(true);
      };
      for(var i = 0; i < poolParty.config.max*2; i++){
        poolParty.connect(resolve);
      }
      expect(poolParty.queue.length).to.equal(poolParty.config.max);
    });
    it('should resolve queued promises', function(done){
      var resolve = function(){
        return Promise.resolve(true);
      };
      var promises = [];
      for(var i = 0; i < poolParty.config.max*2; i++){
        promises.push(poolParty.connect(resolve));
      }
      Promise.all(promises)
        .then(function(results){
          results.forEach(function(result){
            expect(result).to.equal(true);
          });
          done();
        });
    });
  });
});


