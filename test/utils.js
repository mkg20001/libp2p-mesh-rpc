'use strict'

const spawn = require('./node')
const Mesh = require('..')
const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))

const { Fetch, FetchRes, Void, Greeting } = require('protons')(`

message Fetch {
  string fileName = 1;
  string encoding = 2;
}

message FetchRes {
  bytes data = 1;
}

message Void { }

message Greeting {
  string greeting = 1;
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
      response: FetchRes
    },
    handler: {
      async client (peer, send, fileName, encodingRead, encodingRes) { // return number here to be treated as error (will throw on client)
        const res = await send({ fileName, encoding: encodingRead }) // send the request (will be auto-encoded)
        return res.data.toString(encodingRes)
      },
      server (peer, req) { // return number here to be treated as error (will be sent to client)
        try {
          return { data: fs.readFileSync(req.fileName, req.encoding) }
        } catch (err) {
          if (err.code === 'ENOEXIST') {
            return 404 // send 404
          } else {
            throw err // re-throw
          }
        }
      }
    }
  },
  PING: {
    errors: {},
    rpc: {
      request: Void,
      response: Void
    },
    handler: {
      client (peer, send) {
        return send({})
      },
      server (peer) {
        return {}
      }
    }
  },
  HELLO: {
    errors: {},
    rpc: {
      request: Greeting,
      response: Greeting
    },
    handler: {
      async client (peer, send) {
        const res = await send({ greeting: `Hello ${peer.id.toB58String()}` })

        return res.greeting
      },
      server (peer) {
        return { greeting: `Hello ${peer.id.toB58String()}` }
      }
    }
  }
}

async function factory (listen, cmds, proto, config) {
  const node = await spawn(listen)
  const mesh = await Mesh({
    cmds: cmds || defaultCmds,
    protocol: proto || '/p2p/mesh-rpc-test/1.0.0',
    config: config || {},
    swarm: node
  })
  await prom(cb => node.start(cb))

  return { node, mesh }
}

module.exports = {
  defaultCmds,
  factory,
  spawn
}
