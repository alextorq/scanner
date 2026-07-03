import { describe, expect, it } from 'vitest'
import {
  initialCameraState,
  mapCameraError,
  transitionCamera,
} from '../domain/camera-machine'

describe('автомат камеры', () => {
  it('проходит полный путь запуска и закрытия', () => {
    const requesting = transitionCamera(initialCameraState, { type: 'OPEN' })
    const starting = transitionCamera(requesting, { type: 'STREAM_RECEIVED' })
    const active = transitionCamera(starting, { type: 'VIDEO_STARTED' })
    const closed = transitionCamera(active, { type: 'CLOSE' })

    expect(requesting).toEqual({ value: 'requesting-permission' })
    expect(starting).toEqual({ value: 'starting-camera' })
    expect(active).toEqual({ value: 'active' })
    expect(closed).toEqual({ value: 'closed' })
  })

  it('не выполняет недопустимый переход', () => {
    const state = transitionCamera(initialCameraState, { type: 'VIDEO_STARTED' })

    expect(state).toBe(initialCameraState)
  })

  it('позволяет закрыть камеру во время запроса разрешения', () => {
    const requesting = transitionCamera(initialCameraState, { type: 'OPEN' })

    expect(transitionCamera(requesting, { type: 'CLOSE' })).toEqual({ value: 'closed' })
  })

  it('переводит любое рабочее состояние в ошибку', () => {
    const requesting = transitionCamera(initialCameraState, { type: 'OPEN' })

    expect(transitionCamera(requesting, {
      type: 'FAILED',
      reason: 'permission-denied',
    })).toEqual({ value: 'error', reason: 'permission-denied' })
  })
})

describe('преобразование ошибок камеры', () => {
  it('отдельно обрабатывает небезопасный контекст', () => {
    expect(mapCameraError(new Error('ошибка'), false)).toBe('insecure-context')
  })

  it('распознаёт отказ пользователя', () => {
    expect(mapCameraError(new DOMException('отказ', 'NotAllowedError'), true))
      .toBe('permission-denied')
  })

  it('распознаёт занятую камеру', () => {
    expect(mapCameraError(new DOMException('занята', 'NotReadableError'), true))
      .toBe('camera-busy')
  })
})
