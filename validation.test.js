import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { validation } from './lib/validation.js'

const searchBooksRequestSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    fields: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'fields'],
}

test('Invalid data has an errors object that can be made human readable with errorsText', () => {
  const invalidSearchBooksRequest = {
    myTitle: 'habit',
    fields: ['title', 'weight', 'number_of_pages'],
  }

  assert.throws(() => {
    const validate = validation.compile(searchBooksRequestSchema)

    if (!validate(invalidSearchBooksRequest)) {
      throw new Error(
        'searchBooksByTitle called with invalid argument: ' +
          validation.errorsText(validate.errors),
      )
    }
  })
})

test('Valid data returns ok', () => {
  const validSearchBooksRequest = {
    title: 'habit',
    fields: ['title', 'weight', 'number_of_pages'],
  }

  assert.ok(validation.compile(searchBooksRequestSchema)(validSearchBooksRequest))
})
