import { clamp } from '@/core/rendering/geometry'
import type {
  LogoLayer,
  OutputFormat,
  TemplateCanvas,
  TemplateLayer,
  TemplateOutput,
  TemplateVariables,
  TextLayer,
  VisualRecipe,
  WatermarkLayer,
} from '@/types/template'

import {
  createDefaultLogoLayer,
  createDefaultTextLayer,
  createDefaultWatermarkLayer,
} from './defaultRecipe'

/**
 * Template JSON tek doğruluk kaynağıdır ve tarayıcı depolamasından geldiği için
 * güvenilmez veri sayılır. Bu modül, kaydı uygulamaya vermeden önce sürümünü
 * denetler ve her alanı bilinen tipe ve güvenli aralığa indirger.
 */
export const CURRENT_RECIPE_SCHEMA_VERSION = 1
export const MINIMUM_SUPPORTED_RECIPE_SCHEMA_VERSION = 1

const MAX_TEXT_LENGTH = 200
const MAX_VARIABLE_LENGTH = 120
const MAX_NAME_LENGTH = 120
const MAX_ID_LENGTH = 128

export type TemplateParseErrorCode =
  | 'malformed'
  | 'missing-version'
  | 'newer-version'
  | 'unsupported-version'
  | 'no-usable-layers'
  | 'missing-identity'

export interface TemplateParseFailure {
  ok: false
  code: TemplateParseErrorCode
  message: string
}

export interface RecipeParseSuccess {
  ok: true
  recipe: VisualRecipe
  repairs: string[]
}

export type RecipeParseResult = RecipeParseSuccess | TemplateParseFailure

function fail(code: TemplateParseErrorCode, message: string): TemplateParseFailure {
  return { ok: false, code, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface NumberOptions {
  fallback: number
  minimum: number
  maximum: number
  label: string
  repairs: string[]
}

function readNumber(value: unknown, options: NumberOptions): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    options.repairs.push(`${options.label} okunamadı, varsayılan değere döndürüldü.`)
    return clamp(options.fallback, options.minimum, options.maximum)
  }

  const clamped = clamp(value, options.minimum, options.maximum)
  if (clamped !== value) {
    options.repairs.push(`${options.label} güvenli aralığa çekildi.`)
  }
  return clamped
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readOption<T extends string | number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string,
  repairs: string[],
): T {
  if (allowed.includes(value as T)) {
    return value as T
  }

  repairs.push(`${label} tanınmadı, varsayılan değere döndürüldü.`)
  return fallback
}

function readColor(value: unknown, fallback: string, label: string, repairs: string[]): string {
  if (typeof value === 'string') {
    const candidate = value.trim().toLowerCase()
    if (/^#[0-9a-f]{6}$/.test(candidate)) {
      return candidate
    }
    if (/^#[0-9a-f]{3}$/.test(candidate)) {
      const [, r, g, b] = candidate
      return `#${r}${r}${g}${g}${b}${b}`
    }
  }

  repairs.push(`${label} geçerli bir renk değeri değildi, varsayılana döndürüldü.`)
  return fallback
}

function readString(
  value: unknown,
  fallback: string,
  maximumLength: number,
  label: string,
  repairs: string[],
): string {
  if (typeof value !== 'string') {
    repairs.push(`${label} metin değildi, varsayılana döndürüldü.`)
    return fallback
  }

  const cleaned = stripControlCharacters(value)
  if (cleaned.length > maximumLength) {
    repairs.push(`${label} çok uzundu, kısaltıldı.`)
    return cleaned.slice(0, maximumLength)
  }
  return cleaned
}

// Kontrol karakterleri hem Konva sahnesinde hem Canvas 2D çıktısında görünmez
// bozulmaya yol açtığı için boşluğa çevrilir.
function stripControlCharacters(value: string): string {
  let result = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    result += code < 0x20 || code === 0x7f ? ' ' : character
  }
  return result
}

function readLayerId(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const candidate = value.trim()
    if (candidate.length > 0 && candidate.length <= MAX_ID_LENGTH) {
      return candidate
    }
  }
  return fallback
}

function parseLogoLayer(raw: Record<string, unknown>, repairs: string[]): LogoLayer {
  const defaults = createDefaultLogoLayer()

  return {
    id: readLayerId(raw.id, defaults.id),
    type: 'image',
    role: 'logo',
    xPercent: readNumber(raw.xPercent, {
      fallback: defaults.xPercent,
      minimum: 0,
      maximum: 100,
      label: 'Logo yatay konumu',
      repairs,
    }),
    yPercent: readNumber(raw.yPercent, {
      fallback: defaults.yPercent,
      minimum: 0,
      maximum: 100,
      label: 'Logo dikey konumu',
      repairs,
    }),
    widthPercent: readNumber(raw.widthPercent, {
      fallback: defaults.widthPercent,
      minimum: 5,
      maximum: 70,
      label: 'Logo genişliği',
      repairs,
    }),
    opacity: readNumber(raw.opacity, {
      fallback: defaults.opacity,
      minimum: 0.05,
      maximum: 1,
      label: 'Logo şeffaflığı',
      repairs,
    }),
    rotation: readNumber(raw.rotation, {
      fallback: defaults.rotation,
      minimum: -180,
      maximum: 180,
      label: 'Logo dönüşü',
      repairs,
    }),
  }
}

