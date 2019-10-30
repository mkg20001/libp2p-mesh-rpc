'use strict'

/* eslint-disable no-throw-literal */
/* eslint-disable max-depth */

const pipe = require('it-pipe')

const { RPC, Error } = require('./proto')
const pb = require('it-protocol-buffers')

const Pushable = require('it-pushable')
const { map } = require('streaming-iterables')

// TODO: remove on upgrade to libp2p v2
const toIterator = require('pull-stream-to-async-iterator')
const toPull = require('async-iterator-to-pull-stream')
const toBuffer = require('it-buffer')
const pull = require('pull-stream')
const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))

const debug = require('debug')
const log = debug('libp2p:mesh-rpc:controller-inner')

module.exports = async (isClient, conn, rpcController) => {
  let rid = isClient ? 1 : 0

  const requests = {}
  const push = Pushable()

  const peer = await prom(cb => conn.getPeerInfo(cb))
  const id = peer.id.toB58String()

  log('wrapping %s', id)

  pipe(
    toIterator(conn.source),
    pb.decode(RPC),
    map(async ({ rid, error, cmd: CMD, data }) => {
      const isEven = Boolean(rid % 2)
      const isReq = (!isEven && isClient) || (isEven && !isClient)

      log('got rpc  src=%o(%s)  rid=%o#%s\tcmd=%o\terror=%o\tdata=%o', id, isClient ? 'c' : 's', rid, isReq ? 'req' : 'res', CMD, error, data && data.length)

      try {
        const cmd = rpcController.get(CMD)

        if (isReq) {
          if (cmd.handler.server) {
            if (error) {
              // ignore
              return
            } else {
              let req
              try {
                req = cmd.rpc.request.decode(data)
              } catch (err) {
                throw 400
              }

              let res

              try {
                res = await cmd.handler.server(peer, req)
              } catch (err) {
                throw 900
              }

              try {
                res = await cmd.rpc.response.encode(res)
              } catch (err) {
                throw 500
              }

              return { rid, cmd: CMD, data: res }
            }
          } else {
            throw 404
          }
        } else {
          if (cmd.handler.client) {
            const req = requests[rid]

            if (!req) {
              throw 500
            } else {
              if (error) {
                req.reject(error)
                return
              } else {
                req.resolve(data)
                return
              }
            }
          }
        }
      } catch (err) {
        if (typeof err === 'number') {
          return { rid, cmd: CMD, error: err }
        } else if (err.code) {
          return { rid, cmd: CMD, error: err.code }
        } else {
          return { rid, cmd: CMD, error: Error.INTERNAL_SERVER_ERROR }
        }
      }
    }),
    async (source) => {
      for await (const msg of source) {
        if (msg) {
          push.push(msg)
        }
      }
    }
  )

  const sink = toPull.source(pipe(
    push,
    pb.encode(RPC),
    toBuffer
  ))

  pull(
    sink,
    conn.sink
  )

  return {
    id,
    end: () => {

    },
    isConnected: () => { // TODO: add
      return true
    },
    doRequest: async (cmdID, ...params) => {
      let cmd
      let _rid

      try {
        cmd = rpcController.get(cmdID)

        if (!cmd.handler.client) {
          throw 404
        }

        return await cmd.handler.client(peer, async (data) => { // everything in here will be caught
          data = cmd.rpc.request.encode(data)

          const res = await new Promise((resolve, reject) => {
            _rid = rid
            rid += 2

            requests[_rid] = { resolve, reject }

            push.push({ rid: _rid, cmd: cmdID, data })
          })

          delete requests[rid]

          return cmd.rpc.response.decode(res)
        }, ...params)
      } catch (err) {
        delete requests[rid]
        throw rpcController.errorFactory(cmd, peer, err)
      }
    }
  }
}
