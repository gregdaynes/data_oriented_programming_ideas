import Immutable from 'immutable'
import { _ } from './lib/util.js'
import { dbConnection } from './lib/database.js'
import { validation } from './lib/validation.js'
import { perfWrap, mark, measure, enablePerf } from './lib/perf.js'
enablePerf()

/**
 * How would I effectively, efficiently, and painlessly
 * retrieve data from a database, work with it, and then write it back to the database?
 *
 * possible idea
 * -------------
 * 1. fetch the data (string key fix from snake_case to pascalCase)
 * 2. validate the data fetched for schema (don't pull the wrong data shape)
 * 3. convert valid fetched data to persistent data structure
 * 4. perform business logic operations
 * 5. validate the data for schema to insert
 * 6. perform insertion
 */

/**
 * 0) Setup Database
 */

await perfWrap('Migrate and seed database', async () => {
  if (await dbConnection.schema.hasTable('read_write_test')) return

  await dbConnection.schema.createTable('read_write_test', function (table) {
    table.increments()
    table.string('name')
    table.string('long_name')
    table.datetime('date_time').defaultTo(dbConnection.fn.now())
    table.boolean('is_test').defaultTo(true)
  })

  await dbConnection('read_write_test').insert({
    name: 'test',
    long_name: 'test test',
  })

  await dbConnection('read_write_test').insert({
    name: 'other',
    long_name: 'other test',
  })
})

/**
 * 1) Fetching Data from Database
 * - make query to database for collection
 * - iterate collection to pascalCase all snake_case keys based on a map
 */

mark('operation-start')

function renameKeys (map, keyMap) {
  return _.reduce(keyMap, (acc, newKey, oldKey) => {
    const value = _.get(map, oldKey)

    const accWithNewKey = _.set(acc, newKey, value)
    const accWithoutOldKey = _.omit(accWithNewKey, oldKey)

    return accWithoutOldKey
  }, map)
}

function transformCollectionKeys (collection, keyMap) {
  return _.map(collection, (item) => {
    return renameKeys(item, keyMap)
  })
}

let fetchedData
await perfWrap('Fetch data from database', async () => {
  fetchedData = await dbConnection('read_write_test').select()
})

let fetchedDataTransformed
perfWrap('Transform keys of database results to Pascal case', () => {
  fetchedDataTransformed = transformCollectionKeys(fetchedData, {
    long_name: 'longName',
    date_time: 'timestamp',
    is_test: 'isTest',
  })
})

/**
 * 2) Validate data before business operation
 * - assemble schema
 * - validate collection against schema (only in dev mode)
 */

const collectionSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
      longName: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
      isTest: { type: 'number' },
    },
  },
}

let validate
perfWrap('Compile schema #filter', () => {
  validate = validation.compile(collectionSchema)
})

perfWrap('Compile schema (pre-compiled uses cache)', () => {
  validation.compile(collectionSchema)
})

perfWrap('Validate fetched data against schema', () => {
  if (!validate(fetchedDataTransformed)) {
    throw new Error(
      validation.errorsText(validate.errors),
    )
  }
})

/**
 * 3) Transform fetched data to persistent data structure
 */

let persistentDataStructure
perfWrap('Convert to persistent data structure', () => {
  persistentDataStructure = Immutable.fromJS(fetchedDataTransformed)
})

/**
 * 4) Business Time!
 * - change the name
 * - change the longName
 * - update timestamp
 */

// Augment Immutable
Immutable.filter = function (coll, f) {
  if (Immutable.isMap(coll)) {
    return coll.valueSeq().filter(f)
  }
  return coll.filter(f)
}

Immutable.map = function (coll, f) {
  return coll.map(f)
}

// Our module containing data operations
class Test {
  static searchByName (testData, query) {
    const allMembers = testData
    const queryLowerCased = query.toLowerCase()

    const matchingMembers = Immutable.filter(allMembers, function filterMembers (member) {
      return Immutable.get(member, 'name')
        .toLowerCase()
        .includes(queryLowerCased)
    })

    return Immutable.map(matchingMembers, function constructInfo (member) {
      return Test.memberInfo(testData, member)
    })
  }

  static memberInfo (testData, member) {
    const memberInfo = Immutable.Map({
      id: Immutable.get(member, 'id'),
      name: Immutable.get(member, 'name'),
      longName: Immutable.get(member, 'longName'),
      timestamp: Test.coerceTimestamp(
        testData,
        Immutable.get(member, 'timestamp')),
    })

    return memberInfo
  }

  static coerceTimestamp (testData, timestamp) {
    if (typeof timestamp !== 'string') return timestamp

    return new Date(timestamp)
  }

  static updateName (testData, memberId, value) {
    const allMembers = testData

    const matchingMembers = Immutable.filter(allMembers, function filterMembers (member) {
      return Immutable.get(member, 'id') === memberId
    })

    return Immutable.map(matchingMembers, function updateName (member) {
      return Immutable.set(member, 'name', value)
    })
  }
}

let updatedPersistentDataStructure = persistentDataStructure
perfWrap('Update membership name', () => {
  updatedPersistentDataStructure = Test.updateName(persistentDataStructure, 1, 'xxx')
})

/**
 * 5) Validate updated data
 * - rerun the validation (or maybe we have a new validation to test)
 */

perfWrap('Validate updated data against schema', () => {
  if (!validate(updatedPersistentDataStructure.toJS())) {
    throw new Error(
      validation.errorsText(validate.errors),
    )
  }
})

/**
 * 6) Store the updated data in the db
 */

await perfWrap('Update database', async () => {
  const items = updatedPersistentDataStructure.toJS()
  const itemsWithSnakeCaseKeys = transformCollectionKeys(items, {
    longName: 'long_name',
    timestamp: 'date_time',
    isTest: 'is_test',
  })

  dbConnection.transaction(trx => {
    const queries = []

    itemsWithSnakeCaseKeys.forEach(item => {
      const query = dbConnection('read_write_test')
        .where('id', item.id)
        .update(item)
        .transacting(trx) // This makes every update be in the same transaction
      queries.push(query)
    })

    return Promise.all(queries) // Once every query is written
      .then(trx.commit) // We try to execute all of them
      .catch(trx.rollback) // And rollback in case any of them goes wrong
  })
})

/**
 * 7) Check that the items were updated
 */

const output = await dbConnection('read_write_test').select()

// ----------------------------------------------------------
measure('Operation Total Time #results', 'operation-start')
console.log('\n==============================\n✅', output)
