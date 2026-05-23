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

import * as vscode from 'vscode'
import { Buffer } from 'buffer'
import { optimize } from 'svgo/browser'
import { getSvgoPlugins } from './svgoConfig'

export { getSvgoPlugins }

export async function formatSvgDocument (document: vscode.TextDocument) {
  const svgContent = document.getText()

  const result = optimize(svgContent, {
    plugins: [],
    js2svg: {
      pretty: true,
      indent: 2
    }
  })

  const edit = new vscode.WorkspaceEdit()
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(svgContent.length)
  )
  edit.replace(document.uri, fullRange, result.data)

  await vscode.workspace.applyEdit(edit)
  await document.save()
}

export async function optimizeSvgDocument (document: vscode.TextDocument) {
  const svgContent = document.getText()

  try {
    const plugins = getSvgoPlugins(true)

    const result = optimize(svgContent, {
      multipass: true,
      plugins
    })

    const edit = new vscode.WorkspaceEdit()
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(svgContent.length)
    )
    edit.replace(document.uri, fullRange, result.data)

    await vscode.workspace.applyEdit(edit)

    // Calculate savings
    const originalSize = Buffer.byteLength(svgContent, 'utf8')
    const optimizedSize = Buffer.byteLength(result.data, 'utf8')
    const savingPercent = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2)
    const originalSizeKB = (originalSize / 1024).toFixed(2)
    const optimizedSizeKB = (optimizedSize / 1024).toFixed(2)

    vscode.window.showInformationMessage(
      `SVG optimized. Reduced from ${originalSizeKB} KB to ${optimizedSizeKB} KB (${savingPercent}% saved)`
    )
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to optimize SVG: ${error}`)
  }
}
