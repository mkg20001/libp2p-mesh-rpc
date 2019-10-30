'use strict'

const RPCControllerOuter = require('./rpcControllerOuter')

module.exports = ({
  cmds,
  swarm,
  config
}) => {
  const { onConn, cmd, get: getPeer } = RPCControllerOuter(cmds, config)

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
