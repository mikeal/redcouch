var couch = require('couch')
  , redis = require('redis')
  , _ = require('underscore')
  ;

function KeyValueStore (c, r) {
  var self = this
  self.couch = couch(c)
  self.redis = redis.createClient(r.port, r.host, r)
  if (r.select) {   
    self.redis.select(r.select)
    self.redis.on("connect", function () {
      self.redis.send_anyways = true
      self.redis.select(r.select)
      self.redis.send_anyways = false
    })
  }
}
KeyValueStore.prototype.close = function () {
  this.redis.quit()
}
KeyValueStore.prototype.set = function (key, value, cb) {
  var self = this
    , update = function (doc) {
      doc.value = value
    }
  self.couch.update(key, update, self.ensureWrite ? cb : function () {})
  self.redis.set(key, JSON.stringify(value), self.ensureWrite ? function () {} : cb)
}
KeyValueStore.prototype.get = function (key, cb) {
  this.redis.get(key, function (err, value) {
    if (err) return cb(err)
    cb(null, JSON.parse(value))
  })
}
KeyValueStore.prototype.prime = function (clobber, cb) {
  var self = this
    ;
  if (cb === undefined) {
    cb = clobber
    clobber = true
  }
  if (clobber) {
    self.redis.keys("*", function (err, redkeys) {
      self.couch.all({include_docs:true}, function (err, results) {
        var couchkeys = results.rows.map(function (r) {return r.key})
          , counter = 0
          ;
    
        var toRemove = _.difference(redkeys, couchkeys)
        counter++
        self.redis.mset(
          _.flatten(results.rows.map(function (r) {return [r.key, JSON.stringify(r.value.value)]}))
          , function (err, res) {
            if (err) return cb(err)
            counter = counter - 1
            if (counter === 0) cb(null)
          }
        )
        if (toRemove.length) {
          counter++
          self.redis.del(toRemove, function () {
            if (err) return cb(err)
            counter = counter - 1
            if (counter === 0) cb(null)
          })
        }
      })
    })
  } else {
    self.couch.all({include_docs:true}, function (err, results) {
      var couchkeys = results.rows.map(function (r) {return r.key})
      
      self.redis.mset(
        _.flatten(results.rows.map(function (r) {return [r.key, JSON.stringify(r.value.value)]}))
        , function (err, res) {
          if (err) return cb(err)
          cb(null)
        }
      )
    })
  }
}

function kv (couchurl, redisopts) {
  if (typeof redisopts === 'string') {
    if (redisopts.indexOf(':') !== -1) {
      redisopts = {host: redisopts.split(':')[0], port: redisopts.split(':')[1]}
    } else {
      redisopts = {host: redisopts, port: 6379}
    }
  } else if (redisopts === undefined) {
    redisopts = {host: 'localhost', port: 6379}
  }
  return new KeyValueStore(couchurl, redisopts)
}

module.exports = kv
module.exports.kv = kv