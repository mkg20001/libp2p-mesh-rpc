'use strict'

const Joi = require('@hapi/joi')

module.exports = {
  schema: Joi.object({
    cmds: Joi.object().pattern(/[A-Z0-9_]+/, Joi.object({
      errors: Joi.object().pattern(/\d+/, Joi.string().required()).required(),
      rpc: Joi.object({
        request: Joi.object({
          decode: Joi.function().arity(1).required(),
          encode: Joi.function().arity(1).required()
        }).required(),
        result: Joi.object({
          decode: Joi.function().arity(1).required(),
          encode: Joi.function().arity(1).required()
        }).required()
      }).required(),
      handler: Joi.object({
        client: Joi.function().minArity(1),
        server: Joi.function().minArity(1)
      }).required()
    })).required(),
    protocol: Joi.string().required(),
    config: Joi.object({
      autoDial: Joi.boolean().default(true),
      parallel: Joi.number().integer().min(0).max(1024).default(1),
      roundRobin: Joi.object({
        successMax: Joi.number().integer().min(0).max(1024).default(1),
        failureMax: Joi.number().integer().min(0).max(1024).default(0),
        percentage: Joi.number().min(0).max(1).default(1),
        parallel: Joi.number().integer().min(0).max(1024).default(1)
      }).default({ successMax: 1, failureMax: 0, parallel: 1 }),
      broadcast: Joi.object({
        percentage: Joi.number().min(0).max(1).default(1),
        parallel: Joi.number().integer().min(0).max(1024).default(1)
      }).default({ percentage: 1 })
    }).required()
  })
}
