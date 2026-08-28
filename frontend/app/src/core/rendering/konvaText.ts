/**
 * Konva'nın `fontStyle` değeri doğrudan Canvas font kısayoluna yazılır.
 *
 * Buraya `bold` yazılırsa 600 ağırlığındaki metin 700 olarak çizilir; kutu
 * genişliği ise 600'e göre ölçüldüğü için dar kalır ve son harf kırpılır.
 * Bu yüzden sayısal ağırlık olduğu gibi aktarılır ve önizleme, tam
 * çözünürlüklü çıktıyla aynı ağırlığı kullanır.
 */
export function toKonvaFontStyle(weight: number): string {
  return String(weight)
}
