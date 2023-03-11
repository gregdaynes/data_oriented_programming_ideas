import lodash from 'lodash/fp.js'

// Every option is `true` by default.
export const _ = lodash.convert({
  // Specify capping iteratee arguments.
  cap: false,
  // Specify currying.
  curry: false,
  // Specify fixed arity.
  fixed: false,
  // Specify immutable operations.
  immutable: true,
  // Specify rearranging arguments.
  rearg: false,
})
