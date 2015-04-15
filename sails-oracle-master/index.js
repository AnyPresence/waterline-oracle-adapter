/*---------------------------------------------------------------
  :: sails-boilerplate
  -> adapter
---------------------------------------------------------------*/

var async = require('async'),
    _ = require('underscore'),
    oracle = require('oracle'),
    sql = require('./lib/sql.js'),
    Query = require('./lib/query'),
    utils = require('./lib/utils');
_.str = require('underscore.string');

module.exports = (function() {


  var dbs = {};

  var adapter = {

    // Set to true if this adapter supports (or requires) things like data types, validations, keys, etc.
    // If true, the schema for models using this adapter will be automatically synced when the server starts.
    // Not terribly relevant if not using a non-SQL / non-schema-ed data store
    syncable: false,

    // Including a commitLog config enables transactions in this adapter
    // Please note that these are not ACID-compliant transactions: 
    // They guarantee *ISOLATION*, and use a configurable persistent store, so they are *DURABLE* in the face of server crashes.
    // However there is no scheduled task that rebuild state from a mid-step commit log at server start, so they're not CONSISTENT yet.
    // and there is still lots of work to do as far as making them ATOMIC (they're not undoable right now)
    //
    // However, for the immediate future, they do a great job of preventing race conditions, and are
    // better than a naive solution.  They add the most value in findOrCreate() and createEach().
    // 
    // commitLog: {
    //  identity: '__default_mongo_transaction',
    //  adapter: 'sails-mongo'
    // },

    // Default configuration for collections
    // (same effect as if these properties were included at the top level of the model definitions)
    defaults: {

      // For example:
      // port: 3306,
      // host: 'localhost'
      tns: '',
      user: '',
      password: '',

      // If setting syncable, you should consider the migrate option, 
      // which allows you to set how the sync will be performed.
      // It can be overridden globally in an app (config/adapters.js) and on a per-model basis.
      //
      // drop   => Drop schema and data, then recreate it
      // alter  => Drop/add columns as necessary, but try 
      // safe   => Don't change anything (good for production DBs)
      migrate: 'safe'
    },

    config: {

    },

    // This method runs when a model is initially registered at server start time
    registerCollection: function(collection, cb) {

      var def = _.clone(collection);
      var key = def.identity;
      var definition = def.definition || {};

      // Set a default Primary Key
      var pkName = 'id';

      // Set the Primary Key Field
      for(var attribute in definition) {
        if(!definition[attribute].hasOwnProperty('primaryKey')) continue;

        // Check if custom primaryKey value is falsy
        if(!definition[attribute].primaryKey) continue;

        // Set the pkName to the custom primaryKey value
        pkName = attribute;
      }
      // Set the primaryKey on the definition object
      def.primaryKey = pkName;

      // Store the definition for the model identity
      if(dbs[key]) return cb();
      dbs[key.toString()] = def;


      return cb();
    },


    // The following methods are optional
    ////////////////////////////////////////////////////////////

    // Optional hook fired when a model is unregistered, typically at server halt
    // useful for tearing down remaining open connections, etc.
    teardown: function(cb) {
      cb();
    },


    // REQUIRED method if integrating with a schemaful database
    define: function(collectionName, definition, cb) {

      // Define a new "table" or "collection" schema in the data store
      cb();
    },
    // REQUIRED method if integrating with a schemaful database
    describe: function(collectionName, cb) {

      // Respond with the schema (attributes) for a collection or table in the data store
      var attributes = {};
      cb(null, attributes);
    },

    // Direct access to query
    query: function(collectionName, query, data, cb) {
      if (_.isFunction(data)) {
        cb = data;
        data = null;
      }

      spawnConnection(function(connection, cb) {

        // Run query
        //if (data) connection.execute(query, data, cb);
        connection.execute(query, [],  cb);

      }, dbs[collectionName].config, cb);
    },

    // REQUIRED method if integrating with a schemaful database
    drop: function(collectionName, cb) {
      // Drop a "table" or "collection" schema from the data store
      cb();
    },

    // Optional override of built-in alter logic
    // Can be simulated with describe(), define(), and drop(),
    // but will probably be made much more efficient by an override here
    // alter: function (collectionName, attributes, cb) { 
    // Modify the schema of a table or collection in the data store
    // cb(); 
    // },


    // REQUIRED method if users expect to call Model.create() or any methods
    create: function(collectionName, data, cb) {
      spawnConnection(function(connection, cb) {

        // Prepare values
        Object.keys(data).forEach(function(value) {
          data[value] = utils.prepareValue(data[value]);
        });

        var query = sql.insertQuery(dbs[collectionName].config.dbName+'.'+dbs[collectionName].identity, data);


        // Run query
        connection.execute(query, [], function(err, result) {

          if (err) return cb(err);

          // Build model to return
          var model = data;

          // If the insertId is non-zero, an autoIncrement column was incremented to this value.
          if (result.insertId && result.insertId !== 0) {
               model = _.extend({}, data);
          }

          // Build a Query Object
          var _query = new Query(dbs[collectionName].definition);

          // Cast special values
          var values = _query.cast(model);

          cb(err, values);
        });
      }, dbs[collectionName].config, cb);
    },


    // Override of createEach to share a single connection
    // instead of using a separate connection for each request
    createEach: function (collectionName, valuesList, cb) {
  

      var query = sql.insertManyQuery(dbs[collectionName].config.dbName+'.'+dbs[collectionName].identity, valuesList);

      // query = query.join(';')+';';
      // console.log(query);

      spawnConnection(function(connection, callbackConnection) {
        async.eachSeries(query,function(q,callbackSeries) {

            connection.execute(q, [], function(err, results) {

              if (err) { console.log(err); return callbackSeries(err); }
              callbackSeries(err,results)
            });

        },function(err,ret) {

          if (err) { console.log(err); return callbackConnection(err); }
          
          callbackConnection(err,valuesList);
        })

      }, dbs[collectionName].config, cb);
    },

    // REQUIRED method if users expect to call Model.find(), Model.findAll() or related methods
    // You're actually supporting find(), findAll(), and other methods here
    // but the core will take care of supporting all the different usages.
    // (e.g. if this is a find(), not a findAll(), it will only close back a single model)
    find: function(collectionName, options, cb) {

      spawnConnection(function(connection, cb) {

        // Check if this is an aggregate query and that there is something to return
        if(options.groupBy || options.sum || options.average || options.min || options.max) {
          if(!options.sum && !options.average && !options.min && !options.max) {
            return cb(new Error('Cannot groupBy without a calculation'));
          }
        }

        // Build find query
        var query = sql.selectQuery(dbs[collectionName].config.dbName+'.'+dbs[collectionName].identity, options);
        // Run query
        connection.execute(query,[], function(err, result) {

          if(err) return cb(err);

          var values = [];

          // Build a Query Object
          var _query = new Query(dbs[collectionName].definition);

          result.forEach(function(item) {
            values.push(_query.cast(item));
          });

          cb(err, values);
        });
      }, dbs[collectionName].config, cb);
    },

    // REQUIRED method if users expect to call Model.update()
    update: function(collectionName, options, values, cb) {
      spawnConnection(function(connection, cb) {

        // Escape table name
        var tableName = (dbs[collectionName].identity);

        // Find the record before updating it
        var criteria = sql.serializeOptions(dbs[collectionName].identity, options);

        // Store the Primary Key attribute
        var pk = dbs[collectionName].primaryKey;

        var query = 'SELECT * FROM ' + dbs[collectionName].config.dbName+'.'+tableName + ' ' + criteria;

        // Prepare values
        Object.keys(values).forEach(function(value) {
          values[value] = utils.prepareValue(values[value]);
        });

        // Build query
        var query = 'UPDATE ' + tableName + ' SET ' + sql.updateCriteria(dbs[collectionName].identity, values) + ' ';

        query += sql.serializeOptions(dbs[collectionName].identity, options);

        // Run query
        connection.execute(query, [], function(err, result) {
          if (err) return cb(err);

          if (typeof result.updateCount == 'undefined' || parseInt(result.updateCount) <= 0) {
              return cb({ error: 'Ocorreu um erro ao atualizar o registro.' });
          }

          // the update was successful, select the updated records
          adapter.find(collectionName, options, function(err, models) {
            if (err) return cb(err);

            var values = [];

            // Build a Query Object
            var _query = new Query(dbs[collectionName].definition);

            models.forEach(function(item) {
              values.push(_query.cast(item));
            });

            cb(err, values);
          });

        });
      }, dbs[collectionName].config, cb);
    },

    // REQUIRED method if users expect to call Model.destroy()
    destroy: function(collectionName, options, cb) {
      spawnConnection(function(connection, cb) {

        // Escape table name
        var tableName = (dbs[collectionName].identity);

        // Build query
        var query = 'DELETE FROM ' + dbs[collectionName].config.dbName+'.'+tableName + ' ';

        query += sql.serializeOptions(dbs[collectionName].config.dbName+'.'+dbs[collectionName].identity, options);


        // Run query
        connection.execute(query, [], function(err, result) {

          cb(err, result);
        });
      }, dbs[collectionName].config, cb);
    },



    // REQUIRED method if users expect to call Model.stream()
    stream: function(collectionName, options, stream) {
      // options is a standard criteria/options object (like in find)

      // stream.write() and stream.close() should be called.
      // for an example, check out:
      // https://github.com/balderdashy/sails-dirty/blob/master/DirtyAdapter.js#L247

    },



    /*
  **********************************************
  * Optional overrides
  **********************************************

  // Optional override of built-in batch create logic for increased efficiency
  // otherwise, uses create()
  createEach: function (collectionName, cb) { cb(); },

  // Optional override of built-in findOrCreate logic for increased efficiency
  // otherwise, uses find() and create()
  findOrCreate: function (collectionName, cb) { cb(); },

  // Optional override of built-in batch findOrCreate logic for increased efficiency
  // otherwise, uses findOrCreate()
  findOrCreateEach: function (collectionName, cb) { cb(); }
  */


    /*
  **********************************************
  * Custom methods
  **********************************************

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // > NOTE:  There are a few gotchas here you should be aware of.
  //
  //    + The collectionName argument is always closeed as the first argument.
  //      This is so you can know which model is requesting the adapter.
  //
  //    + All adapter functions are asynchronous, even the completely custom ones,
  //      and they must always include a callback as the final argument.
  //      The first argument of callbacks is always an error object.
  //      For some core methods, Sails.js will add support for .done()/promise usage.
  //
  //    + 
  //
  ////////////////////////////////////////////////////////////////////////////////////////////////////


  // Any other methods you include will be available on your models
  foo: function (collectionName, cb) {
    cb(null,"ok");
  },
  bar: function (collectionName, baz, watson, cb) {
    cb("Failure!");
  }


  // Example success usage:

  Model.foo(function (err, result) {
    if (err) console.error(err);
    else console.log(result);

    // outputs: ok
  })

  // Example error usage:

  Model.bar(235, {test: 'yes'}, function (err, result){
    if (err) console.error(err);
    else console.log(result);

    // outputs: Failure!
  })

  */


  };

  return adapter;


  //////////////                 //////////////////////////////////////////
  ////////////// Private Methods //////////////////////////////////////////
  //////////////                 //////////////////////////////////////////


  // Wrap a function in the logic necessary to provision a connection
  // (either grab a free connection from the pool or create a new one)
  // cb is optional (you might be streaming)
  function spawnConnection(logic, config, cb) {


    // Use a new connection each time
    //if (!config.pool) {
      oracle.connect(marshalConfig(config),function(err, connection) {
        afterwards(err, connection);
      });
    //}

    // Use connection pooling
    //else {
     // adapter.pool.getConnection(afterwards);
    //}

    // Run logic using connection, then release/close it

    function afterwards(err, connection) {
      if (err) {
        console.error("Error spawning mySQL connection:");
        console.error(err);
        if (connection) connection.close();
        return cb(err);
      }

      // console.log("Provisioned new connection.");
      // handleDisconnect(connection, config);
     // "ALTER SESSION SET nls_date_Format = 'YYYY-MM-DD:HH24:MI:SS'"

      connection.execute("ALTER SESSION SET nls_date_Format = 'YYYY-MM-DD:HH24:MI:SS'",[],function(err,results) {
        logic(connection, function(err, result) {

          if (err) {
            cb(err,1)
            console.error("Logic error in Oracle ORM.");
            console.error(err);
            connection.close();
            return ;
          }

          connection.close();
            cb(err, result);
        });
      });
    }
  }

  function handleDisconnect(connection, config) {
    connection.on('error', function(err) {
      // if (!err.fatal) {
      //  return;
      // }

      if (!err || err.code !== 'PROTOCOL_CONNECTION_LOST') {
        // throw err;
      }

      console.error('Re-connecting lost connection: ' + err.stack);
      console.error(err);


      connection = mysql.createConnection(marshalConfig(config));
      connection.connect();
      // connection = mysql.createConnection(connection.config);
      // handleDisconnect(connection);
      // connection.connect();
    });
  }

  // Convert standard adapter config
  // into a custom configuration object for node-mysql
  function marshalConfig(config) {
    return {
      tns: config.tns,
      user: config.user,
      password: config.password,
    };
  }


})();
