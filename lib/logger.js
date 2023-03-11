import { pino } from 'pino'

export const logger = pino({
  timestamp: false,
  formatters: {
    bindings (bindings) {
      // return { pid: bindings.pid, hostname: bindings.hostname }
      return {}
    },
  },
})
