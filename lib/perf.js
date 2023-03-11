import { _ } from './util.js'
import Hyperid from 'hyperid'
import { PerformanceObserver, performance } from 'node:perf_hooks'

const hyperid = Hyperid()
const genId = () => hyperid()

let perfEnabled = 0
export const enablePerf = () => {
  perfEnabled = 1
}

const obs = new PerformanceObserver((items) => {
  const subtractables = []
  let results

  for (const item of items.getEntriesByType('measure')) {
    if (item.name.toLowerCase().includes('#filter')) {
      subtractables.push(item.duration)
      continue
    }

    if (item.name.toLowerCase().includes('#results')) {
      results = item.duration
      continue
    }

    if (perfEnabled) {
      console.log(
        item.name,
        item.duration,
      )
    }
  }

  console.log('Result Time (ms)', _.reduce(subtractables, (acc, value) => acc - value, results).toFixed(3))

  performance.clearMarks()
})

obs.observe({ type: 'measure' })

// Export util functions bound to the performance context
export const mark = performance.mark.bind(performance)

export const measure = performance.measure.bind(performance)

export function perfWrap (name, fn) {
  const id = genId()
  mark(id)

  const results = fn()

  measure(name, id)

  return results
}
