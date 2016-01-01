import StorageManager from '../../lib/StorageManager';
import chai from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('StorageManager', () => {
  it('should be created', () => {
    const db = new StorageManager();
  });

  it('should be a able to persist', () => {
    const db = new StorageManager();
    return db.persist('a', {_id: 'a', a: 1}).then(() => {
      return db.get('a').should.eventually.deep.equal({_id: 'a', a: 1});
    });
  });

  it('should NOT clone object when getting', () => {
    const db = new StorageManager();
    return db.persist('a', {_id: 'a', a: 1}).then(() => {
      return db.get('a');
    }).then(doc => {
      doc.a = 2;
      return db.get('a');
    }).then(doc => {
      doc.a.should.be.equal(2);
    });
  });

  it('should NOT clone objects when streaming', (done) => {
    const db = new StorageManager();
    db.persist('a', {_id: 'a', a: 1}).then(() => {
      db.createReadStream()
        .on('data', (doc) => doc.value.a = 2)
        .on('end', () => {
          db.createReadStream()
            .on('data', (doc) => {
              doc.value.a.should.be.equal(2);
            })
            .on('end', () => {
              done();
            })
        })
    });
  });

  it('should be a able to persist with replace by id', () => {
    const db = new StorageManager();
    return db.persist('a', {_id: 'a', a: 1}).then(() => {
      db.get('a').should.eventually.deep.equal({_id: 'a', a: 1});
      return db.persist('a', {_id: 'a', b: 1}).then(() => {
        return db.get('a').should.eventually.deep.equal({_id: 'a', b: 1});
      });
    });
  });

  it('should be a able to delete', () => {
    const db = new StorageManager();
    return db.persist('a', {_id: 'a', a: 1}).then(() => {
      return db.delete('a').then(() => {
        db.get('a').should.not.eventually.deep.equal({_id: 'a', a: 1});
        return db.get('a').should.eventually.equal(undefined);
      });
    });
  });

  it('should be a able to create a stream', () => {
    const db = new StorageManager();
    return Promise.all([
      db.persist('a', {_id: 'a', a: 1}),
      db.persist('b', {_id: 'b', b: 1}),
      db.persist('c', {_id: 'c', c: 1}),
      db.persist('d', {_id: 'd', d: 1})
    ]).then(() => {
      return new Promise((resolve, reject) => {
        const givenIds = [];
        db.createReadStream()
        .on('data', d => givenIds.push(d.value._id))
        .on('end', () => {
          givenIds.should.be.deep.equal(['a','b','c','d']);
          resolve();
        })
      })
    })
  });
});