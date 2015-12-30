import {compareThings} from '../lib/DocumentMatcher';
import BPlusTree from '../lib/BPlusTree';
import validate from './lib/bpvalidator';
import chai, {except, assert} from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


var db = [
  { age: 46,
  name: 'Lamar Goodwin',
  phone: '817-529-2557',
  title: 'Global Usability Coordinator' },
  { age: 13,
  name: 'Elmo Hansen',
  phone: '1-632-301-4062 x8351',
  title: 'Customer Paradigm Assistant' },
  { age: 43,
  name: 'Ashton Oberbrunner',
  phone: '1-292-015-9298 x19171',
  title: 'Legacy Security Planner' },
  { age: 32,
  name: 'Ms. Kiera Hodkiewicz',
  phone: '1-742-905-8677',
  title: 'Legacy Security Planner' },
  { age: 10,
  name: 'Hilda O\'Kon',
  phone: '118.357.9132 x76245',
  title: 'Dynamic Communications Agent' },
  { age: 38,
  name: 'Leland Bahringer',
  phone: '114.754.5482 x7853',
  title: 'Internal Program Officer' },
  { age: 21,
  name: 'Axel Block',
  phone: '816-557-8326 x083',
  title: 'Forward Interactions Liason' },
  { age: 14,
  name: 'Wendy Dare',
  phone: '966.968.5997 x42838',
  title: 'Infrastructure Associate' },
  { age: 23,
  name: 'Miss Fermin Bartell',
  phone: '(003) 694-6712',
  title: 'Product Applications Designer' },
  { age: 68,
  name: 'Marquise Weimann',
  phone: '400.157.6206',
  title: 'Corporate Response Orchestrator' },
  { age: 24,
  name: 'Kaley Jones',
  phone: '1-426-266-8041',
  title: 'District Brand Producer' },
  { age: 51,
  name: 'Dr. Jess Stokes',
  phone: '1-754-630-5989 x8753',
  title: 'Chief Tactics Supervisor' },
  { age: 24,
  name: 'Durward Runolfsson',
  phone: '726.255.5565',
  title: 'Regional Configuration Planner' },
  { age: 64,
  name: 'Clemens Howell Dr.',
  phone: '1-926-168-6208',
  title: 'Global Communications Orchestrator' },
  { age: 22,
  name: 'Catherine Predovic',
  phone: '206-479-6915 x835',
  title: 'Dynamic Accountability Architect' },
  { age: 36,
  name: 'Odie Reichel',
  phone: '(695) 562-6049 x68079',
  title: 'Forward Configuration Representative' },
  { age: 32,
  name: 'Wilfredo Strosin',
  phone: '071.478.7926',
  title: 'Dynamic Web Consultant' },
  { age: 8,
  name: 'Makayla McLaughlin',
  phone: '1-667-221-6294 x87922',
  title: 'Implementation Facilitator' },
  { age: 41,
  name: 'Ardella O\'Conner',
  phone: '1-927-933-8004',
  title: 'Product Operations Supervisor' },
  { age: 8,
  name: 'Magdalen Zulauf Mr.',
  phone: '992-726-6046 x72367',
  title: 'Central Accountability Manager' },
  { age: 62,
  name: 'Santino Kuvalis',
  phone: '(297) 534-9135',
  title: 'Direct Accounts Analyst' },
  { age: 48,
  name: 'Elva Graham',
  phone: '229.798.4078 x4705',
  title: 'International Mobility Facilitator' },
  { age: 16,
  name: 'Lesley Howe',
  phone: '(829) 112-7415 x2891',
  title: 'Internal Response Agent' },
  { age: 49,
  name: 'Antonio Monahan Mr.',
  phone: '(682) 162-2301',
  title: 'Integration Technician' },
  { age: 69,
  name: 'Shana Lubowitz',
  phone: '849-809-2691 x787',
  title: 'Internal Division Liason' },

  { age: 1,
  name: 'Serena Bruen',
  phone: '1-070-021-2968',
  title: 'Senior Detector Agent' },
  { age: 1,
  name: 'Clemmie Powlowski',
  phone: '1-796-310-8197 x253',
  title: 'Senior Detector Agent' },
  { age: 2,
  name: 'Albertha Simonis Ms.',
  phone: '1-421-993-2782 x073',
  title: 'Senior Fax Administrator' },
  { age: 4,
  name: 'Kavon Hammes',
  phone: '(913) 113-1961 x68847',
  title: 'Senior Identity Engineer' },
  { age: 5,
  name: 'Kyle MacGyver',
  phone: '333-464-6778 x7218',
  title: 'Senior Klingon Consultant' }
]


