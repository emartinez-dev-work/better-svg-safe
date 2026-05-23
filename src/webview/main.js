/**
 * Copyright 2025 Miguel Ángel Durán
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

const $ = document.querySelector.bind(document)
const vscode = acquireVsCodeApi()

;(function () {
  const preview = $('#preview')
  const svgWrapper = $('#svgWrapper')
  const colorPicker = $('#colorPicker')
  const colorPickerWrapper = $('#colorPickerWrapper')
  const colorSwatch = $('#colorSwatch')
  const toggleDarkBg = $('#toggleDarkBg')
  const toggleDarkBgWrapper = $('#toggleDarkBgWrapper')
  const centerIconWrapper = $('#centerIconWrapper')
  const optimizeWrapper = $('#optimizeWrapper')
  const interactiveToggleWrapper = $('#interactiveToggleWrapper')
  const zoomLevel = $('#zoomLevel')
  const svgSize = $('#svgSize')
  const previewFillRatio = 0.8

  // Get default color from the color picker value (set by template)
  let currentColor = colorPicker.value
  let isDarkBackground = false
  let isInteractiveMode = false
  let hoveredInteractiveElement = null
  let boundMouseover = null
  let boundMouseleave = null
  let boundClick = null
  let interactiveSvg = null

  // Zoom and pan state
  let scale = 1
  let translateX = 0
  let translateY = 0
  let isPanning = false
  let wasPanning = false
  let panStartX = 0
  let panStartY = 0
  let isAltPressed = false
  let svgFitFrame = null

  // Initialize color
  colorSwatch.style.backgroundColor = currentColor
  svgWrapper.style.color = currentColor

  const getSvgBounds = (svg) => {
    try {
      const bbox = svg.getBBox()
      if (Number.isFinite(bbox.x) && Number.isFinite(bbox.y) && (bbox.width > 0 || bbox.height > 0)) {
        return {
          x: bbox.x,
          y: bbox.y,
          width: Math.max(bbox.width, 1),
          height: Math.max(bbox.height, 1)
        }
      }
    } catch {}

    const viewBox = svg.viewBox?.baseVal
    if (viewBox && (viewBox.width > 0 || viewBox.height > 0)) {
      return {
        x: viewBox.x,
        y: viewBox.y,
        width: Math.max(viewBox.width, 1),
        height: Math.max(viewBox.height, 1)
      }
    }

    const width = Number.parseFloat(svg.getAttribute('width') ?? '')
    const height = Number.parseFloat(svg.getAttribute('height') ?? '')
    const rect = svg.getBoundingClientRect()
    const fallbackWidth = Number.isFinite(width) && width > 0 ? width : rect.width
    const fallbackHeight = Number.isFinite(height) && height > 0 ? height : rect.height

    if (
      (Number.isFinite(fallbackWidth) && fallbackWidth > 0) ||
      (Number.isFinite(fallbackHeight) && fallbackHeight > 0)
    ) {
      return {
        x: 0,
        y: 0,
        width: Math.max(fallbackWidth, 1),
        height: Math.max(fallbackHeight, 1)
      }
    }

    return null
  }

  const fitSvgToPreview = () => {
    const svg = svgWrapper.querySelector('svg')
    if (!svg) {
      return
    }

    const bounds = getSvgBounds(svg)
    if (!bounds) {
      return
    }

    svg.setAttribute(
      'viewBox',
      `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`
    )
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.style.overflow = 'visible'

    const maxWidth = preview.clientWidth * previewFillRatio
    const maxHeight = preview.clientHeight * previewFillRatio
    if (maxWidth <= 0 || maxHeight <= 0) {
      return
    }

    const aspectRatio = bounds.width / bounds.height
    let targetWidth = maxWidth
    let targetHeight = targetWidth / aspectRatio

    if (!Number.isFinite(targetHeight) || targetHeight > maxHeight) {
      targetHeight = maxHeight
      targetWidth = targetHeight * aspectRatio
    }

    if (!Number.isFinite(targetWidth) || targetWidth > maxWidth) {
      targetWidth = maxWidth
      targetHeight = targetWidth / aspectRatio
    }

    svg.style.width = `${Math.max(Math.round(targetWidth), 1)}px`
    svg.style.height = `${Math.max(Math.round(targetHeight), 1)}px`
  }

  const scheduleSvgFit = () => {
    if (svgFitFrame !== null) {
      return
    }

    svgFitFrame = window.requestAnimationFrame(() => {
      svgFitFrame = null
      fitSvgToPreview()
    })
  }

  scheduleSvgFit()

  // Update preview with currentColor
  const updatePreviewWithColor = (content) => {
    const wrapper = $('#svgWrapper')
    if (wrapper) {
      wrapper.innerHTML = content
      wrapper.style.color = currentColor
      scheduleSvgFit()
      updateTransform()
    }
  }

  const updateTransform = () => {
    svgWrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
    zoomLevel.textContent = `(${Math.round(scale * 100)}%)`
  }

  const resetZoom = () => {
    scale = 1
    translateX = 0
    translateY = 0
    updateTransform()
  }

  const updateSvgFileSize = () => {
    const wrapper = $('#svgWrapper')
    if (wrapper) {
      const byteSize = wrapper.getHTML().length
      const size = (byteSize / 1024).toFixed(1)
      svgSize.textContent = `(${size} KB)`
    }
  }

  const setInteractiveControls = () => {
    interactiveToggleWrapper.classList.toggle('active', isInteractiveMode)
  }

  const getInteractiveTarget = (target) => {
    if (!target || typeof target.closest !== 'function') {
      return null
    }

    const svg = svgWrapper.querySelector('svg')
    const element = target.closest('[data-besvg-line]')
    if (!svg || !element || element === svg || !svg.contains(element)) {
      return null
    }

    if (element.closest('[data-besvg-highlight-root]')) {
      return null
    }

    const line = Number.parseInt(element.getAttribute('data-besvg-line') ?? '', 10)
    if (!Number.isInteger(line)) {
      return null
    }

    return { element, line }
  }

  const createSvgElement = (tagName) => document.createElementNS('http://www.w3.org/2000/svg', tagName)

  const findDirectHighlightChild = (parent, attribute, value) => (
    Array.from(parent.children).find(child => child.getAttribute(attribute) === value)
  )

  const getHighlightLayer = (kind) => {
    const svg = svgWrapper.querySelector('svg')
    if (!svg) {
      return null
    }

    let root = findDirectHighlightChild(svg, 'data-besvg-highlight-root', 'true')
    if (!root) {
      root = createSvgElement('g')
      root.setAttribute('data-besvg-highlight-root', 'true')
      root.setAttribute('aria-hidden', 'true')
      root.style.pointerEvents = 'none'
      svg.appendChild(root)
    }

    let layer = findDirectHighlightChild(root, 'data-besvg-highlight-layer', kind)
    if (!layer) {
      layer = createSvgElement('g')
      layer.setAttribute('data-besvg-highlight-layer', kind)
      layer.style.pointerEvents = 'none'
      root.appendChild(layer)
    }

    return { svg, layer }
  }

  const clearHighlightLayer = (kind) => {
    const svg = svgWrapper.querySelector('svg')
    const root = svg ? findDirectHighlightChild(svg, 'data-besvg-highlight-root', 'true') : null
    const layer = root ? findDirectHighlightChild(root, 'data-besvg-highlight-layer', kind) : null
    if (layer) {
      layer.textContent = ''
    }
  }

  const applyHighlightStroke = (element, kind) => {
    const strokeWidth = kind === 'selected' ? '2.5' : '2'
    const elements = [element, ...element.querySelectorAll('*')]

    for (const node of elements) {
      node.removeAttribute('id')
      node.removeAttribute('data-besvg-line')
      node.setAttribute('fill', 'none')
      node.setAttribute('stroke', '#007acc')
      node.setAttribute('stroke-width', strokeWidth)
      node.setAttribute('vector-effect', 'non-scaling-stroke')
      node.setAttribute('pointer-events', 'none')
      node.style.setProperty('fill', 'none', 'important')
      node.style.setProperty('stroke', '#007acc', 'important')
      node.style.setProperty('stroke-width', strokeWidth, 'important')
      node.style.setProperty('vector-effect', 'non-scaling-stroke', 'important')
      node.style.setProperty('pointer-events', 'none', 'important')
    }
  }

  const applyRootRelativeTransform = (svg, sourceElement, clone) => {
    if (typeof svg.getCTM !== 'function' || typeof sourceElement.getCTM !== 'function') {
      return
    }

    const svgMatrix = svg.getCTM()
    const elementMatrix = sourceElement.getCTM()
    if (!svgMatrix || !elementMatrix) {
      return
    }

    try {
      const matrix = svgMatrix.inverse().multiply(elementMatrix)
      clone.removeAttribute('transform')
      clone.setAttribute(
        'transform',
        `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`
      )
    } catch {}
  }

  const renderHighlight = (kind, element) => {
    const highlight = getHighlightLayer(kind)
    if (!highlight) {
      return
    }

    highlight.layer.textContent = ''
    if (!element) {
      return
    }

    const clone = element.cloneNode(true)
    applyRootRelativeTransform(highlight.svg, element, clone)
    applyHighlightStroke(clone, kind)
    highlight.layer.appendChild(clone)
  }

  const clearHoverHighlight = () => {
    hoveredInteractiveElement = null
    clearHighlightLayer('hover')
  }

  const clearInteractiveSelection = () => {
    clearHighlightLayer('selected')
  }

  const handleInteractiveMouseover = (e) => {
    const target = getInteractiveTarget(e.target)
    if (!target) {
      clearHoverHighlight()
      return
    }

    if (target.element === hoveredInteractiveElement) {
      return
    }

    hoveredInteractiveElement = target.element
    renderHighlight('hover', target.element)
  }

  const handleInteractiveClick = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const target = getInteractiveTarget(e.target)
    if (!target) {
      return
    }

    renderHighlight('selected', target.element)

    vscode.postMessage({
      type: 'selectElement',
      line: target.line
    })
  }

  const detachInteractiveListeners = () => {
    if (interactiveSvg && boundMouseover) {
      interactiveSvg.removeEventListener('mouseover', boundMouseover)
    }

    if (interactiveSvg && boundMouseleave) {
      interactiveSvg.removeEventListener('mouseleave', boundMouseleave)
    }

    if (interactiveSvg && boundClick) {
      interactiveSvg.removeEventListener('click', boundClick, true)
    }

    interactiveSvg = null
    clearHoverHighlight()
    clearInteractiveSelection()
  }

  const attachInteractiveListeners = () => {
    if (!isInteractiveMode) {
      return
    }

    const svg = svgWrapper.querySelector('svg')
    if (!svg || interactiveSvg === svg) {
      return
    }

    detachInteractiveListeners()
    boundMouseover = boundMouseover ?? handleInteractiveMouseover
    boundMouseleave = boundMouseleave ?? clearHoverHighlight
    boundClick = boundClick ?? handleInteractiveClick
    svg.addEventListener('mouseover', boundMouseover)
    svg.addEventListener('mouseleave', boundMouseleave)
    svg.addEventListener('click', boundClick, true)
    interactiveSvg = svg
  }

  colorPickerWrapper.addEventListener('click', () => {
    colorPicker.click()
  })

  colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value
    colorSwatch.style.backgroundColor = currentColor
    svgWrapper.style.color = currentColor
  })

  // Toggle dark background
  toggleDarkBgWrapper.addEventListener('click', () => {
    isDarkBackground = !isDarkBackground

    if (isDarkBackground) {
      preview.classList.add('dark-background')
      toggleDarkBg.innerHTML = '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336m-9 1.732a8 8 0 0 0 4.001 14.928l-.001 -16a8 8 0 0 0 -4 1.072" />'
      toggleDarkBg.setAttribute('fill', 'currentColor')
      toggleDarkBg.removeAttribute('stroke')
      toggleDarkBg.removeAttribute('stroke-width')
      toggleDarkBg.removeAttribute('stroke-linecap')
      toggleDarkBg.removeAttribute('stroke-linejoin')
    } else {
      preview.classList.remove('dark-background')
      toggleDarkBg.innerHTML = '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 17a5 5 0 0 0 0 -10v10" />'
      toggleDarkBg.setAttribute('fill', 'none')
      toggleDarkBg.setAttribute('stroke', 'currentColor')
      toggleDarkBg.setAttribute('stroke-width', '1.5')
      toggleDarkBg.setAttribute('stroke-linecap', 'round')
      toggleDarkBg.setAttribute('stroke-linejoin', 'round')
    }
  })

  // Center icon functionality
  centerIconWrapper.addEventListener('click', () => {
    resetZoom()
  })

  interactiveToggleWrapper.addEventListener('click', () => {
    isInteractiveMode = !isInteractiveMode
    setInteractiveControls()

    if (isInteractiveMode) {
      vscode.postMessage({
        type: 'enableInteractive'
      })
      attachInteractiveListeners()
    } else {
      detachInteractiveListeners()
      vscode.postMessage({
        type: 'disableInteractive'
      })
    }
  })

  // Optimize functionality
  optimizeWrapper.addEventListener('click', () => {
    if (isInteractiveMode) {
      isInteractiveMode = false
      setInteractiveControls()
      detachInteractiveListeners()
      vscode.postMessage({
        type: 'disableInteractive'
      })
    }

    vscode.postMessage({
      type: 'optimize'
    })
  })

  // Zoom and pan functionality
  preview.addEventListener('click', (e) => {
    if (wasPanning) return

    if (e.target === preview || e.target === svgWrapper || e.target.closest('svg')) {
      // Check both the stored state and the event's altKey
      if (isAltPressed || e.altKey) {
        // Zoom out
        scale = Math.max(0.1, scale - 0.2)
      } else {
        // Zoom in
        scale = Math.min(10, scale + 0.5)
      }
      updateTransform()
    }
  })

  preview.addEventListener('wheel', (e) => {
    // Check both the stored state and the event's altKey
    if (isAltPressed || e.altKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      scale = Math.max(0.1, Math.min(10, scale + delta))
      updateTransform()
    }
  }, { passive: false })

  preview.addEventListener('mousedown', (e) => {
    // Only start panning if clicking on the SVG with left button and not on color picker
    if (e.button === 0 && scale > 1 && !e.target.closest('.preview-header-controls')) {
      isPanning = true
      wasPanning = false
      panStartX = e.clientX - translateX
      panStartY = e.clientY - translateY
      preview.classList.add('grabbing')
      e.preventDefault()
    }
  })

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      wasPanning = true
      translateX = e.clientX - panStartX
      translateY = e.clientY - panStartY
      updateTransform()
    }

    // Update cursor based on altKey state
    if (e.altKey && !isAltPressed) {
      isAltPressed = true
      preview.classList.add('zoom-out-cursor')
    } else if (!e.altKey && isAltPressed) {
      isAltPressed = false
      preview.classList.remove('zoom-out-cursor')
    }
  })

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false
      preview.classList.remove('grabbing')
    }
  })

  // Track Alt key state
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' || e.key === 'Option') {
      isAltPressed = true
      preview.classList.add('zoom-out-cursor')
    }
  })

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' || e.key === 'Option') {
      isAltPressed = false
      preview.classList.remove('zoom-out-cursor')
    }
  })

  // Reset Alt state when window loses focus
  window.addEventListener('blur', () => {
    isAltPressed = false
    preview.classList.remove('zoom-out-cursor')
  })

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => {
      scheduleSvgFit()
    })
    resizeObserver.observe(preview)
  } else {
    window.addEventListener('resize', () => {
      scheduleSvgFit()
    })
  }

  // Listen for updates from extension
  window.addEventListener('message', event => {
    const message = event.data
    if (message.type === 'update') {
      updatePreviewWithColor(message.content)
      updateSvgFileSize()
      resetZoom()
      attachInteractiveListeners()
    } else if (message.type === 'clear') {
      isInteractiveMode = false
      setInteractiveControls()
      detachInteractiveListeners()
      svgWrapper.innerHTML = ''
      updateSvgFileSize()
      resetZoom()
    } else if (message.type === 'disableInteractiveMode') {
      isInteractiveMode = false
      setInteractiveControls()
      detachInteractiveListeners()
    }
  })
})()
