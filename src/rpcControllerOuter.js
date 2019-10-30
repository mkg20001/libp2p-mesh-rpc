'use strict'

// { roundRobin: { successMax, failureMax, parallel }, broadcast: { percentage } }

/* eslint-disable no-loop-func */

const shuffle = require('lodash/shuffle')
const RPCController = require('./rpcController')

const { parallelMap, collect } = require('streaming-iterables')
const pipe = require('it-pipe')

const debug = require('debug')
const log = debug('libp2p:mesh-rpc:controller-outer')

module.exports = async (cmds, config, peerBook, dial) => {
  const c = {}

  let peers = []
  const wrap = await RPCController(cmds)

  async function onConn (isClient, conn) {
    log('wrapping connection (isClient=%o)', isClient)
    peers.push(await wrap(isClient, conn))
  }

  function updatePeers () {
    log('updating peers')
    // TODO: better handle duplicate connections
    const _uniq = {}
    peers = peers.filter(p => p.isConnected() && !_uniq[p.id] && (_uniq[p.id] = true))
  }

  for (const cmdId in cmds) { // eslint-disable-line guard-for-in
    log('registering %s', cmdId)
    c[cmdId] = {
      async broadcast (_config, ...params) {
        updatePeers()

        const { percentage = 1, parallel = 1 } = Object.assign(Object.assign({}, config), _config)
        const pc = Math.round(peers.length * percentage)
        const pl = shuffle(peers).slice(0, pc)

        log('broadcast %s to %o peers (%=%o, p=%o)', cmdId, pl.length, percentage, parallel)

        const res = await pipe(
          parallelMap(parallel, async (peer) => {
            let res
            try {
              res = await peer.doRequest(cmdId, ...params)
            } catch (err) {
              return { type: 'e', isErr: true, peer: peer.id, err }
            }

            return { type: 'r', isRes: true, peer: peer.id, res }
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

        log('multicast %s to %o peers (%=%o, p=%o) limits success %o, failure %o', cmdId, pl.length, percentage, parallel, successMax, failureMax)

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
          log('single dial %s', peer.id.toB58String())
          await dial(peer)
          return c[cmdId].single(peer, ...params)
        }

        log('single request %s on %s', cmdId, peer.id.toB58String())

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
