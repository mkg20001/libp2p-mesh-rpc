'use strict'

/* eslint-env mocha */

const { factory } = require('./utils')
const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))

const addrs = [
  '/ip4/127.0.0.1/tcp/33221',
  '/ip4/127.0.0.1/tcp/33222',
  '/ip4/127.0.0.1/tcp/33223'
]

describe('mesh-rpc', () => {
  let peers

  before(async () => {
    peers = await Promise.all(addrs.map(a => factory([a])))
  })

  it('A should be able to ping B', async () => {
    await peers[0].mesh.cmd.PING.single(peers[1].node.p)
  })

  after(async () => {
    peers.map(p => prom(cb => p.node.stop(cb))) // TODO: await prom
  })
})
