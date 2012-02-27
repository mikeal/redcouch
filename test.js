var redcouch = require('./index')
  , assert = require('assert')
  ;

var x = redcouch('http://localhost:5984/shortened')

x.prime(function (err) {
  console.error(err)
  x.redis.keys('*', function (e, results) {
    console.log(results)
  })
  var rand = Math.floor(Math.random()*111111111)
  x.set('testkey1', rand, function (err) {
    console.error(err)
    x.get('testkey1', function (err, value) {
      assert.equal(rand, value)
      // ensure test
      x.ensureWrite = true
      x.set('testkey2', rand, function (err) {
        console.error(err)
        x.get('testkey2', function (err, value) {
          assert.equal(rand, value)
          x.del(['testkey1', 'testkey2'],function () {
            x.redis.quit()
          })
        })
      })
    })
  })
})