'use strict'

/* eslint-disable no-throw-literal */
/* eslint-disable max-depth */

const pipe = require('it-pipe')

const { RPC, Error } = require('./proto')
const pb = require('it-protocol-buffers')

const Pushable = require('it-pushable')
const { map } = require('streaming-iterables')

module.exports = (isClient, conn, rpcController) => {
  let rid = isClient ? 0 : 1

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

  pipe(
    push,
    pb.encode(RPC),
    conn.sink
  )

  return {
    end: () => {

    },
    isConnected: () => {

    },
    doRequest: async (cmdID, ...params) => {
      let cmd
      let _rid

      try {
        cmd = rpcController.get(cmdID)

        if (!cmd.handler.client) {
          throw 404
        }

        await cmd.handler.client(async (data) => { // everything in here will be caught
          data = cmd.rpc.request.encode(data)

          const res = await new Promise((resolve, reject) => {
            _rid = rid
            rid += 2

            requests[_rid] = { resolve, reject }

            push.push({ rid: _rid, cmd: cmdID, data })
          })

          delete requests[rid]

          return cmd.rpc.result.decode(res)
        }, ...params)
      } catch (err) {
        delete requests[rid]
        throw rpcController.errorFactory(cmd, peer, err)
      }
    }
  }
}
