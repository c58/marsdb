import Collection from '../../lib/Collection';
import Cursor from '../../lib/Cursor';
import chai from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('Cursor', () => {
  let db;

  beforeEach(function () {
    db = new Collection('test');

    return Promise.all([
      db.insert({a: 'a', b: 1, c: 'some text 1', g: 'g1', f: 1}),
      db.insert({a: 'b', b: 2, c: 'some text 2', g: 'g1', f: 10}),
      db.insert({a: 'c', b: 3, c: 'some text 3', g: 'g1', f: 11}),
      db.insert({a: 'd', b: 4, c: 'some text 4', g: 'g1', f: 12}),
      db.insert({a: 'e', b: 5, c: 'some text 5', g: 'g2', d: 234, f: 2}),
      db.insert({a: 'f', b: 6, c: 'some text 6', g: 'g2', f: 20, k: {a: 1}}),
      db.insert({a: 'g', b: 7, c: 'some text 7', g: 'g2', f: 21}),
    ]);
  });

  it('should be created with db and query', () => {
    const cursor = new Cursor(db, {});
  });


  describe('#exec', function () {
    it('should execute only with multiple calls', function () {
      // TODO
    });

    it('should clone docs by default', function () {
      const cursor = new Cursor(db);
      cursor.find({b: {$gt: 4}}).skip(1).sort({b: 1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(2);
        docs[0].k.a.should.be.equals(1);
        docs[0].b.should.be.equals(6);
        docs[0].b = 7;
        docs[0].k.a = 2;
        return cursor.exec().then((docs) => {
          docs.should.have.length(2);
          docs[0].k.a.should.be.equals(1);
          docs[0].b.should.be.equals(6);
        });
      });
    });

    it('should NOT clone docs when `options.noClone` passed', function () {
      const cursor = new Cursor(db, {}, {noClone: true});
      cursor.find({b: {$gt: 4}}).skip(1).sort({b: 1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(2);
        docs[0].k.a.should.be.equals(1);
        docs[0].b.should.be.equals(6);
        docs[0].b = 7;
        docs[0].k.a = 2;
        return cursor.exec().then((docs) => {
          docs.should.have.length(2);
          docs[0].b.should.be.equals(7);
          docs[0].k.a.should.be.equals(2);
        });
      });
    });
  });

  describe('#skip', function () {
    it('should skip documents with sorting', function () {
      const cursor = new Cursor(db);
      cursor.find({b: {$gt: 4}}).skip(1).sort({b: 1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(2);
        docs[0].b.should.be.equals(6);
        docs[1].b.should.be.equals(7);
      });
    });

    it('should return empty with skip out of result', function () {
      const cursor = new Cursor(db);
      cursor.find({b: {$gt: 4}}).skip(10).sort({b: 1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(0);
      });
    });

    it('should throw an error with negative skip', function () {
      const cursor = new Cursor(db);
      (() => cursor.find({b: {$gt: 4}}).skip(-1)).should.throw(Error);
    });
  });


  describe('#limit', function () {
    it('should limit documents with sorting', function () {
      const cursor = new Cursor(db);
      cursor.find({b: {$gt: 4}}).limit(2).sort({b: 1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(2);
        docs[0].b.should.be.equals(5);
        docs[1].b.should.be.equals(6);
      });
    });

    it('should return not limites result with zero limit', function () {
      const cursor = new Cursor(db);
      cursor.find({b: {$gt: 4}}).limit(0).sort({b: 1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(3);
      });
    });

    it('should throw an error with negative skip', function () {
      const cursor = new Cursor(db);
      (() => cursor.find({b: {$gt: 4}}).limit(-1)).should.throw(Error);
    });
  });


  describe('#ifNotEmpty', function () {
    it('should stop pipeline processing if result is null', function (done) {
      const cursor = new Cursor(db);
      cursor.find({b: 6})
      .ifNotEmpty().aggregate(docs => {
        docs.should.have.length(1);
        return null;
      })
      .ifNotEmpty().aggregate(docs => {
        throw new Error('Docs is empty but aggregate is invked')
      })
      .exec()
      .then(() => done());
    });

    it('should stop pipeline processing if result is undefined', function (done) {
      const cursor = new Cursor(db);
      cursor.find({b: 6})
      .ifNotEmpty().aggregate(docs => {
        docs.should.have.length(1);
        return undefined;
      })
      .ifNotEmpty().aggregate(docs => {
        throw new Error('Docs is empty but aggregate is invked')
      })
      .exec()
      .then(() => done());
    });

    it('should stop pipeline processing if result is empty array', function (done) {
      const cursor = new Cursor(db);
      cursor.find({b: 6})
      .ifNotEmpty().aggregate(docs => {
        docs.should.have.length(1);
        return [];
      })
      .ifNotEmpty().aggregate(docs => {
        throw new Error('Docs is empty but aggregate is invked')
      })
      .exec()
      .then(() => done());
    });
  });


  describe('#find', function () {
    it('should return all objects with empty query object', function () {
      const cursor = new Cursor(db);
      cursor.find({});
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
      });
    });

    it('should return all objects with undefined query object', function () {
      const cursor = new Cursor(db);
      cursor.find();
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
      });
    });

    it('should find with all available functions', function () {
      const cursor = new Cursor(db);
      cursor.find({
        a: {$ne: 'd'},
        b: {
          $in: [3, 4, 5, 6],
          $nin: [1, 2, 3],
          $lt: 18,
          $gt: 1,
          $lte: 6,
          $gte: 2,
        },
        d: {$exists: true},
        c: {$regex: /5$/i}
      });
      return cursor.exec().then((docs) => {
        docs.should.have.length(1);
        docs[0].a.should.be.equals('e');
      });
    });
  });


  describe('#sort', function () {
    it('should sort by number field asc', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({f: 1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
        docs[0].f.should.be.equals(1);
        docs[1].f.should.be.equals(2);
        docs[6].f.should.be.equals(21);
      });
    });

    it('should sort by number field desc', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({f: -1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
        docs[0].f.should.be.equals(21);
        docs[1].f.should.be.equals(20);
        docs[5].f.should.be.equals(2);
        docs[6].f.should.be.equals(1);
      });
    });

    it('should sort by text field asc', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({a: 1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
        docs[0].a.should.be.equals('a');
        docs[6].a.should.be.equals('g');
      });
    });

    it('should sort by text field desc', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({a: -1});
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
        docs[0].a.should.be.equals('g');
        docs[6].a.should.be.equals('a');
      });
    });
  });



  describe('#sortFunc', function () {
    it('should sort with custom function', function () {
      const cursor = new Cursor(db);
      cursor.find().sortFunc((a, b) => b.b - a.b);
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
        docs[0].b.should.be.equals(7);
        docs[1].b.should.be.equals(6);
      });
    });

    it('should sort after index sorting', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({a: -1}).sortFunc((a, b) => a.b - b.b);
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
        docs[0].b.should.be.equals(1);
        docs[1].b.should.be.equals(2);
      });
    });

    it('should throw an error if sorter is not a function', function () {
      const cursor = new Cursor(db);
      (() => cursor.sortFunc(123)).should.throw(Error);
    });
  });



  describe('#filter', function () {
    it('should filter by function', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({b: 1}).filter(d => d.b === 3 || d.b === 7);
      return cursor.exec().then((docs) => {
        docs.should.have.length(2);
        docs[0].b.should.be.equals(3);
        docs[1].b.should.be.equals(7);
      });
    });

    it('should throw an error if filter is not a function', function () {
      const cursor = new Cursor(db);
      (() => cursor.filter(123)).should.throw(Error);
    });
  });



  describe('#map', function () {
    it('should map by a function', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({b: 1}).map(d => {
        return {b: d.b * 2};
      });
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
        docs[0].should.not.have.ownProperty('a');
        docs[1].should.not.have.ownProperty('a');
        docs[0].b.should.be.equals(2);
        docs[1].b.should.be.equals(4);
      });
    });

    it('should throw an error if map is not a function', function () {
      const cursor = new Cursor(db);
      (() => cursor.map(123)).should.throw(Error);
    });
  });



  describe('#reduce', function () {
    it('should reduce by a function', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({b: 1}).reduce((acum, val) => {
        acum[val.g] += val.b;
        return acum;
      }, {g1: 0, g2: 0});
      return cursor.exec().then((res) => {
        res['g1'].should.be.equals(10);
        res['g2'].should.be.equals(18);
      });
    });

    it('should throw an error if reduce is not a function', function () {
      const cursor = new Cursor(db);
      (() => cursor.reduce(123)).should.throw(Error);
    });
  });



  describe('#aggregate', function () {
    it('should aggregate by a function', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({b: 1}).aggregate(docs => {
        return docs.length;
      });
      return cursor.exec().then((docs) => {
        docs.should.be.equals(7);
      });
    });

    it('should throw an error if aggregate is not a function', function () {
      const cursor = new Cursor(db);
      (() => cursor.aggregate(123)).should.throw(Error);
    });
  });

  describe('#join', function () {
    it('should use joinEach for an array', function () {
      return db.find().join(d => {
        d.should.be.an('object');
      }).then((result) => {
        result.should.be.an('array');
      });
    });

    it('should use joinAll for single object', function () {
      return db.findOne().join(d => {
        d.should.be.an('object');
      }).then((result) => {
        result.should.be.an('object');
      });
    });

    it('should throw an error if join is not a function', function () {
      const cursor = new Cursor(db);
      (() => cursor.join(123)).should.throw(Error);
    });
  });

  describe('#joinEach', function () {
    it('should join by function with promises', function () {
      const cursor = new Cursor(db);
      cursor.find().sort({b: 1}).joinEach(d => {
        const cursor2 = new Cursor(db);
        return cursor2.find({g: d.g}).exec().then((result) => {
          d.groupObjs = result;
        });
      });
      return cursor.exec().then((docs) => {
        docs.should.have.length(7);
        docs[0].groupObjs.should.have.length(4);
        docs[1].groupObjs.should.have.length(4);
        docs[6].groupObjs.should.have.length(3);
      });
    });

    it('should not change object in a storage', function () {
      return db.find().sort({b: 1}).joinEach(d => {
        return db.find({g: d.g}).then((result) => {
          d.groupObjs = result;
        });
      }).then((docs) => {
        docs.should.have.length(7);
        docs[0].groupObjs.should.have.length(4);
        docs[1].groupObjs.should.have.length(4);
        docs[6].groupObjs.should.have.length(3);
        return db.find().sort({b: 1});
      }).then((docs) => {
        docs.should.have.length(7);
        docs[0].should.not.have.ownProperty('groupObjs');
      });
    });

    it('should throw an error if join is not a function', function () {
      const cursor = new Cursor(db);
      (() => cursor.join(123)).should.throw(Error);
    });
  });


  describe('#joinAll', function () {
    it('should join by function with promises', function () {
      return db.find({b: {$in: [1,2,3]}}).sort(['b']).joinAll(docs => {
        docs.should.have.length(3);
        return db.find({g: docs[0].g}).exec().then((result) => {
          docs.forEach(d => d.groupObjs = result);
        });
      }).exec().then((docs) => {
        docs.should.have.length(3);
        docs[0].groupObjs.should.have.length(4);
        docs[1].groupObjs.should.have.length(4);
        docs[2].groupObjs.should.have.length(4);
      });
    });

    it('should throw an error if join is not a function', function () {
      const cursor = new Cursor(db);
      (() => cursor.joinAll(123)).should.throw(Error);
    });
  });

});
