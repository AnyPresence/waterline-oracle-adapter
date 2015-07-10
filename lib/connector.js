var oracledb = require('oracledb');
var Promise = require('es6-promise').Promise;
var async = require('async');
var pool;
var buildupScripts = [];
var teardownScripts = [];
var sql = require('squel');

const OPERATIONS = Object.freeze({INSERT: 1, FIND: 2, DELETE: 3, UPDATE: 4});

/**
 * Creates a dabatase connection pool
 * @param config database configuration
 * @returns {*}
 */
function createPool(config) {
    return new Promise(function (resolve, reject) {
        oracledb.createPool(
            config,
            function (err, p) {
                if (err) {
                    return reject(err);
                }
                pool = p;
                resolve(pool);
            }
        );
    });
}

/**
 * @returns {*} terminates pool
 */
function terminatePool() {
    return new Promise(function (resolve, reject) {
        if (pool) {
            pool.terminate(function (err) {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        } else {
            resolve();
        }
    });
}

/**
 * @returns {*} reeturns connection pool
 */
function getPool() {
    return pool;
}

/**
 * @param statement Adds SQL statement
 */
function addBuildupSql(statement) {
    var stmt = {
        sql: statement.sql,
        binds: statement.binds || {},
        options: statement.options || {}
    };

    buildupScripts.push(stmt);
}

/**
 * @param statement SQL Statement
 */
function addTeardownSql(statement) {
    var stmt = {
        sql: statement.sql,
        binds: statement.binds || {},
        options: statement.options || {}
    };

    teardownScripts.push(stmt);
}

/**
 * @returns {*} Database connection
 */
function getConnection() {
    return new Promise(function (resolve, reject) {
        pool.getConnection(function (err, connection) {
            if (err) {
                return reject(err);
            }
            async.eachSeries(
                buildupScripts,
                function (statement, callback) {
                    connection.execute(statement.sql, statement.binds, statement.options, function (err) {
                        callback(err);
                    });
                },
                function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(connection);
                }
            );
        });
    });
}

/**
 * Executes a SQL statement
 * @param sql SQL statement
 * @param bindParams sql binded parameters (:param)
 * @param options options
 * @param connection database connection
 * @returns {*} statement result
 */
function execute(sql, bindParams, options, connection) {
    return new Promise(function (resolve, reject) {
        connection.execute(sql, bindParams, options, function (err, results) {
            if (err) {
                return reject(err);
            }

            if (!results.rows) results.rows = [];
            resolve(results);
        });
    });
}

/**
 * @param connection database connection
 */
function releaseConnection(connection) {
    async.eachSeries(
        teardownScripts,
        function (statement, callback) {
            connection.execute(statement.sql, statement.binds, statement.options, function (err) {
                callback(err);
            });
        },
        function (err) {
            if (err) {
                console.error(err); //don't return as we still need to release the connection
            }

            connection.release(function (err) {
                if (err) {
                    console.error(err);
                }
            });
        }
    );
}

/**
 * This is workaround to avoid a breaking issue between oracle driver and
 * sails waterline, and how functions are interpolated.
 * Essentially, waterline uses column names to generate dynamic query
 * functions (in example : findById). Dynamic query functions uses the
 * column name to generate names, and since oracle columns are always
 * upper case, lowercase 'id' will never be generated (instead,
 * findByID will be generated). To avoid this issue, a lowercase id
 * field is added in case of ID present.
 * @param result result set to be updated
 * @returns {*} updated result set
 */
function setIdOnReturnedObjects(result) {
    if (result && result.rows) {
        result.rows.forEach(function (obj) {
            if (obj && obj.ID && !obj.id) obj.id = obj.ID;
        });
    }
    return result;
}

/**
 * @param sql SQL statement to be executed
 * @param bindParams bindable params (:param like).
 * @param options query options, isAutoCommit
 * @returns {*} result of executed operation
 */
function simpleExecute(sql, bindParams, options) {
    options.isAutoCommit = true;
    return new Promise(function (resolve, reject) {
        getConnection()
            .then(function (connection) {
                execute(sql, bindParams, options, connection)
                    .then(function (result) {
                        result = setIdOnReturnedObjects(result)
                        resolve(result);
                        process.nextTick(function () {
                            releaseConnection(connection);
                        });
                    })
                    .catch(function (err) {
                        if (err) {
                            return reject(err);
                        }
                        process.nextTick(function () {
                            releaseConnection(connection);
                        });
                    });
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * Function in charge of establishing a connection to the oracle instance as well as executing the given query
 * @param database oracle instance connection data.
 * @param query the sql query to be executed
 * @param model the model name
 * @param cb the function callback
 */
function run(database, query, model, cb) {
    database.simpleExecute(query, {}, {outFormat: database.OBJECT})
        .then(function (results) {
            if (!results.rows) return cb();
            results = results.rows;
            var waterlineAdaptedResults = [];
            if (results && results.length > 0) {
                results.forEach(function (obj) {
                    waterlineAdaptedResults.push(new model._model(obj, {}));
                });
                return cb(null, waterlineAdaptedResults);
            } else {
                return cb(null, results);
            }
        })
        .catch(function (err) {
            return cb(err);
        });
}

/**
 * Given an operation, a table name, an entity object and an an options object (if required)
 * this functions attempts to build an ANSI SQL statement
 * @param operation the required operation (INSERT, FIND, DELETE, UPDATE)
 * @param table The name of the table
 * @param entity the entity object (In example: in INSERT, the entity to be added)
 * @param options (an options object, containing additional query information)
 * @returns {*}
 */
function buildQuery(operation, table, entity, options) {
    var query;
    var opts = options || {};

    /**
     * Oracle requires invocation of specific function to correctly format values.
     * In case of dates, TO_DATE function needs to be invoked. In order to
     * support function call from SQL, we will need to wrap provided date value in a Oracle's TO_DATE function call
     * @param value the date value
     * @returns {*}
     * @private
     */
    var _transformNonSupportedTypeToString = function(value){
        var _isDate = function(value){
            return value && typeof value === "object" && value.setUTCMilliseconds;
        }

        //TODO: Maybe designer would provide date format somewhere?
        if (_isDate(value)) return "TO_DATE('" + value.toISOString().slice(0,10) + " " + value.toISOString().slice(11, 19) + "', 'yyyy-mm-dd hh24:mi:ss')";
        return value;
    };

    switch (operation) {
        case 1:
            query = sql.insert().into(table);
            break;
        case 2:
            if (opts.limit || opts.skip) {
                return _createOracleSpecificQuery(table, opts.skip, opts.limit, options.where);
            } else {
                query = sql.select().from(table);
            }
            break;
        case 3:
            query = sql.delete().from(table);
            break;
        case 4:
            query = sql.update().table(table);
            break;
    }

    if (entity && operation != 3) {
        Object.keys(entity).forEach(function (fieldName) {
            query.set(fieldName, _transformNonSupportedTypeToString(entity[fieldName]));
        });
    }

    if (options && options.where) {
        var where = "(1=1) ";
        var opts = options.where;
        Object.keys(options.where).forEach(function (key) {
            where += "and " + key + " ='" + opts[key] + "' ";
        });
        query.where(where);
    }

    return query.toString().split("'TO_DATE").join("TO_DATE").split("')'").join("')");
}


/**
 * Most of ANSI SQL queries will work when querying oracle DB, but wont work on those queries that requires limit and/or
 * offset options. In that cases, it will be required to use rownum to create a new column to establish the range of
 * returned rows.
 * @param table the table name
 * @param offset the result offset
 * @param limit the result limit
 * @param whereClause where clause
 * @private
 */
function _createOracleSpecificQuery(table, offset, limit, whereClause) {
    var query = "select * from (select " + table + ".*, rownum as pseudo_column from " + table + " order by rowid) a where (1=1) ";
    if (offset) query += " and a.pseudo_column > " + offset + " ";
    if (limit && (limit != 1)) query += " and a.pseudo_column < " + limit + " ";
    if (whereClause) {
        Object.keys(whereClause).forEach(function (key) {
            query += " and " + key + " ='" + whereClause[key] + "' ";
        });
    }

    return query;
}

/**
 * Public Interface
 * @type {{simpleExecute: simpleExecute, releaseConnection: releaseConnection, execute: execute, getConnection: getConnection, addTeardownSql: addTeardownSql, addBuildupSql: addBuildupSql, getPool: getPool, terminatePool: terminatePool, createPool: createPool, OBJECT: *, execute: execute, buildQuery: buildQuery, OPERATIONS: OPERATIONS}}
 */
module.exports = {
    simpleExecute: simpleExecute,
    releaseConnection: releaseConnection,
    execute: execute,
    getConnection: getConnection,
    addTeardownSql: addTeardownSql,
    addBuildupSql: addBuildupSql,
    getPool: getPool,
    terminatePool: terminatePool,
    createPool: createPool,
    OBJECT: oracledb.OBJECT,
    run: run,
    buildQuery: buildQuery,
    OPERATIONS: OPERATIONS
};
