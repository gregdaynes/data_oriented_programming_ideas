import Knex from 'knex'

export const dbConnection = Knex({
  client: 'better-sqlite3',
  connection: {
    filename: ':memory:',
  },
  useNullAsDefault: true,
})
