![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)

# OracleAdapter

Waterline adapter for Oracle.

## Installation

Install from NPM.

```bash
$ npm install sails-oracle
```

## Sails Configuration

Add the oracle config to the config/adapters.js file:

```javascript
module.exports.adapters = {
  'default': 'sails-oracle',

  // sails v.0.9.0
  oracle: {
    "tns" : "(DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = <<0.0.0.0>>)(PORT = 1521))(CONNECT_DATA =(SERVER = DEDICATED)(SERVICE_NAME = <<SERVICE_NAME>>)))",
    "user" : "<<USER>>",
    "password" : "<<PASSWORD>>",
    "dbName" : "<<DBNAME>>"
  }
};
```

## Sails.js

http://sailsjs.org

## Waterline

[Waterline](https://github.com/balderdashy/waterline) is a brand new kind of storage and retrieval engine.

It provides a uniform API for accessing stuff from different kinds of databases, protocols, and 3rd party APIs. That means you write the same code to get users, whether they live in MySQL, LDAP, OracleDB, or Facebook.


## Contributors

Thanks so much to Ted Kulp ([@tedkulp](https://twitter.com/tedkulp)) and Robin Persson ([@prssn](https://twitter.com/prssn)) for building this adapter.


## Sails.js License

### The MIT License (MIT)

Copyright © 2012-2013 Mike McNeil

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/cf33b4e93461d21207db0633b8554c87 "githalytics.com")](http://githalytics.com/mayconheerdt/sails-oracle)