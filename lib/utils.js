var sql = require('squel');
var oracle = require("strong-oracle")({});

const OPERATIONS = Object.freeze({INSERT: 1, FIND: 2, DELETE: 3, UPDATE: 4});

/**
 *
 * @param connectionData
 * @param query
 * @param model
 * @param cb
 */
function execute(connectionData, query, model, cb) {
    oracle.connect(connectionData, function (err, connection) {
        connection.execute(query, [], function (err, results) {
            if (err) {
                return cb(err);
            } else {
                var waterlineAdaptedResults = [];
                if (results && results.length > 0) {
                    results.forEach(function (obj) {
                        waterlineAdaptedResults.push(new model._model(obj, {}));
                    })
                    return cb(null, waterlineAdaptedResults);
                } else {
                    return cb(null, results);
                }
            }
            connection.close(); // call this when you are done with the connection
        });
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

    if (entity) {
        Object.keys(entity).forEach(function (fieldName) {
            query.set(fieldName, entity[fieldName]);
        });
    }

    if (options.where) {
        var where = "(1=1) ";
        Object.keys(options.where).forEach(function (key) {
            where += " and " + key + " ='" + where[key] + "' ";
        });
    }

    return query.toString();
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
    if (limit) query += " and a.pseudo_column < " + limit + " ";
    if (whereClause) {
        Object.keys(whereClause).forEach(function (key) {
            query += " and " + key + " ='" + whereClause[key] + "' ";
        });
    }

    return query;
}


/**
 * Public Interface
 */
module.exports = {
    execute: execute,
    buildQuery: buildQuery,
    OPERATIONS: OPERATIONS
}
