import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads')
const MAX_FILE_BYTES = 5 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function saveUploadedImage(file: File): Promise<string> {
  if (file.size <= 0) {
    throw new Error('Файл изображения пустой')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Размер изображения не должен превышать 5 МБ')
  }

  const ext = MIME_TO_EXT[file.type]
  if (!ext) {
    throw new Error('Поддерживаются только JPG, PNG, WebP и GIF')
  }

  await mkdir(UPLOADS_DIR, { recursive: true })
  const filename = `${randomBytes(16).toString('hex')}.${ext}`
  const targetPath = path.join(UPLOADS_DIR, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(targetPath, buffer)

  return `/uploads/${filename}`
}

export async function readUploadedImage(
  filename: string
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return null
  }

  const ext = path.extname(filename).toLowerCase()
  const contentType = EXT_TO_MIME[ext]
  if (!contentType) {
    return null
  }

  const targetPath = path.join(UPLOADS_DIR, filename)
  try {
    const data = await readFile(targetPath)
    return { data, contentType }
  } catch {
    return null
  }
}

export async function deleteUploadedImage(imgPath: string | null | undefined): Promise<void> {
  if (!imgPath || !imgPath.startsWith('/uploads/')) return
  const filename = imgPath.slice('/uploads/'.length)
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return
  const targetPath = path.join(UPLOADS_DIR, filename)
  await unlink(targetPath).catch(() => {})
}
