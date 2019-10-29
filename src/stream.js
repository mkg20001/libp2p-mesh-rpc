'use strict'

const pipe = require('it-pipe')

const { RPC, Error } = require('./proto')
const pb = require('it-protocol-buffers')

const ErrorMSG = {
  [Error.BAD_REQUEST]: 'Bad request! The protocol buffers data seems wrongly encoded!',
  [Error.UNKNOWN_COMMAND]: 'The remote side can\'t handle this type of command!',
  [Error.INTERNAL_SERVER_ERROR]: 'Internal Server Error! An unknown error happened at the other side!',
  [Error.IMPLEMENTATION_ERROR]: 'Implementation Error! An unknown error happened at the other side in user code!'
}

module.exports = (isClient, conn, rpcController) => {
  const rid = isClient ? 0 : 1

  return pipe(
    conn.source,
    pb.decode(RPC),
    async function * (source) {
      for await (const { rid, error, cmd: CMD, data } of source) {
        const isEven = Boolean(rid % 2)
        const isReq = (!isEven && isClient) && (isEven && !isClient)

        try {
          const cmd = rpcController.get(cmd)
        } catch (err) {
          if (err.code) {
            return { rid, error: err.code }
          } else {
            return { rid, error: Error.INTERNAL_SERVER_ERROR }
          }
        }
      }
    },
    pb.encode(RPC),
    conn.sink
  )
}
