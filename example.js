'use strict'

const meshRPC = require('libp2p-mesh-rpc')
const fs = require('fs')

const { Fetch, FetchRes } = require('protons')(`

message Fetch {
  string fileName = 1;
  string encoding = 2;
}

message FetchRes {
  bytes data = 1;
}

`)

meshRPC({
  cmds: {
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
  },
  protocol: '/p2p/my-rpc/1.0.0',
  config: {
    autoDial: true, // auto-dial all discovered peers
    parallel: 1, // amount of parallel requests per client

    roundRobin: { // roundRobin config
      failureMax: 0,
      successMax: 1
    }
  }
})
