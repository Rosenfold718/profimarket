import { authFetch } from '@/lib/fetch'

const CHUNK_SIZE = 3_000_000 // ~3MB of base64 per chunk (safely under Vercel's 4.5MB limit)

/**
 * Upload a file using chunked upload to bypass Vercel's body size limit.
 */
export async function uploadFileChunked(
  orderId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ id: string; name: string; type: string; size: number; createdAt: string; uploadedById: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const sessionId = crypto.randomUUID()
  const totalChunks = Math.ceil(base64.length / CHUNK_SIZE)

  let result: any = null

  for (let i = 0; i < totalChunks; i++) {
    const chunk = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)

    const res = await authFetch('/api/upload-chunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        orderId,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        totalChunks,
        chunkIndex: i,
        chunkData: chunk,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error || 'Ошибка загрузки чанка')
    }

    const data = await res.json()
    onProgress?.(Math.round(((i + 1) / totalChunks) * 100))

    if (data.done) {
      result = data.document
      break
    }
  }

  if (!result) throw new Error('Загрузка не завершена')
  return result
}