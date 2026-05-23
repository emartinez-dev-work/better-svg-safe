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

export function getSvgoPlugins (removeClasses: boolean): any[] {
  const plugins: any[] = [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Remove unreferenced IDs so collapseGroups can drop wrapper <g>s
          // in the multipass run. Do not rename IDs that survive; external
          // CSS/JS may still target them.
          cleanupIds: { remove: true, minify: false },
          // Disable removing unknown attributes (like onClick, data-*) when preserving classes (inline mode)
          removeUnknownsAndDefaults: removeClasses,
          // If classes are removed, every class-based rule must be inlined first.
          ...(removeClasses ? { inlineStyles: { onlyMatchedOnce: false } } : {})
        }
      }
    },
    'removeDoctype',
    'removeComments',
    {
      name: 'removeAttrs',
      params: {
        // Remove attributes that are not useful in most cases
        attrs: [
          'xmlns:xlink',
          'xml:space',
          ...(removeClasses ? ['class'] : [])
        ]
      }
    }
  ]

  return plugins
}
