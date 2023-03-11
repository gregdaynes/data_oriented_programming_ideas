import Ajv from 'ajv'
import addFormats from 'ajv-formats'

export const validation = addFormats(new Ajv({
  allErrors: true,
  removeAdditional: false,
}))
