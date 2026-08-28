import { describe, expect, it } from 'vitest'

import {
  alignLogoLayer,
  calculateAlignedPosition,
  calculateLogoRect,
  calculateTextBoxLayout,
  clampLogoLayer,
  fitFontSizeToWidth,
} from './geometry'
import { createDefaultLogoLayer, createDefaultTextLayer } from '@/core/template/defaultRecipe'

const photo = { width: 1600, height: 1200 }
const squareLogo = { width: 400, height: 400 }

describe('logo geometry', () => {
  it('converts percentage placement to full-resolution pixels', () => {
    const rect = calculateLogoRect(
      {
        ...createDefaultLogoLayer(),
        xPercent: 10,
        yPercent: 20,
        widthPercent: 25,
      },
      photo,
      squareLogo,
    )

    expect(rect).toEqual({
      x: 160,
      y: 240,
      width: 400,
      height: 400,
    })
  })

  it('keeps the layer inside the photo bounds', () => {
    const layer = clampLogoLayer(
      {
        ...createDefaultLogoLayer(),
        xPercent: 99,
        yPercent: 99,
        widthPercent: 20,
      },
      photo,
      squareLogo,
    )

    expect(layer.xPercent).toBe(80)
    expect(layer.yPercent).toBeCloseTo(73.3333, 3)
  })

  it('aligns the logo to the bottom-right safe margin', () => {
    const layer = alignLogoLayer(
      {
        ...createDefaultLogoLayer(),
        widthPercent: 20,
      },
      'bottom-right',
      photo,
      squareLogo,
    )

    expect(layer.xPercent).toBe(77)
    expect(layer.yPercent).toBeCloseTo(70.3333, 3)
  })

  it('reduces long text proportionally to fit its safe width', () => {
    expect(fitFontSizeToWidth(48, 1200, 900)).toBe(36)
    expect(fitFontSizeToWidth(48, 800, 900)).toBe(48)
  })

  it('uses the layer position as the outer text box origin', () => {
    const layout = calculateTextBoxLayout(
      {
        ...createDefaultTextLayer(),
        xPercent: 10,
        yPercent: 20,
        fontSizePercent: 5,
        paddingPercent: 1,
      },
      photo,
      400,
    )

    expect(layout.x).toBe(160)
    expect(layout.y).toBe(240)
    expect(layout.padding).toBe(16)
    expect(layout.fontSize).toBe(80)
    expect(layout.width).toBe(432)
    expect(layout.height).toBe(128)
  })

  it('calculates a bottom-center position for any measured layer box', () => {
    expect(calculateAlignedPosition('bottom-center', 30, 10)).toEqual({
      xPercent: 35,
      yPercent: 87,
    })
  })
})
