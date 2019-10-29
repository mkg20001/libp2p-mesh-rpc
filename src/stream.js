'use strict'

const pipe = require('it-pipe')

const { RPC, Error } = require('./proto')

module.exports = (isClient) => {
  const rid = isClient ? 0 : 1

  return async function * (source) {

  }
}
