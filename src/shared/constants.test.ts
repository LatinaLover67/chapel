import { test, expect } from 'vitest'
import { modelLabel } from './constants'

test('modelLabel turns a model id into its short name', () => {
  expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelLabel('claude-sonnet-5-5')).toBe('Sonnet 5.5')
})
