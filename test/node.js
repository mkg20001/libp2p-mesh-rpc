'use strict'

const Libp2p = require('libp2p')
const Id = require('peer-id')
const Peer = require('peer-info')
const TCP = require('libp2p-tcp')
const MPLEX = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const MulticastDNS = require('libp2p-mdns')

const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))

const config = {
  // The libp2p modules for this libp2p bundle
  modules: {
    transport: [
      TCP
    ],
    streamMuxer: [
      MPLEX
    ],
    connEncryption: [
      SECIO
    ],
    peerDiscovery: [
      MulticastDNS
    ]
  },

  // libp2p config options (typically found on a config.json)
  config: { // The config object is the part of the config that can go into a file, config.json.
    peerDiscovery: {
      autoDial: true, // Auto connect to discovered peers (limited by ConnectionManager minPeers)
      mdns: { // mdns options
        interval: 1000, // ms
        enabled: true
      }
    },
    relay: { // Circuit Relay options
      enabled: true,
      hop: {
        enabled: false,
        active: false
      }
    }
  }
}

module.exports = async (listen) => {
  const options = Object.assign({}, config)
  const id = await prom(cb => Id.create({ type: 'rsa', size: 2048 }, cb))
  const peerInfo = new Peer(id)
  listen.forEach(addr => peerInfo.multiaddrs.add(addr))
  options.peerInfo = peerInfo
  const node = new Libp2p(options)
  node.p = peerInfo
  node.a = peerInfo.multiaddrs.toArray()[0]
}
