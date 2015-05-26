var run = require('./connector').run;
var buildQuery = require('./connector').buildQuery;
var OPERATIONS = require('./connector').OPERATIONS;
var _ = require('lodash');
var database = require('./connector.js');

/**
 * Waterline uses columnName property -when defined on model- to define dynamic methods to access to instances. Since
 * oracle columns are always uppercase, id field on model needs columnName = ID. In example:
 *
 * id: {
 *       primaryKey: true,
 *       autoIncrement: true,
 *       columnName: 'ID',
 *       type: 'text'
 *     }
 *
 * Interpolated code in controllers expects for some cases the existance of a function findOneById, which wont exist,
 * since columnName for oracle needs to be 'ID', and then, the dynamically generated function will be 'findOneByID' (
 * note the ID in uppercase). To workaround this, during adapter bootstrap this function needs to be executed to copy
 * implementation of function findByOneID to findByOneId.
 *
 * @param collections collections object
 * @returns {*} augmented collections object with collections that now will contain a findOneById function
 * @private
 */
function _fixDynamicallyGeneratedFindById(collections) {
  Object.keys(collections).forEach(function(name){
    if(collections[name]["findOneByID"]) collections[name]["findOneById"] = collections[name]["findOneByID"];
  });

  return collections;
}

module.exports = (function () {
  var connections = {};
  var _collections = {};

  var adapter = {
    syncable: false,
    defaults: {},
    registerConnection: function (connection, collections, cb) {
      collections = _fixDynamicallyGeneratedFindById(collections);

      var _augmentConnectionWithOracleSpecificDate = function (connection) {
        connections[connection.identity].connectString = connection.host + ":" + connection.port + "/" + connection.database;
        connections[connection.identity].user = connection.username;
        connections[connection.identity].poolMax = 10;
        connections[connection.identity].poolMin = 2;
        connections[connection.identity].poolIncrement = 4;
        connections[connection.identity].poolTimeout = 4;
      };

      if (!connection.identity) return cb(new Error('Connection is missing an identity.'));
      if (connections[connection.identity]) return cb(new Error('Connection is already registered.'));

      _.keys(collections).forEach(function (key) {
        _collections[key] = collections[key];
      });

      connections[connection.identity] = connection;
      _augmentConnectionWithOracleSpecificDate(connection);

      database.addBuildupSql({ sql: "BEGIN EXECUTE IMMEDIATE q'[alter session set NLS_DATE_FORMAT='DD-MM-YYYY']'; END;" });
      database.addTeardownSql({ sql: "BEGIN sys.dbms_session.modify_package_state(sys.dbms_session.reinitialize); END;" });

      database.createPool(connections[connection.identity]).then(function () {

        cb();
      }).catch(function (err) {
        cb(err);
      });
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
      if (!connections[conn]) return cb();
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
      return run(database, buildQuery(OPERATIONS.FIND, collection, null, options), _collections[collection], cb);
    },
    create: function (connection, collection, values, cb) {
      return run(database, buildQuery(OPERATIONS.INSERT, collection, values, null), _collections[collection], cb);
    },
    update: function (connection, collection, options, values, cb) {
      return run(database, buildQuery(OPERATIONS.UPDATE, collection, values, options), _collections[collection], cb);
    },
    destroy: function (connection, collection, options, cb) {
      return run(database, buildQuery(OPERATIONS.DELETE, collection, null, options), _collections[collection], cb);
    }
  };

  return adapter;
})();
