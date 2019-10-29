'use strict'

const protons = require('protons')

module.exports = protons(`

enum Error {
  OK                    = 0;
  BAD_REQUEST           = 400;
  UNKNOWN_COMMAND       = 401;
  INTERNAL_SERVER_ERROR = 500;
  IMPLEMENTATION_ERROR  = 900; // this indicates an error from the implementation of the _user code_ not the libp2p/mesh-rpc code (TODO: leaks too much?)
}

message RPC {
  int64 rid = 1; // (incoming) client: even=res, odd=req | server: even=req, odd=res
  Error error = 2; // the error, if any
  string cmd = 3; // command ID
  bytes data = 4; // the req/res data
}

`)