function parseTextLayer(raw: Record<string, unknown>, repairs: string[]): TextLayer {
  const defaults = createDefaultTextLayer()

  return {
    id: readLayerId(raw.id, defaults.id),
    type: 'text',
    role: 'text',
    value: readString(raw.value, defaults.value, MAX_TEXT_LENGTH, 'Metin içeriği', repairs),
    xPercent: readNumber(raw.xPercent, {
      fallback: defaults.xPercent,
      minimum: 0,
      maximum: 95,
      label: 'Metin yatay konumu',
      repairs,
    }),
    yPercent: readNumber(raw.yPercent, {
      fallback: defaults.yPercent,
      minimum: 0,
      maximum: 95,
      label: 'Metin dikey konumu',
      repairs,
    }),
    fontSizePercent: readNumber(raw.fontSizePercent, {
      fallback: defaults.fontSizePercent,
      minimum: 1,
      maximum: 10,
      label: 'Metin boyutu',
      repairs,
    }),
    fontFamily: 'Inter Variable',
    fontWeight: readOption(
      raw.fontWeight,
      [400, 600, 700] as const,
      defaults.fontWeight,
      'Metin kalınlığı',
      repairs,
    ),
    color: readColor(raw.color, defaults.color, 'Metin rengi', repairs),
    opacity: readNumber(raw.opacity, {
      fallback: defaults.opacity,
      minimum: 0.05,
      maximum: 1,
      label: 'Metin şeffaflığı',
      repairs,
    }),
    backgroundEnabled: readBoolean(raw.backgroundEnabled, defaults.backgroundEnabled),
    backgroundColor: readColor(
      raw.backgroundColor,
      defaults.backgroundColor,
      'Metin arka plan rengi',
      repairs,
    ),
    paddingPercent: readNumber(raw.paddingPercent, {
      fallback: defaults.paddingPercent,
      minimum: 0,
      maximum: 3,
      label: 'Metin iç boşluğu',
      repairs,
    }),
  }
}

function parseWatermarkLayer(raw: Record<string, unknown>, repairs: string[]): WatermarkLayer {
  const defaults = createDefaultWatermarkLayer()

  return {
    id: readLayerId(raw.id, defaults.id),
    type: 'watermark',
    role: 'watermark',
    mode: readOption(
      raw.mode,
      ['single', 'repeated'] as const,
      defaults.mode,
      'Filigran modu',
      repairs,
    ),
    value: readString(raw.value, defaults.value, MAX_TEXT_LENGTH, 'Filigran içeriği', repairs),
    xPercent: readNumber(raw.xPercent, {
      fallback: defaults.xPercent,
      minimum: 0,
      maximum: 100,
      label: 'Filigran yatay konumu',
      repairs,
    }),
    yPercent: readNumber(raw.yPercent, {
      fallback: defaults.yPercent,
      minimum: 0,
      maximum: 100,
      label: 'Filigran dikey konumu',
      repairs,
    }),
    fontSizePercent: readNumber(raw.fontSizePercent, {
      fallback: defaults.fontSizePercent,
      minimum: 1,
      maximum: 10,
      label: 'Filigran boyutu',
      repairs,
    }),
    fontFamily: 'Inter Variable',
    fontWeight: readOption(
      raw.fontWeight,
      [400, 600, 700] as const,
      defaults.fontWeight,
      'Filigran kalınlığı',
      repairs,
    ),
    color: readColor(raw.color, defaults.color, 'Filigran rengi', repairs),
    opacity: readNumber(raw.opacity, {
      fallback: defaults.opacity,
      minimum: 0.03,
      maximum: 0.8,
      label: 'Filigran şeffaflığı',
      repairs,
    }),
    rotation: readNumber(raw.rotation, {
      fallback: defaults.rotation,
      minimum: -75,
      maximum: 75,
      label: 'Filigran dönüşü',
      repairs,
    }),
    gapXPercent: readNumber(raw.gapXPercent, {
      fallback: defaults.gapXPercent,
      minimum: 10,
      maximum: 60,
      label: 'Filigran yatay aralığı',
      repairs,
    }),
    gapYPercent: readNumber(raw.gapYPercent, {
      fallback: defaults.gapYPercent,
      minimum: 8,
      maximum: 50,
      label: 'Filigran dikey aralığı',
      repairs,
    }),
  }
}

function parseLayers(rawLayers: unknown[], repairs: string[]): TemplateLayer[] {
  const layers: TemplateLayer[] = []
  const usedRoles = new Set<string>()

  for (const rawLayer of rawLayers) {
    if (!isRecord(rawLayer)) {
      repairs.push('Tanınmayan bir katman kaydı atlandı.')
      continue
    }

    const role = rawLayer.role
    if (typeof role !== 'string' || !['logo', 'text', 'watermark'].includes(role)) {
      repairs.push('Tanınmayan bir katman kaydı atlandı.')
      continue
    }

    if (usedRoles.has(role)) {
      repairs.push('Aynı türden ikinci bir katman atlandı.')
      continue
    }
    usedRoles.add(role)

    if (role === 'logo') {
      layers.push(parseLogoLayer(rawLayer, repairs))
    } else if (role === 'text') {
      layers.push(parseTextLayer(rawLayer, repairs))
    } else {
      layers.push(parseWatermarkLayer(rawLayer, repairs))
    }
  }

  return layers
}

