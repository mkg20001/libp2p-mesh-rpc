'use strict'

// { roundRobin: { successMax, failureMax, parallel }, broadcast: { percentage } }

/* eslint-disable no-loop-func */

const shuffle = require('lodash/shuffle')
const RPCController = require('./rpcController')

const { parallelMap, collect } = require('streaming-iterables')
const pipe = require('it-pipe')

module.exports = async (cmds, config, peerBook, dial) => {
  const c = {}

  let peers = []
  const wrap = await RPCController(cmds)

  async function onConn (isClient, conn) {
    peers.push(await wrap(isClient, conn))
  }

  function updatePeers () {
    peers = peers.filter(p => p.isConnected())
  }

  for (const cmdId in cmds) { // eslint-disable-line guard-for-in
    c[cmdId] = {
      async broadcast (_config, ...params) {
        updatePeers()

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
        updatePeers()

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
        updatePeers()

        const peer = peerBook.get(peerLike)
        const id = peer.id.toB58String()
        const rpc = peers.filter(p => p.id === id)[0]

        if (!rpc) {
          await dial(peer)
          return c[cmdId].single(peer, ...params)
        }

        return rpc.doRequest(cmdId, ...params)
      }
    }
  }

  return {
    onConn,
    cmd: c,
    get: (peerLike) => {
      updatePeers()

      // TODO: add and maybe add .dial) ?
    }
  }
}
