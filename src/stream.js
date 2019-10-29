'use strict'

/* eslint-disable no-throw-literal */
/* eslint-disable max-depth */

const pipe = require('it-pipe')

const { RPC, Error } = require('./proto')
const pb = require('it-protocol-buffers')

const Pushable = require('it-pushable')
const { map } = require('streaming-iterables')

module.exports = (isClient, conn, rpcController) => {
  const rid = isClient ? 0 : 1

  const requests = {}
  const push = Pushable()

  const peer = null // TODO: add

  pipe(
    conn.source,
    pb.decode(RPC),
    map(async ({ rid, error, cmd: CMD, data }) => {
      const isEven = Boolean(rid % 2)
      const isReq = (!isEven && isClient) && (isEven && !isClient)

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
                res = await cmd.handler.server(req)
              } catch (err) {
                throw 900
              }

              try {
                res = await cmd.rpc.result.encode(res)
              } catch (err) {
                throw 500
              }

              return { rid, data: res }
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
                req.reject(rpcController.errorFactory(cmd, peer, error))
                return
              } else {
                let res
                try {
                  res = cmd.rpc.result.decode(data)
                } catch (err) {
                  req.reject(rpcController.errorFactory(cmd, peer, err))
                  return
                }

                req.resolve(res)
                return
              }
            }
          }
        }
      } catch (err) {
        if (typeof err === 'number') {
          return { rid, error: err }
        } else if (err.code) {
          return { rid, error: err.code }
        } else {
          return { rid, error: Error.INTERNAL_SERVER_ERROR }
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

  pipe(
    push,
    pb.encode(RPC),
    conn.sink
  )
}