function parseCanvas(raw: unknown, repairs: string[]): TemplateCanvas {
  if (!isRecord(raw) || raw.mode !== 'original') {
    repairs.push('Tuval ayarı tanınmadı, orijinal çözünürlük kullanıldı.')
  }
  return { mode: 'original' }
}

function parseOutput(raw: unknown, repairs: string[]): TemplateOutput {
  const source = isRecord(raw) ? raw : {}
  if (!isRecord(raw)) {
    repairs.push('Çıktı ayarı okunamadı, varsayılan değerler kullanıldı.')
  }

  return {
    format: readOption(
      source.format,
      ['jpeg', 'png'] as const satisfies readonly OutputFormat[],
      'jpeg',
      'Çıktı biçimi',
      repairs,
    ),
    quality: readNumber(source.quality, {
      fallback: 0.9,
      minimum: 0.5,
      maximum: 1,
      label: 'Çıktı kalitesi',
      repairs,
    }),
  }
}

/**
 * Bilinmeyen bir değeri sürüm kontrolünden geçirir ve güvenli bir
 * `VisualRecipe` üretir. Onarılabilen sapmalar `repairs` içinde raporlanır;
 * onarılamayan durumlar hata kodu ile geri döner.
 */
export function parseVisualRecipe(input: unknown): RecipeParseResult {
  if (!isRecord(input)) {
    return fail('malformed', 'Şablon verisi okunamadı; kayıt bozulmuş görünüyor.')
  }

  const version = input.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return fail(
      'missing-version',
      'Şablon sürüm bilgisi taşımıyor; bu kayıt güvenle açılamıyor.',
    )
  }

  if (version > CURRENT_RECIPE_SCHEMA_VERSION) {
    return fail(
      'newer-version',
      `Bu şablon daha yeni bir B Photo sürümüyle kaydedilmiş (sürüm ${version}, desteklenen en yüksek sürüm ${CURRENT_RECIPE_SCHEMA_VERSION}). Uygulamayı güncelleyin.`,
    )
  }

  if (version < MINIMUM_SUPPORTED_RECIPE_SCHEMA_VERSION) {
    return fail(
      'unsupported-version',
      `Şablon sürümü ${version} artık desteklenmiyor; şablonu yeniden oluşturmanız gerekiyor.`,
    )
  }

  if (!Array.isArray(input.layers)) {
    return fail('malformed', 'Şablonun katman listesi okunamadı; kayıt bozulmuş görünüyor.')
  }

  const repairs: string[] = []
  const layers = parseLayers(input.layers, repairs)

  if (layers.length === 0) {
    return fail('no-usable-layers', 'Şablonda kullanılabilir katman bulunamadı.')
  }

  return {
    ok: true,
    recipe: {
      schemaVersion: CURRENT_RECIPE_SCHEMA_VERSION,
      canvas: parseCanvas(input.canvas, repairs),
      layers,
      output: parseOutput(input.output, repairs),
    },
    repairs,
  }
}

export function parseTemplateVariables(input: unknown): TemplateVariables {
  const source = isRecord(input) ? input : {}
  const ignored: string[] = []

  return {
    firma_adi: readString(source.firma_adi, '', MAX_VARIABLE_LENGTH, 'Firma adı', ignored).trim(),
    telefon: readString(source.telefon, '', MAX_VARIABLE_LENGTH, 'Telefon', ignored).trim(),
  }
}

/**
 * Çoğaltılan şablona, listede karışmayacak benzersiz bir ad üretir. Zaten
 * kopya olan bir addan çoğaltıldığında "(kopya) (kopya)" zinciri oluşmaz.
 */
export function createDuplicateName(
  baseName: string,
  takenNames: readonly string[],
): string {
  const taken = new Set(takenNames.map((name) => name.trim().toLocaleLowerCase('tr')))
  const root = baseName.replace(/\s*\(kopya(?:\s+\d+)?\)\s*$/i, '').trim() || baseName.trim()

  let candidate = ''
  for (let index = 1; index <= 500; index += 1) {
    const suffix = index === 1 ? ' (kopya)' : ` (kopya ${index})`
    candidate = `${root.slice(0, MAX_NAME_LENGTH - suffix.length).trim()}${suffix}`
    if (!taken.has(candidate.toLocaleLowerCase('tr'))) {
      return candidate
    }
  }

  // Ad benzersizliği yalnız okunabilirlik içindir; kayıt kimliği ayrıdır.
  return candidate
}

export function parseTemplateName(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }

  const name = stripControlCharacters(input).trim()
  if (!name) {
    return null
  }
  return name.slice(0, MAX_NAME_LENGTH)
}
