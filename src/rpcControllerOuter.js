'use strict'

// { roundRobin: { successMax, failureMax, parallel }, broadcast: { percentage } }

/* eslint-disable no-loop-func */

const shuffle = require('loadsh/shuffle')
const RPCController = require('./rpcController')
const { schema } = require('./utils')

const { parallelMap, collect } = require('streaming-iterables')
const pipe = require('it-pipe')

module.exports = async (cmds, swarm, config) => {
  const { error, value } = schema.validate(config)

  if (error) {
    throw error
  }

  config = value

  const c = {}

  const peers = []
  const wrap = await RPCController(cmds)

  async function dial (peerLike) {
    const conn = await swarm.dial(peerLike, config.protocol)
    peers.push(await wrap(conn))
  }

  swarm.handle(config.protocol, async (_, conn) => {
    peers.push(await wrap(conn))
  })

  for (const cmdId in cmds) { // eslint-disable-line guard-for-in
    c[cmdId] = {
      async broadcast (_config, ...params) {
        const { percentage = 1, parallel = 1 } = Object.assign(Object.assign({}, config), _config)
        const pc = Math.round(peers.length * percentage)
        const pl = shuffle(peers).slice(0, pc)

        const res = await pipe(
          parallelMap(parallel, async (peer) => {
            let res
            try {
              res = await peer.doRequest(cmdId, ...params)
            } catch (err) {
              return { type: 'e', isErr: true, peer, err }
            }

            return { type: 'r', isRes: true, peer, res }
          }, pl),
          collect
        )

        return res.filter(r => Boolean(r))
      },
      async multicast (_config, ...params) { // NOTE: if parallel is more than one, there could be more success/failure than the max, since requests were already in progress at that time
        const { successMax = 1, failureMax = 0, parallel = 1, percentage = 1 } = Object.assign(Object.assign({}, config), _config)

        const pc = Math.round(peers.length * percentage)
        const pl = shuffle(peers).slice(0, pc)

        const success = 0
        const failure = 0

        const res = await pipe(
          parallelMap(parallel, async (peer) => {
            if (success >= successMax || failure >= failureMax) {
              return
            }

            let res
            try {
              res = await peer.doRequest(cmdId, ...params)
            } catch (err) {
              return { type: 'e', isErr: true, peer, err }
            }

            return { type: 'r', isRes: true, peer, res }
          }, pl),
          collect
        )

        return res.filter(r => Boolean(r))
      },
      async single (peerLike, ...params) {
      }
    }
  }

  return {
    cmd: c,
    dial,
    get // (peerLike) => peerWithCmds
  }
}
