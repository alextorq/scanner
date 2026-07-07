import { describe, expect, it } from 'vitest'
import {
  clampCameraPanelRect,
  getMinimumCameraPanelSizeFromFocus,
  moveCameraPanelRect,
  resizeCameraPanelRect,
  type CameraPanelConstraints,
} from '../core/camera-panel-layout'

describe('геометрия окна камеры', () => {
  const constraints: CameraPanelConstraints = {
    viewport: { width: 800, height: 600 },
    minimumSize: { width: 320, height: 240 },
    edgeGap: 16,
  }

  it('не даёт окну выйти за края экрана', () => {
    expect(clampCameraPanelRect({
      left: 700,
      top: 520,
      width: 280,
      height: 180,
    }, constraints)).toEqual({
      left: 464,
      top: 344,
      width: 320,
      height: 240,
    })
  })

  it('перемещает окно с учётом границ экрана', () => {
    expect(moveCameraPanelRect({
      left: 120,
      top: 80,
      width: 360,
      height: 280,
    }, {
      x: -200,
      y: 600,
    }, constraints)).toEqual({
      left: 16,
      top: 304,
      width: 360,
      height: 280,
    })
  })

  it('не ресайзит окно меньше минимального размера', () => {
    expect(resizeCameraPanelRect({
      left: 100,
      top: 90,
      width: 520,
      height: 390,
    }, {
      x: -500,
      y: -500,
    }, constraints)).toEqual({
      left: 100,
      top: 90,
      width: 320,
      height: 240,
    })
  })

  it('уменьшает минимум до доступного экрана, когда экран физически меньше', () => {
    expect(clampCameraPanelRect({
      left: 0,
      top: 0,
      width: 500,
      height: 400,
    }, {
      viewport: { width: 300, height: 220 },
      minimumSize: { width: 420, height: 320 },
      edgeGap: 12,
    })).toEqual({
      left: 12,
      top: 12,
      width: 276,
      height: 196,
    })
  })

  it('вычисляет минимальный размер окна по текущей области фокусирования', () => {
    expect(getMinimumCameraPanelSizeFromFocus(
      { width: 248.4, height: 156.1 },
      49.2,
    )).toEqual({
      width: 272,
      height: 206,
    })
  })
})
