'use strict'

/* eslint-env mocha */

const { factory } = require('./utils')
const assert = require('assert').strict.deepEqual
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

  it('A should be able to dial & ping B', async () => {
    await peers[0].mesh.cmd.PING.single(peers[1].node.p)
  })

  it('A should be able to dial & greet C', async () => {
    const res = await peers[0].mesh.cmd.HELLO.single(peers[2].node.p)
    assert(res, `Hello ${peers[0].node.p.id.toB58String()}`)
  })

  it('A should be able to broadcast ping', async () => {
    const res = await peers[0].mesh.cmd.PING.broadcast({})
    res.forEach(r => (delete r.peer))
    assert(res, [
      { type: 'r', isRes: true, res: {} },
      { type: 'r', isRes: true, res: {} }
    ])
  })

  after(async () => {
    peers.map(p => prom(cb => p.node.stop(cb))) // TODO: await prom
  })
})