describe('BPlusTree', () => {
  describe('Numeric key indexes', () => {
    var bpindex = new BPlusTree({debug: false, branchingFactor: 5, comparator: compareThings})

    it(`should have a valid structure after every insert`, () => {
      var errors = []

      for (let rec of db) {
        bpindex.insert(rec.age, rec.name)
        errors = validate(bpindex)
        if (errors.length > 0) { break }
      }

      if (errors.length > 0) {
        console.log(errors)
        console.log(JSON.stringify(bpindex.dumpTree(), null, 4))
      }

      assert.lengthOf(errors, 0, 'Errors array is not empty')
    })

    it(`should correctly lookup keys`, () => {
      assert.deepEqual(bpindex.search(13), ['Elmo Hansen'])
      assert.deepEqual(bpindex.search(64), ['Clemens Howell Dr.'])
      assert.sameMembers(bpindex.search(8), ['Makayla McLaughlin', 'Magdalen Zulauf Mr.'])
      assert.deepEqual(bpindex.search(99), [])
    })

    it(`should correctly lookup ranges sorted asc`, () => {
      assert.deepEqual(
        bpindex.getBetweenBounds({$gte: 1, $lt: 5}),
        ['Clemmie Powlowski', 'Serena Bruen', 'Albertha Simonis Ms.', 'Kavon Hammes']
      )
      assert.deepEqual(
        bpindex.getBetweenBounds({$gte: 1, $lte: 5}),
        ['Clemmie Powlowski', 'Serena Bruen', 'Albertha Simonis Ms.', 'Kavon Hammes', 'Kyle MacGyver']
      )
      assert.deepEqual(
        bpindex.getBetweenBounds({$gt: 1, $lte: 5}),
        ['Albertha Simonis Ms.', 'Kavon Hammes', 'Kyle MacGyver']
      )
      assert.deepEqual(
        bpindex.getBetweenBounds({$gt: 1, $lt: 5}),
        ['Albertha Simonis Ms.', 'Kavon Hammes']
      )
    })

    it(`should correctly return the entire index sorted asc`, () => {
      assert.deepEqual(
        bpindex.getAll().map(x => x.value),
        [ 'Clemmie Powlowski',
        'Serena Bruen',
        'Albertha Simonis Ms.',
        'Kavon Hammes',
        'Kyle MacGyver',
        'Magdalen Zulauf Mr.',
        'Makayla McLaughlin',
        'Hilda O\'Kon',
        'Elmo Hansen',
        'Wendy Dare',
        'Lesley Howe',
        'Axel Block',
        'Catherine Predovic',
        'Miss Fermin Bartell',
        'Durward Runolfsson',
        'Kaley Jones',
        'Ms. Kiera Hodkiewicz',
        'Wilfredo Strosin',
        'Odie Reichel',
        'Leland Bahringer',
        'Ardella O\'Conner',
        'Ashton Oberbrunner',
        'Lamar Goodwin',
        'Elva Graham',
        'Antonio Monahan Mr.',
        'Dr. Jess Stokes',
        'Santino Kuvalis',
        'Clemens Howell Dr.',
        'Marquise Weimann',
        'Shana Lubowitz' ]
      )
    })

    it(`should have a valid structure after every delete`, () => {
      var errors = []

      for (let rec of db) {
        bpindex.delete(rec.age, rec.name)
        errors = validate(bpindex)
        if (errors.length > 0) { break }
      }

      if (errors.length > 0) {
        console.log(errors)
        console.log(JSON.stringify(bpindex.dumpTree(), null, 4))
      }

      assert.lengthOf(errors, 0, 'Errors array is not empty')
    })

    it(`should be empty after deleteing all previously inserted records`, () => {
      assert.lengthOf(bpindex.root.children, 0, 'Errors array is not empty')
      assert.lengthOf(bpindex.root.values, 0, 'Errors array is not empty')
    })
  })

  describe('String key indexes', () => {
    var bpindex = new BPlusTree({debug: false, branchingFactor: 5, comparator: compareThings})

    it(`should have a valid structure after every insert`, () => {
      var errors = []

      for (let rec of db) {
        bpindex.insert(rec.title, rec.name)
        errors = validate(bpindex)
        if (errors.length > 0) { break }
      }

      if (errors.length > 0) {
        console.log(errors)
        console.log(JSON.stringify(bpindex.dumpTree(), null, 4))
      }

      assert.lengthOf(errors, 0, 'Errors array is not empty')
    })

    it(`should correctly lookup keys`, () => {
      assert.deepEqual(bpindex.search('Legacy Security Planner'), ['Ashton Oberbrunner', 'Ms. Kiera Hodkiewicz'])
      assert.deepEqual(bpindex.search('Dynamic Communications Agent'), ['Hilda O\'Kon'])
      assert.deepEqual(bpindex.search('A job nobody has'), [])
    })

    it(`should correctly lookup ranges sorted asc`, () => {
      assert.deepEqual(
        bpindex.getBetweenBounds({$gte: 'Senior Detector Agent', $lt: 'Senior Klingon Consultant'}),
        ['Clemmie Powlowski', 'Serena Bruen', 'Albertha Simonis Ms.', 'Kavon Hammes']
      )
      assert.deepEqual(
        bpindex.getBetweenBounds({$gte: 'Senior Detector Agent', $lte: 'Senior Klingon Consultant'}),
        ['Clemmie Powlowski', 'Serena Bruen', 'Albertha Simonis Ms.', 'Kavon Hammes', 'Kyle MacGyver']
      )
      assert.deepEqual(
        bpindex.getBetweenBounds({$gt: 'Senior Detector Agent', $lte: 'Senior Klingon Consultant'}),
        ['Albertha Simonis Ms.', 'Kavon Hammes', 'Kyle MacGyver']
      )
      assert.deepEqual(
        bpindex.getBetweenBounds({$gt: 'Senior Detector Agent', $lt: 'Senior Klingon Consultant'}),
        ['Albertha Simonis Ms.', 'Kavon Hammes']
      )
    })

    it(`should correctly return the entire index sorted asc`, () => {
      assert.deepEqual(
        bpindex.getAll().map(x => x.value),
        [ 'Magdalen Zulauf Mr.',
        'Dr. Jess Stokes',
        'Marquise Weimann',
        'Elmo Hansen',
        'Santino Kuvalis',
        'Kaley Jones',
        'Catherine Predovic',
        'Hilda O\'Kon',
        'Wilfredo Strosin',
        'Odie Reichel',
        'Axel Block',
        'Clemens Howell Dr.',
        'Lamar Goodwin',
        'Makayla McLaughlin',
        'Wendy Dare',
        'Antonio Monahan Mr.',
        'Shana Lubowitz',
        'Leland Bahringer',
        'Lesley Howe',
        'Elva Graham',
        'Ashton Oberbrunner',
        'Ms. Kiera Hodkiewicz',
        'Miss Fermin Bartell',
        'Ardella O\'Conner',
        'Durward Runolfsson',
        'Clemmie Powlowski',
        'Serena Bruen',
        'Albertha Simonis Ms.',
        'Kavon Hammes',
        'Kyle MacGyver' ]
      )
    })

    it(`should have a valid structure after every delete`, () => {
      var errors = []

      for (let rec of db) {
        bpindex.delete(rec.title, rec.name)
        errors = validate(bpindex)
        if (errors.length > 0) { break }
      }

      if (errors.length > 0) {
        console.log(errors)
        console.log(JSON.stringify(bpindex.dumpTree(), null, 4))
      }

      assert.lengthOf(errors, 0, 'Errors array is not empty')
    })

    it(`should be empty after deleteing all previously inserted records`, () => {
      assert.lengthOf(bpindex.root.children, 0, 'Errors array is not empty')
      assert.lengthOf(bpindex.root.values, 0, 'Errors array is not empty')
    })

  })
});