var execute = require('./utils').execute;
var buildQuery = require('./utils').buildQuery;
var OPERATIONS = require('./utils').OPERATIONS;
var _ = require('lodash');
var inflection = require('inflection');

module.exports = (function () {
  var connections = {};
  var _collections = {};

  var adapter = {
    syncable: false,
    defaults: {
    },
    registerConnection: function(connection, collections, cb) {
      if(!connection.identity) return cb(new Error('Connection is missing an identity.'));
      if(connections[connection.identity]) return cb(new Error('Connection is already registered.'));

      _.keys(collections).forEach(function(key) {
        _collections[key] = collections[key];
      });

      connections[connection.identity] = connection;
      cb();
    },
    teardown: function (conn, cb) {
      if (typeof conn == 'function') {
        cb = conn;
        conn = null;
      }
      if (!conn) {
        connections = {};
        return cb();
      }
      if(!connections[conn]) return cb();
      delete connections[conn];
      cb();
    },
    describe: function (connection, collection, cb) {
      return cb();
    },
    define: function (connection, collection, definition, cb) {
      return cb();
    },
    drop: function (connection, collection, relations, cb) {
      return cb();
    },
    find: function (connection, collection, options, cb) {
      return execute(connections[Object.keys(connections)[0]], buildQuery(OPERATIONS.FIND, collection, null, options), _collections[collection], cb);
    },
    create: function (connection, collection, values, cb) {
      return execute(connections[Object.keys(connections)[0]], buildQuery(OPERATIONS.INSERT, collection, values, null), _collections[collection], cb);
    },
    update: function (connection, collection, options, values, cb) {
      return execute(connections[Object.keys(connections)[0]], buildQuery(OPERATIONS.UPDATE, collection, values, options), _collections[collection], cb);
    },
    destroy: function (connection, collection, options, values, cb) {
      return execute(connections[Object.keys(connections)[0]], buildQuery(OPERATIONS.DELETE, collection, values, options), _collections[collection], cb);
    }
  };

  return adapter;
})();

