/**
 * Modifications Copyright 2026 emartinez-dev-work
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { optimize } from 'svgo'
import { getSvgoPlugins } from './svgoConfig'

function getLegacySvgoPlugins (removeClasses: boolean): any[] {
  return [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false,
          removeUnknownsAndDefaults: removeClasses
        }
      }
    },
    'removeDoctype',
    'removeComments',
    {
      name: 'removeAttrs',
      params: {
        attrs: [
          'xmlns:xlink',
          'xml:space',
          ...(removeClasses ? ['class'] : [])
        ]
      }
    }
  ]
}

function optimizeWithPlugins (svg: string, plugins: any[]): string {
  return optimize(svg, {
    multipass: true,
    plugins
  }).data
}

function countOccurrences (text: string, value: string): number {
  return (text.match(new RegExp(value, 'g')) ?? []).length
}

const LOCAL_FIXTURE = new URL('./__fixtures-local__/problematic.svg', import.meta.url)

describe('getSvgoPlugins', () => {
  it('inlines multi-use class styles before removing class attributes', () => {
    const originalSvg = readFileSync(
      new URL('../static/multi-class-fixture.svg', import.meta.url),
      'utf8'
    )

    const legacyResult = optimizeWithPlugins(originalSvg, getLegacySvgoPlugins(true))
    const fixedResult = optimizeWithPlugins(originalSvg, getSvgoPlugins(true))
    const legacyStyleCount = countOccurrences(legacyResult, 'style=')
    const fixedStyleCount = countOccurrences(fixedResult, 'style=')

    assert.strictEqual(legacyStyleCount, 2)
    assert.ok(
      fixedStyleCount > legacyStyleCount,
      `expected fixed style count (${fixedStyleCount}) > legacy (${legacyStyleCount})`
    )
    assert.ok(!fixedResult.includes('class='))
    assert.ok(!fixedResult.includes('<style'))
    assert.ok(fixedResult.includes('stroke:#15323a'))
    assert.ok(fixedResult.includes('stroke-miterlimit:10'))

    const originalSize = Buffer.byteLength(originalSvg, 'utf8')
    const fixedSize = Buffer.byteLength(fixedResult, 'utf8')
    assert.ok(
      fixedSize < originalSize,
      `expected optimized size (${fixedSize}) < original (${originalSize})`
    )
  })

  it('preserves inline SVG class attributes when removeClasses is false', () => {
    const svg = '<svg><path class="icon" d="M0 0h1"/></svg>'
    const result = optimizeWithPlugins(svg, getSvgoPlugins(false))

    assert.ok(result.includes('class="icon"'))
  })
})

describe('flexygo mascot (local fixture)', () => {
  it('shrinks file size and preserves all class-derived styles', { skip: !existsSync(LOCAL_FIXTURE) }, () => {
    const original = readFileSync(LOCAL_FIXTURE, 'utf8')
    const optimized = optimizeWithPlugins(original, getSvgoPlugins(true))

    assert.ok(
      Buffer.byteLength(optimized, 'utf8') < Buffer.byteLength(original, 'utf8'),
      'optimized output must be smaller than input'
    )

    assert.ok(!optimized.includes('<style'), '<style> block must be removed')
    assert.ok(!optimized.includes('class='), 'class attributes must be removed')
    assert.ok(optimized.includes('#15323a'), 'stroke color must survive on elements')
    assert.ok(optimized.includes('#2eb2ab'), 'teal fill must survive on elements')
    assert.ok(optimized.includes('#fff'), 'white fill must survive on elements')
  })
})
