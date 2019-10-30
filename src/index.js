'use strict'

const RPCControllerOuter = require('./rpcControllerOuter')
const { schema } = require('./utils')
const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))

const debug = require('debug')
const log = debug('libp2p:mesh-rpc')

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

  log('starting %s', protocol)

  const { onConn, cmd, get: getPeer } = await RPCControllerOuter(cmds, config, swarm.peerBook, dial)

  async function dial (peerLike) {
    log('starting dial %s', peerLike)
    const conn = await swarm.dialProtocol(peerLike, protocol)

    await onConn(true, conn)
  }

  swarm.handle(protocol, async (_, conn) => {
    log('incoming connection')
    await onConn(false, conn)
  })

  if (config.autoDial) {
    swarm.on('peer:connect', (peer) => {
      log('auto-dialing peer %s', peer.id.toB58String())
      return dial(peer)
    })
  }

  return {
    cmd,
    getPeer,
    dial
  }
}
