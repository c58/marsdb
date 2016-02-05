import _map from 'fast.js/map';
import DocumentModifier from './DocumentModifier';


/**
 * Default collection delegate for working with a
 * normal MarsDB approach – within a browser.
 */
export class CollectionDelegate {
  constructor(db) {
    this.db = db;
  }

  insert(doc, options = {}, randomId) {
    return this.db.indexManager.indexDocument(doc).then(() =>
      this.db.storageManager.persist(doc._id, doc).then(() =>
        doc._id
      )
    );
  }

  remove(query, {sort = {_id: 1}, multi = false}) {
    return this.find(query, {noClone: true})
      .sort(sort).then((docs) => {
        if (docs.length > 1 && !multi) {
          docs = [docs[0]];
        }
        const removeStorgePromises = _map(docs, d =>
          this.db.storageManager.delete(d._id)
        );
        const removeIndexPromises = _map(docs, d =>
          this.db.indexManager.deindexDocument(d)
        );
        return Promise.all([
          ...removeStorgePromises,
          ...removeIndexPromises,
        ]).then(() => docs);
      });
  }

  update(query, modifier, {sort = {_id: 1}, multi = false, upsert = false}) {
    return this.find(query, {noClone: true})
      .sort(sort).then((docs) => {
        if (docs.length > 1 && !multi) {
          docs = [docs[0]];
        }
        return new DocumentModifier(query)
          .modify(docs, modifier, { upsert });
      }).then(({original, updated}) => {
        const updateStorgePromises = _map(updated, d =>
          this.db.storageManager.persist(d._id, d)
        );
        const updateIndexPromises = _map(updated, (d, i) =>
          this.db.indexManager.reindexDocument(original[i], d)
        );
        return Promise.all([
          ...updateStorgePromises,
          ...updateIndexPromises,
        ]).then(() => ({
          modified: updated.length,
          original: original,
          updated: updated,
        }));
      });
  }

  find(query, options = {}) {
    const cursorClass = this.db.cursorClass;
    return new cursorClass(this.db, query, options);
  }

  findOne(query, options = {}) {
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
