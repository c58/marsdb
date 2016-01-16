import _map from 'fast.js/map';
import invariant from 'invariant';
import DocumentModifier from './DocumentModifier';


/**
 * Default collection delegate for working with a
 * normal MarsDB approach – within a browser.
 */
export class CollectionDelegate {
  constructor(db) {
    this.db = db;
  }

  insert(doc, options = {}) {
    return this.db.indexManager.indexDocument(doc).then(() => {
      return this.db.storageManager.persist(doc._id, doc).then(() => {
        return doc._id;
      });
    });
  }

  remove(query, options = {}) {
    return this.find(query, {noClone: true}).then((docs) => {
      invariant(
        docs.length <= 1 || options.multi,
        'remove(..): multi removing is not enabled by options.multi'
      );

      const removeStorgePromises = _map(docs, d => {
        return this.db.storageManager.delete(d._id);
      });
      const removeIndexPromises = _map(docs, d => {
        return this.db.indexManager.deindexDocument(d);
      });
      const allPromises = removeStorgePromises.concat(removeIndexPromises);

      return Promise.all(allPromises).then(() => {
        return docs;
      });
    });
  }

  update(query, modifier, options = {}) {
    options.upsert = false;
    return new DocumentModifier(this.db, query)
      .modify(modifier, options)
      .then((result) => {
        var {original, updated} = result;
        updated = _map(updated, x => this.db.create(x));

        const updateStorgePromises = _map(updated, d => {
          return this.db.storageManager.persist(d._id, d);
        });
        const updateIndexPromises = _map(updated, (d, i) => {
          return this.db.indexManager.reindexDocument(original[i], d);
        });
        const allPromises = updateStorgePromises.concat(updateIndexPromises);

        return Promise.all(allPromises).then(() => {
          return {
            modified: updated.length,
            original: original,
            updated: updated,
          };
        });
      });
  }

  find(query, options = {}) {
    return new (this.db.cursorClass)(this.db, query, options);
  }

  findOne(query, sortObj, options = {}) {
    return this.find(query, options)
      .aggregate(docs => docs[0])
      .limit(1);
  }

  count(query, options = {}) {
    options.noClone = true;
    return this.find(query, options)
      .aggregate((docs) => docs.length);
  }

  ids(query, options = {}) {
    options.noClone = true;
    return this.find(query, options)
      .map((doc) => doc._id);
  }
}

export default CollectionDelegate;
