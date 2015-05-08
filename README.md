![image_squidhome@2x.png](http://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Oracle_logo.svg/2000px-Oracle_logo.svg.png)

# waterline-oracle

Provides easy access to `oracle databases` from Sails.js & Waterline.

This module is a Waterline/Sails adapter, an early implementation of a rapidly-developing, tool-agnostic data standard.  Its goal is to provide a set of declarative interfaces, conventions, and best-practices for integrating with all sorts of data sources.  Not just databases-- external APIs, proprietary web services, or even hardware.

Strict adherence to an adapter specification enables the (re)use of built-in generic test suites, standardized documentation, reasonable expectations around the API for your users, and overall, a more pleasant development experience for everyone.


### Installation

* Add following dependency to package.json : 

"waterline-oracle-adapter": "AnyPresence/waterline-oracle-adapter#TAG_VERSION" (make sure to replace TAG_VERSION with a valid one)

* In config/connections.js, add following adapter configuration:

  storage_adapter_33: {
    adapter: 'waterline-oracle',                                                                                   
    username: props.getProperty("ORACLE_USERNAME"),                  
    password: props.getProperty("ORACLE_PASSWORD"),                  
    database: props.getProperty("ORACLE_DATABASE"),                  
    host: props.getProperty("ORACLE_HOST"),                          
    port: props.getProperty("ORACLE_PORT"),                          
  },
  
  where properties are set in .env file in root application folder.
  
  
! Take in consideration that you will require to provide proper authorization configuration for the models. This is a sample Authorizations.js file to have access to defined columns over a Person model:


  module.exports = {
  'v1person': {
    'requiresAuthentication': false,

    'Unauthenticated Default': {
      'permittedScopes': [ 'all', 'exactMatch', 'count', 'countExactMatch' ],
      'objectLevelPermissions': [ 'create', 'read', 'update', 'delete' ],
      'fieldLevelPermissions': {
        'creatable': [ 'age', 'name', 'lastname', 'id' ],
        'updatable': [ 'age', 'name', 'lastname', 'id' ],
        'readable' : [ 'age', 'name', 'lastname', 'id' ]
      }
    },
  },
};

creatable, updatable, and readable arrays specifies for the *Unauthenticated Default* role to which fields of the *v1person* model has access to create, update, and read determined fields. 


  




