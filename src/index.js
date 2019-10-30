'use strict'

const RPCControllerOuter = require('./rpcControllerOuter')
const { schema } = require('./utils')

module.exports = (_config) => {
  /* validate */

  const { error, value } = schema.validate(_config)

  if (error) {
    throw error
  }

  const {
    cmds,
    swarm,
    config
  } = value

  /* code */

  const { onConn, cmd, get: getPeer } = RPCControllerOuter(cmds, config, swarm.peerBook)

  async function dial (peerLike) {
    const conn = await swarm.dial(peerLike, config.protocol)
    await onConn(conn)
  }

  swarm.handle(config.protocol, async (_, conn) => {
    await onConn(conn)
  })

  if (config.autoDial) {
    swarm.on('peer:connect', (peer) => {
      return dial(peer)
    })
  }

  return {
    cmd,
    getPeer,
    dial
  }
}
