'use strict'

/* eslint-env mocha */

const { factory } = require('./utils')

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
})
