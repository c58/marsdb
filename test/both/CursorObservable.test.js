import Collection from '../../lib/Collection';
import CursorObservable from '../../lib/CursorObservable';
import chai, {expect} from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('CursorObservable', () => {
  let db;

  beforeEach(function () {
    db = new Collection('test');

    return Promise.all([
      db.insert({a: 'a', b: 1, c: 'some text 1', g: 'g1', f: 1}),
      db.insert({a: 'b', b: 2, c: 'some text 2', g: 'g1', f: 10}),
      db.insert({a: 'c', b: 3, c: 'some text 3', g: 'g1', f: 11}),
      db.insert({a: 'd', b: 4, c: 'some text 4', g: 'g1', f: 12}),
      db.insert({a: 'e', b: 5, c: 'some text 5', g: 'g2', d: 234, f: 2}),
      db.insert({a: 'f', b: 6, c: 'some text 6', g: 'g2', f: 20}),
      db.insert({a: 'g', b: 7, c: 'some text 7', g: 'g2', f: 21}),
    ]);
  });

  it('should be created with db and query', () => {
    const cursor = new CursorObservable(db, {});
  });

  describe('#whenNotExecuting', function () {
    it('should wait until request processed', function (done) {
      const cursor = db.find({a: 1});
      cursor.then(() => {
        cursor._query.should.be.deep.equals({a: 1});
      });
      cursor.whenNotExecuting().then(() => {
        cursor.find({a: 2}).then(() => {
          cursor._query.should.be.deep.equals({a: 2});
          done();
        });
      })
    });

    it('should rise an exception when try to change cursor while executing', function () {
      const cursor = db.find({a: 1});
      cursor.then(() => {
        cursor._query.should.be.deep.equals({a: 1});
      });
      expect(() => {
        cursor.find({a: 2}).then(() => {
          cursor._query.should.be.deep.equals({a: 2});
        });
      }).to.throw(Error);
    });
  });

  describe('#observe', function () {
    it('should support multiple declarative style observing', function (done) {
      let calls = 0;
      const obsFn = () => {
        calls += 1;
        if (calls > 1) {
          done();
        }
      }
      const cursor = db.find({b: 1})
      .observe(obsFn, {declare: true})
      .observe(obsFn, {declare: true})

      cursor.then(() => {
        calls.should.be.equals(0);
        cursor.update(true);
      })
    });

    it('should observe insert without debounce and batchSize eq 1', function (done) {
      var calls = 0;
      const cursor = new CursorObservable(db);
      cursor.batchSize(1);
      cursor.debounce(0);
      cursor.find({b: {$gt: 4, $lte: 7}}).observe((result) => {
        expect(result).to.be.an('array');
        calls += 1;
        if (calls === 1) {
          result.should.have.length(3);
        } else if (calls > 1) {
          result.should.have.length(4);
          done();
        }
      }).then(() => {
        db.insert({b: 4.5});
      });
    });

    it('should not update if inserted document not match query', function (done) {
      const cursor = new CursorObservable(db);
      cursor.batchSize(1);
      cursor.debounce(0);
      cursor.find({b: {$gt: 4, $lte: 7}}).observe((result) => {
        if (result.length > 3) {
          done(new Error());
        }
      }).then((result) => {
        expect(result).to.be.an('array');
        return db.insert({b: 3.5});
      }).then(() => {
        setTimeout(() => {done()}, 10);
      });
    });

    it('should stop observing by calling stop method', function (done) {
      var calls = 0;
      const cursor = new CursorObservable(db);
      cursor.batchSize(1);
      cursor.debounce(0);
      const stopper = cursor.find({b: {$gt: 4, $lte: 7}}).observe((result) => {
        calls > 0 && done(new Error());
        calls += 1;
      }).then((result) => {
        expect(result).to.be.an('array');
        stopper.stop();
        return db.insert({b: 4.5});
      }).then(() => {
        setTimeout(() => {done()}, 10);
      });
    });

    it('should execute once after immidiatelly stop observing', function (done) {
      var calls = 0;
      const cursor = new CursorObservable(db);
      cursor.batchSize(1);
      cursor.debounce(0);
      const stopper = cursor.find({b: {$gt: 4, $lte: 7}}).observe((result) => {
        calls > 0 && done(new Error());
        calls += 1;
      })
      stopper.stop();
      stopper.then((result) => {
        expect(result).to.be.an('array');
        return db.insert({b: 4.5});
      }).then(() => {
        setTimeout(() => {done()}, 10);
      });
    });

    it('should observe in join and propagate update to upper observer', function (done) {
      var calls = 0;
      db.find({$or: [{f: 1}, {f: 2}]})
        .join((doc) => {
          return db.find({b: 30}).observe(res => {
            doc.joined = res;
          });
        }).observe(result => {
          if (calls === 0) {
            expect(result).to.be.an('array');
            result.should.have.length(2);
            expect(result[0].joined).to.have.length(0);
            expect(result[1].joined).to.have.length(0);
            calls++;
          } else {
            expect(result[0].joined).to.have.length(1);
            expect(result[1].joined).to.have.length(1);
            done();
          }
        }).then(() => {
          return db.insert({b: 30});
        });
    });

    it('should stop observing previous join after upper join update', function (done) {
      var observerCalls = 0;
      var joinCalls = 0;
      db.find({$or: [{f: 1}, {f: 2}]})
        .joinAll((docs) => {
          return db.find({b: 30}).observe(res => {
            if (res.length > 0) {
              joinCalls += 1;
              joinCalls.should.be.lte(1);
            }
          });
        })
        .batchSize(0)
        .debounce(0)
        .observe(result => {
          observerCalls.should.be.lte(2);
          observerCalls++;
          if (observerCalls === 2) {
            done();
          }
        }).then(() => {
          return db.insert({f: 1});
        }).then(() => {
          return db.insert({b: 30});
        });
    });

    it('should update when join funciton call updater function', function (done) {
      var observerCalls = 0;
      db.find({$or: [{f: 1}, {f: 2}]})
        .joinAll((docs, updated) => {
          setTimeout(() => {
            docs[0].updated = true;
            updated();
          }, 10);
        })
        .batchSize(0)
        .debounce(0)
        .observe(result => {
          observerCalls.should.be.lte(2);
          observerCalls++;
          if (observerCalls === 1) {
            expect(result[0].updated).to.be.undefined;
          } else if (observerCalls === 2) {
            result[0].updated.should.be.equals(true);
            done();
          }
        })
    });

    it('should not update a cursor when updated dcc does not match a query', function (done) {
      var calls = 0;
      db.find({$or: [{f: 1}, {f: 2}]}).observe(result => {
        if (calls === 0) {
          expect(result).to.be.an('array');
          result.should.have.length(2);
          calls++;
        } else {
          done(new Error('Called when document does not match query'));
        }
      }).then(() => {
        return db.update({f: 3}, {$set: {some: 'field'}});
      }).then(() => {
        setTimeout(() => {done()}, 40);
      });
    });

    it('should not update a cursor when updated doc is equals to an old doc', function (done) {
      var calls = 0;
      db.find({$or: [{f: 1}, {f: 2}]}).observe(result => {
        if (calls === 0) {
          expect(result).to.be.an('array');
          result.should.have.length(2);
          calls++;
        } else {
          done(new Error('Called when an updated doc is equals to an old doc'));
        }
      }).then(() => {
        return db.update({f: 1}, {$set: {b: 1}});
      }).then(() => {
        setTimeout(() => {done()}, 40);
      });
    });

    it('should update a cursor when updatedAt is different', function (done) {
      var calls = 0;

      db.update({f: 1}, {$set: {updatedAt: new Date(0)}}).then(() => {
        return db.find({$or: [{f: 1}, {f: 2}]}).observe(result => {
          if (calls === 0) {
            expect(result).to.be.an('array');
            result.should.have.length(2);
            calls++;
          } else {
            result[0].updatedAt.should.not.be.deep.equals(new Date(0));
            result[0].updatedAt.should.be.deep.equals(new Date(1));
            done();
          }
        }).then(() => {
          return db.update({f: 1}, {$set: {updatedAt: new Date(1)}});
        });
      });
    });

    it('should not update a cursor when updatedAt is equals', function (done) {
      var calls = 0;

      db.update({f: 1}, {$set: {updatedAt: new Date(0)}}).then(() => {
        return db.find({$or: [{f: 1}, {f: 2}]}).observe(result => {
          if (calls === 0) {
            expect(result).to.be.an('array');
            result.should.have.length(2);
            calls++;
          } else {
            done(new Error());
          }
        }).then(() => {
          return db.update({f: 1}, {$set: {updatedAt: new Date(0)}});
        }).then(() => {
          setTimeout(() => {done()}, 40);
        });
      });
    });

    it('should update when not matching old doc will match by update', function (done) {
      var calls = 0;
      db.find({$or: [{f: 1}, {f: 2}]}).observe(result => {
        if (calls === 0) {
          expect(result).to.be.an('array');
          result.should.have.length(2);
          calls++;
        } else {
          result.should.have.length(3);
          done();
        }
      }).then(() => {
        return db.update({f: 20}, {$set: {f: 2}});
      });
    });

    it('should be invoked before `then` callback', function (done) {
      var invoked = false;
      db.find({$or: [{f: 1}, {f: 2}]}).observe(result => {
        invoked.should.be.equals(false);
        invoked = true;
      }).then(() => {
        invoked.should.be.equals(true);
        done();
      });
    });

    it('should observe `findOne` collection method', function (done) {
      var calls = 0;
      db.findOne({b: 8}).batchSize(1).debounce(0)
      .observe(result => {
        calls += 1;
        if (calls === 1) {
          expect(result).to.be.undefined;
        } else if (calls > 1) {
          result.b.should.be.equals(8);
          done();
        }
      }).then(() => {
        db.insert({b: 8});
      });
    });
  });


  describe('#debounce', function () {
    it('should change debounce wait time', function (done) {
      var called = false;
      const cursor = new CursorObservable(db);
      cursor.debounce(100);
      const stopper = cursor.find({b: {$gt: 4, $lte: 7}}).observe((result) => {
        called = true;
      });
      setTimeout(() => {
        if (called) {
          done(new Error('Can\'t be called before debounce'))
        }
      }, 90);
      setTimeout(() => {
        if (!called) {
          done(new Error('Must be called after debounce'))
        } else {
          done();
        }
      }, 110);
    });

    it('should debounce update calls', function (done) {
      var called = false;
      const cursor = new CursorObservable(db);
      cursor.debounce(100);
      const stopper = cursor.find({b: {$gt: 4, $lte: 7}}).observe((result) => {
        called = true;
      });
      setTimeout(() => {
        if (called) {
          done(new Error('Can\'t be called before debounce'));
        }
        db.insert({b: 4.5});
      }, 90);
      setTimeout(() => {
        if (called) {
          done(new Error('Can\'t be called before debounce'));
        }
      }, 110);
      setTimeout(() => {
        if (called) {
          done(new Error('Can\'t be called before debounce'));
        }
      }, 190);
      setTimeout(() => {
        if (!called) {
          done(new Error('Must be called after debounce'));
        } else {
          done();
        }
      }, 310);
    });
  });

  describe('#batchSize', function () {
    it('should change batchSize and apply batch update before debounce wait', function (done) {
      var called = false;
      const cursor = new CursorObservable(db);
      cursor.debounce(10000);
      cursor.batchSize(5);
      const stopper = cursor.find({b: {$gt: 4, $lte: 7}}).observe((result) => {
        called = true;
      });

      setTimeout(() => {
        if (called) {
          done(new Error('Can\'t be called before debounce'));
        }
        Promise.all([1, 2, 3, 4].map(x => db.insert({b: 4.5}))).then(() => {
          setTimeout(() => {
            if (called) {
              done(new Error('Can\'t be called before debounce'));
            } else {
              db.insert({b: 4.5}).then(() => {
                setTimeout(() => {
                  if (!called) {
                    done(new Error('Must be called after debounce'));
                  } else {
                    done();
                  }
                }, 10);
              })
            }
          }, 10);
        });
      }, 20);
    });
  });
});
