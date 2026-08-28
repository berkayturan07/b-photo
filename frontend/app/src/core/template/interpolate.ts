import type { TemplateVariables } from '@/types/template'

const DYNAMIC_FIELD_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export function resolveTemplateText(
  value: string,
  variables: TemplateVariables,
): string {
  return value.replace(DYNAMIC_FIELD_PATTERN, (match, key: string) => {
    if (key in variables) {
      return variables[key as keyof TemplateVariables]
    }
    return match
  })
}

