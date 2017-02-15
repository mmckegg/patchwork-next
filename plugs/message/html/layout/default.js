const { when, h } = require('mutant')
var nest = require('depnest')

exports.needs = nest({
  'profile.html.person': 'first',
  'message.html': {
    link: 'first',
    meta: 'map',
    action: 'map',
    timestamp: 'first'
  },
  'about.html.image': 'first'
})

exports.gives = nest('message.html.layout')

exports.create = function (api) {
  return nest('message.html.layout', layout)

  function layout (msg, opts) {
    if (!(opts.layout === undefined || opts.layout === 'default' || opts.layout === 'mini')) return

    var classList = ['Message']
    var replyInfo = null

    if (msg.value.content.root) {
      classList.push('-reply')
      if (!opts.previousId) {
        replyInfo = h('span', ['in reply to ', api.message.html.link(msg.value.content.root)])
      } else if (opts.previousId && last(msg.value.content.branch) && opts.previousId !== last(msg.value.content.branch)) {
        replyInfo = h('span', ['in reply to ', api.message.html.link(last(msg.value.content.branch))])
      }
    }

    return h('div', {
      classList
    }, [
      messageHeader(msg, replyInfo),
      h('section', [opts.content]),
      when(msg.key, h('footer', [
        h('div.actions', [
          api.message.html.action(msg)
        ])
      ]))
    ])

    // scoped

    function messageHeader (msg, replyInfo) {
      return h('header', [
        h('div.main', [
          h('a.avatar', {href: `${msg.value.author}`}, [
            api.about.html.image(msg.value.author)
          ]),
          h('div.main', [
            h('div.name', [
              api.profile.html.person(msg.value.author)
            ]),
            h('div.meta', [
              api.message.html.timestamp(msg), ' ', replyInfo
            ])
          ])
        ]),
        h('div.meta', api.message.html.meta(msg))
      ])
    }
  }
}

function last (array) {
  if (Array.isArray(array)) {
    return array[array.length - 1]
  } else {
    return array
  }
}