import Collection from '../../lib/Collection';
import Cursor from '../../lib/Cursor';
import CursorObservable from '../../lib/CursorObservable';
import chai, {expect, assert} from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('AngularIntegration', () => {

  before(function () {
    window.angular = require('angular');
    window.Mars = {
      Collection: Collection,
      Cursor: Cursor,
      CursorObservable: CursorObservable,
    };
    require('../../lib/angular');
    require('angular-mocks');
    window.angular.module('app', ['MarsDB']);
  });

  after(function () {
    delete window.angular;
    delete window.Mars;
  });

  beforeEach(function () {
    window.module('app');
  });

  describe('observing', function() {
    it('should change scope when new data available', (done) => window.inject(
      function($collection, $q, $rootScope, $timeout) {
        const coll = $collection('user');
        const $scope = $rootScope.$new();
        let calls = 0;
        let resolved;
        coll.find({_id: 1}).observe((docs) => {
          calls += 1;
          if (calls === 1) {
            expect(docs).to.be.an('array');
          } else if (calls === 2) {
            expect(docs).to.be.an('array');
            docs.should.have.length(1);
            docs[0].should.be.deep.equal({_id: 1, a: 2});
            done();
          }
        }, $scope).then(() => {
          coll.insert({_id: 1, a: 2});
          setTimeout(() => $rootScope.$apply(), 100);
        })
        setTimeout(() => $rootScope.$apply(), 100);
      })
    );
  });
});