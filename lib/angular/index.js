import AngularCollection from './AngularCollection';
const angular = typeof window !== 'undefined' && window.angular
  ? window.angular : require('angular');
const Collection = typeof window !== 'undefined' && window.Mars
  ? window.Mars.Collection : require('../Collection').default;


// Setup mars $collection provider
angular.module('MarsDB', [])
.provider('$collection', function() {

  this.defaultStorageManager = function(storageManager) {
    Collection.defaultStorageManager(storageManager);
    return this;
  };

  this.defaultIdGenerator = function(idGenerator) {
    Collection.defaultIdGenerator(idGenerator);
    return this;
  };

  const collections = {};
  this.$get = ['$q', function($q) {
    return function(name, options = {}) {
      if (collections[name] && !options.noCache) {
        return collections[name];
      } else {
        const newInstance = new AngularCollection(name, options, $q);
        if (!options.noCache) {
          collections[name] = newInstance;
        }
        return newInstance;
      }
    };
  }];

});

module.export = 'MarsDB';
