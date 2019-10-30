'use strict'

/* eslint-disable no-throw-literal */

const executionTypes = {
  simple: (config) => ({
    client: async (clientHandler, send, params) => {
      await clientHandler(send, ...params)
    },
    server: async (serverHandler, send, params) => {
      await send(await serverHandler(params))
    }
  }),
  stream: (config) => ({

  })
}

module.exports = (cmd, peer, client, rpcController, config) => {
  const requests = {}

  return {
    stream: {
      request: async ({ rid, cmd, data, error }) => {
        if (error) { // ignore
          return
        }

        // TODO: use queue

        let req

        try {
          req = cmd.rpc.request.decode(data)
        } catch (err) {
          throw 400
        }

        let res

        /* try {
          res = await cmd.handler.server(req)
        } catch (err) {
          throw 900
        }

        try {
          res = await cmd.rpc.result.encode(res)
        } catch (err) {
          throw 500
        }

        return { rid, cmd: CMD, data: res } */
      },
      result: async () => {

      }
    },
    api: {
      doRequest: async (cmdID, ...params) => {
        let cmd
        let rid

        try {
          cmd = rpcController.get(cmdID)

          if (!cmd.handler.client) {
            throw 404
          }

          rid = client.getRID()

          const send = (data) => new Promise((resolve, reject) => {
            if (!requests[rid]) {
              requests[rid] = {
                resolve: (data) => {
                  delete requests[rid]
                  resolve(cmd.rpc.result.decode(data))
                },
                reject: (err) => {
                  delete requests[rid]
                  reject(err)
                }
              }
            }

            data = cmd.rpc.request.encode(data)

            client.push({ rid, cmd: cmdID, data })
          })

          send[Symbol.asyncIterator] = {
            next: () => new Promise((resolve, reject) => {
              requests[rid] = {
                resolve: (value) => {
                  resolve({ value: cmd.rpc.result.decode(value), done: false })
                },
                reject: (err) => {
                  delete requests[rid]

                  if (err === 999) {
                    resolve({ done: true })
                  } else {
                    throw err
                  }
                }
              }
            })
          }

          const type = executionTypes[cmd.handler.type || 'simple']

          await type
        } catch (err) {
          delete requests[rid]
          throw rpcController.errorFactory(cmd, peer, err)
        }
      }
    }
  }
}
