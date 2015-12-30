'use strict';

var _AngularCollection = require('./AngularCollection');

var _AngularCollection2 = _interopRequireDefault(_AngularCollection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var angular = typeof window !== 'undefined' && window.angular ? window.angular : require('angular');
var Collection = typeof window !== 'undefined' && window.Mars ? window.Mars.Collection : require('../Collection').default;

// Setup mars $collection provider
angular.module('MarsDB', []).provider('$collection', function () {

  this.defaultStorageManager = function (storageManager) {
    Collection.defaultStorageManager(storageManager);
    return this;
  };

  this.defaultIdGenerator = function (idGenerator) {
    Collection.defaultIdGenerator(idGenerator);
    return this;
  };

  var collections = {};
  this.$get = ['$q', function ($q) {
    return function (name) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (collections[name] && !options.noCache) {
        return collections[name];
      } else {
        var newInstance = new _AngularCollection2.default(name, options, $q);
        if (!options.noCache) {
          collections[name] = newInstance;
        }
        return newInstance;
      }
    };
  }];
});

module.export = 'MarsDB';