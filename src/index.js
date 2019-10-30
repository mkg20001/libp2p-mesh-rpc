'use strict'

const RPCControllerOuter = require('./rpcControllerOuter')
const { schema } = require('./utils')
const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))

module.exports = async (_config) => {
  /* validate */

  const { error, value } = schema.validate(_config)

  if (error) {
    throw error
  }

  const {
    cmds,
    swarm,
    config,
    protocol
  } = value

  /* code */

  const { onConn, cmd, get: getPeer } = await RPCControllerOuter(cmds, config, swarm.peerBook, dial)

  async function dial (peerLike) {
    const conn = await swarm.dialProtocol(peerLike, protocol)

    await onConn(true, conn)
  }

  swarm.handle(protocol, async (_, conn) => {
    await onConn(false, conn)
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
