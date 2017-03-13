var nest = require('depnest')
var pull = require('pull-stream')
var {Struct, Dict, computed, watch} = require('mutant')

exports.gives = nest({
  'progress.obs': [
    'global',
    'peer',
    'query',
    'mentions',
    'private']
})

exports.needs = nest({
  'sbot.obs.connection': 'first'
})

exports.create = function (api) {
  var syncStatus = null
  var queryProgress = null
  var mentionsProgress = null
  var privateProgress = null

  return nest({
    'progress.obs': {
      global () {
        load()
        return syncStatus
      },
      peer (id) {
        load()
        var result = computed(syncStatus, (status) => {
          return status.pendingPeers[id] || 0
        })
        return result
      },
      query () {
        if (!queryProgress) {
          queryProgress = ProgressStatus(x => x.query.progress)
        }
        return queryProgress
      },
      mentions () {
        if (!mentionsProgress) {
          mentionsProgress = ProgressStatus(x => x.mentions && x.mentions.progress)
        }
        return mentionsProgress
      },
      private () {
        if (!privateProgress) {
          privateProgress = ProgressStatus(x => x.private.progress)
        }
        return privateProgress
      }
    }
  })

  function load () {
    if (!syncStatus) {
      syncStatus = ProgressStatus(x => x.replicate.changes, {
        incomplete: 0,
        pendingPeers: Dict({}, {fixedIndexing: true}),
        pending: 0,
        feeds: null,
        rate: 0
      })
    }
  }

  function ProgressStatus (keyFn, attrs) {
    var progress = Struct(attrs || {
      pending: 0
    })

    watch(api.sbot.obs.connection, (sbot) => {
      if (sbot) {
        var source = keyFn(sbot)
        if (source) {
          pull(
            source(),
            pull.drain((event) => {
              progress.set(event)
            })
          )
        }
      }
    })

    return progress
  }
}
