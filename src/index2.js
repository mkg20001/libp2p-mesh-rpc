'use strict'

/* eslint-disable guard-for-in */

module.exports = ({
  swarm,
  protocol,
  messages,
  config: {
    autoDial = true
  } = { }
}) => {
  function RPCWrapperCMD (msg) {
    return {
      async single (peerLike, parameters, { ignoreFailure = false } = {}) {

      },
      async broadcast (parameters, { propability = 1 }) { // broadcast to p% amount of peers

      },
      async roundRobin (parameters, { failureMax = 0, successMax = 1, backoff = 0 } = {}) { // try peer after peer, bail if any maximum hit

      }
    }
  }

  function RPCWrapperPeer (peer, cmds) {
    const out = {}

    for (const cmd in cmds) {
      out[cmd] = (...a) => cmds[cmd].single(peer, ...a) // TODO: make direct instead of indirect
    }
  }

  const cmds = {}
  for (const msgId in messages) {
    const msg = messages[msgId]
    cmds[msgId] = RPCWrapperCMD(msg)
  }

  return {
    cmds,
    dial: () => {}
  }
}
