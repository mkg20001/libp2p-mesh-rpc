'use strict'

const spawn = require('./node')
const Mesh = require('..')

const { Fetch, FetchRes } = require('protons')(`

message Fetch {
  string fileName = 1;
  string encoding = 2;
}

message FetchRes {
  bytes data = 1;
}

`)

const fs = require('fs')

const defaultCmds = {
  FETCH: {
    errors: {
      404: 'Request Entity Not Found!'
    },
    rpc: {
      request: Fetch,
      result: FetchRes
    },
    handler: {
      async client (send, fileName, encodingRead, encodingRes) { // return number here to be treated as error (will throw on client)
        const res = await send({ fileName, encoding: encodingRead }) // send the request (will be auto-encoded)
        return res.data.toString(encodingRes)
      },
      async server (req) { // return number here to be treated as error (will be sent to client)
        try {
          return { data: fs.readFileSync(req.fileName, req.encoding) }
        } catch (err) {
          if (err.code === 'ENOEXIS') {
            return 404 // send 404
          } else {
            throw err // re-throw
          }
        }
      }
    }
  }
}

async function factory (listen, cmds, proto, config) {
  const node = await spawn(listen)
  const mesh = await Mesh({
    cmds: cmds || defaultCmds,
    protocol: proto || '/p2p/mesh-rpc-test/1.0.0',
    config: config || {}
  })
  await node.start()

  return { node, mesh }
}

module.exports = {
  defaultCmds,
  factory,
  spawn
}
