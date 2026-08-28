import { openDB, type DBSchema } from 'idb'

import type { TemplateVariables, VisualRecipe } from '@/types/template'

import {
  createDuplicateName,
  parseTemplateName,
  parseTemplateVariables,
  parseVisualRecipe,
  type TemplateParseErrorCode,
} from './templateSchema'

export interface SavedLogo {
  blob: Blob
  name: string
  type: string
  lastModified: number
}

export interface SavedTemplate {
  id: string
  name: string
  recipe: VisualRecipe
  variables: TemplateVariables
  logo: SavedLogo | null
  createdAt: string
  updatedAt: string
}

/** Şablon listesi yalnız kimlik alanlarını taşır; reçete ancak açılırken doğrulanır. */
export interface SavedTemplateSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type TemplateLoadErrorCode = TemplateParseErrorCode | 'not-found' | 'unreadable'

export type TemplateLoadResult =
  | { status: 'ok'; template: SavedTemplate; repairs: string[] }
  | { status: 'error'; code: TemplateLoadErrorCode; message: string }

interface TemplateDatabase extends DBSchema {
  templates: {
    key: string
    value: SavedTemplate
    indexes: {
      'by-updated-at': string
    }
  }
}

// Legacy database name is retained so the B Photo rename does not hide saved templates.
const databasePromise = openDB<TemplateDatabase>('ilan-matik-local', 1, {
  upgrade(database) {
    const store = database.createObjectStore('templates', { keyPath: 'id' })
    store.createIndex('by-updated-at', 'updatedAt')
  },
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return null
  }
  return value
}

function parseSavedLogo(value: unknown): SavedLogo | null {
  if (!isRecord(value) || !(value.blob instanceof Blob)) {
    return null
  }

  return {
    blob: value.blob,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'logo',
    type: typeof value.type === 'string' ? value.type : value.blob.type,
    lastModified:
      typeof value.lastModified === 'number' && Number.isFinite(value.lastModified)
        ? value.lastModified
        : 0,
  }
}

/** Listede gösterilebilmesi için kaydın yalnız kimlik alanları geçerli olmalıdır. */
function parseSummary(value: unknown): SavedTemplateSummary | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) {
    return null
  }

  const name = parseTemplateName(value.name)
  if (!name) {
    return null
  }

  const updatedAt = parseTimestamp(value.updatedAt) ?? new Date(0).toISOString()
  return {
    id: value.id,
    name,
    createdAt: parseTimestamp(value.createdAt) ?? updatedAt,
    updatedAt,
  }
}

export async function listSavedTemplates(): Promise<SavedTemplateSummary[]> {
  const database = await databasePromise
  const records: unknown[] = await database.getAllFromIndex('templates', 'by-updated-at')
  return records
    .reverse()
    .map((record) => parseSummary(record))
    .filter((summary): summary is SavedTemplateSummary => summary !== null)
}

/**
 * Kaydı okur, sürüm ve alan doğrulamasından geçirir. Uygulamaya yalnız
 * doğrulanmış bir şablon verilir; onarılan sapmalar `repairs` ile bildirilir.
 */
export async function readSavedTemplate(id: string): Promise<TemplateLoadResult> {
  const database = await databasePromise

  let record: unknown
  try {
    record = await database.get('templates', id)
  } catch {
    return {
      status: 'error',
      code: 'unreadable',
      message: 'Şablon tarayıcı deposundan okunamadı.',
    }
  }

  if (record === undefined) {
    return { status: 'error', code: 'not-found', message: 'Şablon bulunamadı.' }
  }

  const summary = parseSummary(record)
  if (!summary || !isRecord(record)) {
    return {
      status: 'error',
      code: 'missing-identity',
      message: 'Şablon kaydının kimlik bilgileri eksik; bu kayıt açılamıyor.',
    }
  }

  const parsedRecipe = parseVisualRecipe(record.recipe)
  if (!parsedRecipe.ok) {
    return { status: 'error', code: parsedRecipe.code, message: parsedRecipe.message }
  }

  const repairs = [...parsedRecipe.repairs]
  const hasLogoLayer = parsedRecipe.recipe.layers.some((layer) => layer.role === 'logo')
  const logo = parseSavedLogo(isRecord(record.logo) ? record.logo : null)
  if (hasLogoLayer && !logo) {
    repairs.push('Şablonun logo dosyası okunamadı; logoyu yeniden yükleyin.')
  }

  return {
    status: 'ok',
    repairs,
    template: {
      ...summary,
      recipe: parsedRecipe.recipe,
      variables: parseTemplateVariables(record.variables),
      logo,
    },
  }
}

/**
 * Kayıtlı bir şablonun bağımsız bir kopyasını oluşturur. Kopya, kaynağın
 * doğrulanmış hâlinden üretilir; bozuk bir kayıt çoğaltılamaz. Logo verisi
 * değişmez `Blob` olduğu için iki kayıt arasında paylaşılabilir.
 */
export async function duplicateSavedTemplate(
  id: string,
  now = new Date().toISOString(),
): Promise<TemplateLoadResult> {
  const source = await readSavedTemplate(id)
  if (source.status === 'error') {
    return source
  }

  const existing = await listSavedTemplates()
  const duplicate: SavedTemplate = {
    ...source.template,
    id: createTemplateId(),
    name: createDuplicateName(
      source.template.name,
      existing.map((summary) => summary.name),
    ),
    createdAt: now,
    updatedAt: now,
  }

  await putSavedTemplate(duplicate)
  return { status: 'ok', template: duplicate, repairs: source.repairs }
}

export async function putSavedTemplate(template: SavedTemplate): Promise<void> {
  const database = await databasePromise
  await database.put('templates', template)
}

export async function deleteSavedTemplate(id: string): Promise<void> {
  const database = await databasePromise
  await database.delete('templates', id)
}

export function createSavedLogo(file: File): SavedLogo {
  return {
    blob: file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
  }
}

export function restoreSavedLogo(savedLogo: SavedLogo): File {
  return new File([savedLogo.blob], savedLogo.name, {
    type: savedLogo.type,
    lastModified: savedLogo.lastModified,
  })
}

export function createTemplateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `template-${Date.now()}`
}
