import type { FrameSize } from './frame-geometry'

export interface CameraPanelPoint {
  x: number
  y: number
}

export interface CameraPanelRect extends FrameSize {
  left: number
  top: number
}

export interface CameraPanelSize extends FrameSize {}

export interface CameraPanelConstraints {
  viewport: FrameSize
  minimumSize: CameraPanelSize
  edgeGap: number
}

export const CAMERA_PANEL_EDGE_GAP = 14
export const CAMERA_PANEL_MIN_CONTROL_WIDTH = 272

export function getMinimumCameraPanelSizeFromFocus(
  focusSize: FrameSize,
  chromeHeight: number,
  minControlWidth = CAMERA_PANEL_MIN_CONTROL_WIDTH,
): CameraPanelSize {
  return {
    width: Math.ceil(Math.max(minControlWidth, positive(focusSize.width))),
    height: Math.ceil(Math.max(1, positive(focusSize.height) + Math.max(0, chromeHeight))),
  }
}

export function moveCameraPanelRect(
  start: CameraPanelRect,
  delta: CameraPanelPoint,
  constraints: CameraPanelConstraints,
): CameraPanelRect {
  return clampCameraPanelRect({
    ...start,
    left: start.left + delta.x,
    top: start.top + delta.y,
  }, constraints)
}

export function resizeCameraPanelRect(
  start: CameraPanelRect,
  delta: CameraPanelPoint,
  constraints: CameraPanelConstraints,
): CameraPanelRect {
  return clampCameraPanelRect({
    ...start,
    width: start.width + delta.x,
    height: start.height + delta.y,
  }, constraints)
}

export function clampCameraPanelRect(
  rect: CameraPanelRect,
  constraints: CameraPanelConstraints,
): CameraPanelRect {
  const viewportWidth = positive(constraints.viewport.width)
  const viewportHeight = positive(constraints.viewport.height)
  const edgeGap = Math.max(0, constraints.edgeGap)
  const availableWidth = Math.max(1, viewportWidth - edgeGap * 2)
  const availableHeight = Math.max(1, viewportHeight - edgeGap * 2)
  const minWidth = Math.min(availableWidth, positive(constraints.minimumSize.width))
  const minHeight = Math.min(availableHeight, positive(constraints.minimumSize.height))
  const width = clamp(positive(rect.width), minWidth, availableWidth)
  const height = clamp(positive(rect.height), minHeight, availableHeight)
  const maxLeft = Math.max(edgeGap, viewportWidth - edgeGap - width)
  const maxTop = Math.max(edgeGap, viewportHeight - edgeGap - height)

  return {
    left: Math.round(clamp(rect.left, edgeGap, maxLeft)),
    top: Math.round(clamp(rect.top, edgeGap, maxTop)),
    width: Math.round(width),
    height: Math.round(height),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}
