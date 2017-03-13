
var pull = require('pull-stream')
var path = require('path')
var Links = require('streamview-links')
var explain = require('explain-error')
var Notify = require('pull-notify')
var Value = require('mutant/value')
var watchThrottle = require('mutant/watch-throttle')
var ref = require('ssb-ref')
var extend = require('xtend')

exports.name = 'mentions'
exports.version = '0.0.0'
exports.manifest = {
  read: 'source', dump: 'source', progress: 'source'
}

var indexes = [
  { key: 'ADR', value: [['value', 'author'], 'dest', 'timestamp'] },
  { key: 'DTA', value: ['dest', ['value', 'content', 'type'], ['value', 'author'], 'timestamp'] },
  { key: 'TDA', value: [['value', 'content', 'type'], 'dest', ['value', 'author'], 'timestamp'] }
]

exports.init = function (ssb, config) {
  var dir = path.join(config.path, 'mentions')

  var version = 0
  //it's really nice to tweak a few things
  //and then change the version number,
  //restart the server and have it regenerate the indexes,
  //all consistent again.
  function id (msg, emit) {
    walk(msg.value.content, function (path, value) {
      var type = ref.type(value)
      if (type) {
        // emit for all mentions
        emit(extend(msg, {
          path, dest: value
        }))
      }
    })
  }

  var links = Links(dir, indexes, id, version)
  var notify = Notify()
  var pending = Value(0)

  watchThrottle(pending, 200, (value) => {
    notify({pending: Math.max(0, value)})
  })

  links.init(function (err, since) {
    countChanges(since, function (err, changes) {
      if (err) throw err
      pending.set(changes)
      onChange(() => {
        pending.set(pending() + 1)
      })
      pull(
        ssb.createLogStream({gt: since || 0, live: true, sync: false}),
        pull.through(function () {
          pending.set(pending() - 1)
        }),
        links.write(function (err) {
          if(err) throw err
        })
      )
    })
  })

  return {
    dump: function () {
      return links.dump()
    },

    read: function (opts) {
      if(opts && 'string' == typeof opts)
        try { opts = {query: JSON.parse(opts) } } catch (err) {
        return pull.error(err)
      }
      return links.read(opts, function (ts, cb) {
        ssb.sublevel('log').get(ts, function (err, key) {
          if(err) return cb(explain(err, 'missing timestamp:'+ts))
          ssb.get(key, function (err, value) {
            if(err) return cb(explain(err, 'missing key:'+key))
            cb(null, {key: key, value: value, timestamp: ts})
          })
        })
      })
    },

    progress: notify.listen
  }

  function countChanges (since, cb) {
    var result = 0
    pull(
      ssb.createLogStream({gt: since || 0, keys: false, values: false}),
      pull.drain(function () {
        result += 1
      }, function (err) {
        cb(err, result)
      })
    )
  }

  function onChange (cb) {
    pull(
      ssb.createLogStream({keys: false, values: false, old: false}),
      pull.drain(function () {
        cb()
      })
    )
  }
}

function walk (obj, fn, prefix) {
  if (obj && typeof obj === 'object') {
    for (var k in obj) {
      walk(obj[k], fn, (prefix || []).concat(k))
    }
  } else {
    fn(prefix, obj)
  }
}
