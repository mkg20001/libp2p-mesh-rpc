'use strict'

/* eslint-disable no-throw-literal */

const { Error } = require('./proto')
const Stream = require('./stream')

const debug = require('debug')
const log = debug('libp2p:mesh-rpc:controller-inner')

const ErrorMSG = {
  [Error.BAD_REQUEST]: 'Bad request! The protocol buffers data seems wrongly encoded!',
  [Error.UNKNOWN_COMMAND]: 'The remote side can\'t handle this type of command!',
  [Error.INTERNAL_SERVER_ERROR]: 'Internal Server Error! An unknown error happened at the other side!',
  [Error.IMPLEMENTATION_ERROR]: 'Implementation Error! An unknown error happened at the other side in user code!'
}

module.exports = (cmds) => {
  const C = {
    get: (id) => {
      log('get cmd %s', id)
      if (!cmds[id]) {
        throw 404
      }
      return cmds[id]
    },
    wrap: async (isClient, conn) => {
      return Stream(isClient, conn, C)
    },
    errorFactory: (cmd, peer, err) => {
      log('errorFactory called')

      let e

      if (typeof err === 'number') {
        const msgTable = cmd ? Object.assign(Object.assign({}, ErrorMSG), cmd.errors) : ErrorMSG
        e = new Error(`${err}: ${msgTable[err] || '(Unknown Error! Client may be outdated!)'}`)
        e.code = err
      } else {
        e = err
      }

      e.peer = peer.id.toB58String()
      e.cmd = cmd ? cmd.id : cmd

      throw e
    }
  }

  return C.wrap
}
