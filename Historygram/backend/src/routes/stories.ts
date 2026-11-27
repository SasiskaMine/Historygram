import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import db from '../modules/db.js'
import type { StoryRow } from '../modules/db.js'
import { getSessionUser } from '../modules/session.js'
import { deleteUploadedImage, saveUploadedImage } from '../modules/uploads.js'

const app = new Hono()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const PRESET_COLLECTIONS = ['Сообщество', 'Настроение', 'Жизнь', 'Путешествия', 'Идеи']

app.use(
  '*',
  cors({
    origin: (origin) => origin || FRONTEND_URL,
    credentials: true,
  })
)

interface StoryWithAuthorRow extends StoryRow {
  author_avatar: string | null
  liked_by_me: number
}

function toStoryDto(row: StoryWithAuthorRow) {
  return {
    id: row.id,
    account: row.account,
    title: row.title,
    text: row.text,
    collection: row.collection,
    likes: row.likes,
    img: row.img ?? undefined,
    authorAvatar: row.author_avatar ?? null,
    likedByMe: Boolean(row.liked_by_me),
    createdAt: row.created_at,
  }
}

async function parseStoryBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const parsed = await c.req.json()
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return await c.req.parseBody()
}

function getString(body: Record<string, unknown>, key: string): string {
  const val = body[key]
  return typeof val === 'string' ? val.trim() : ''
}

app.get('/collections', (c) => {
  const rows = db
    .prepare(
      `SELECT
         collection AS name,
         COUNT(*) AS count,
         (
           SELECT s2.img
           FROM stories s2
           WHERE s2.collection = stories.collection AND s2.img IS NOT NULL AND s2.img != ''
           ORDER BY s2.created_at DESC, s2.id DESC
           LIMIT 1
         ) AS coverImg
       FROM stories
       GROUP BY collection`
    )
    .all() as Array<{ name: string; count: number; coverImg: string | null }>

  const byName = new Map(rows.map((r) => [r.name, r]))
  const ordered: Array<{ name: string; count: number; coverImg: string | null }> = []

  for (const name of PRESET_COLLECTIONS) {
    const existing = byName.get(name)
    ordered.push({
      name,
      count: Number(existing?.count ?? 0),
      coverImg: existing?.coverImg ?? null,
    })
    byName.delete(name)
  }

  for (const extra of byName.values()) {
    ordered.push({
      name: extra.name,
      count: Number(extra.count),
      coverImg: extra.coverImg ?? null,
    })
  }

  return c.json(ordered)
})

app.get('/', (c) => {
  const currentUser = getSessionUser(c)
  const collection = c.req.query('collection')?.trim()
  const filterByCollection = Boolean(collection && collection !== 'Все')

  const baseSelect = `
    SELECT
      s.id,
      s.user_id,
      s.account,
      s.title,
      s.text,
      s.collection,
      s.likes,
      s.img,
      s.created_at,
      u.avatar AS author_avatar,
      CASE
        WHEN ? IS NOT NULL AND EXISTS (
          SELECT 1 FROM story_likes sl
          WHERE sl.story_id = s.id AND sl.user_id = ?
        ) THEN 1
        ELSE 0
      END AS liked_by_me
    FROM stories s
    LEFT JOIN users u
      ON u.id = s.user_id OR (s.user_id IS NULL AND LOWER(u.account) = LOWER(s.account))
  `

  const viewerId = currentUser?.id ?? null
  const rows = (
    filterByCollection
      ? db
          .prepare(`${baseSelect} WHERE s.collection = ? ORDER BY s.created_at DESC, s.id DESC`)
          .all(viewerId, viewerId, collection!)
      : db
          .prepare(`${baseSelect} ORDER BY s.created_at DESC, s.id DESC`)
          .all(viewerId, viewerId)
  ) as unknown as StoryWithAuthorRow[]

  return c.json(rows.map(toStoryDto))
})

app.post('/', async (c) => {
  const user = getSessionUser(c)
  if (!user) {
    return c.json(
      { status: 'error', message: 'Войдите в аккаунт, чтобы добавить историю' },
      401
    )
  }

  const body = await parseStoryBody(c)
  const title = getString(body, 'title')
  const text = getString(body, 'text')
  const collection = getString(body, 'collection') || 'Сообщество'

  if (!title || !text) {
    return c.json(
      { status: 'error', message: 'Заполните заголовок и текст истории' },
      400
    )
  }

  if (title.length > 80) {
    return c.json(
      { status: 'error', message: 'Заголовок не должен превышать 80 символов' },
      400
    )
  }

  let imgPath: string | null = null
  const imageField = body.image
  const imgUrlField = getString(body, 'img')

  try {
    if (imageField instanceof File && imageField.size > 0) {
      imgPath = await saveUploadedImage(imageField)
    } else if (imgUrlField) {
      imgPath = imgUrlField
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки картинки'
    return c.json({ status: 'error', message }, 400)
  }

  const createdAt = Date.now()
  const result = db
    .prepare(
      `INSERT INTO stories (user_id, account, title, text, collection, likes, img, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(user.id, user.account, title, text, collection, imgPath, createdAt)

  const id = Number(result.lastInsertRowid)

  return c.json(
    {
      status: 'ok',
      story: {
        id,
        account: user.account,
        title,
        text,
        collection,
        likes: 0,
        img: imgPath ?? undefined,
        authorAvatar: user.avatar ?? null,
        likedByMe: false,
        createdAt,
      },
    },
    201
  )
})

app.post('/:id/like', (c) => {
  const user = getSessionUser(c)
  if (!user) {
    return c.json(
      { status: 'error', message: 'Войдите в аккаунт, чтобы поставить лайк' },
      401
    )
  }

  const storyId = Number(c.req.param('id'))
  if (!Number.isInteger(storyId) || storyId <= 0) {
    return c.json({ status: 'error', message: 'Некорректный ID истории' }, 400)
  }

  const story = db
    .prepare('SELECT id, likes FROM stories WHERE id = ?')
    .get(storyId) as { id: number; likes: number } | undefined

  if (!story) {
    return c.json({ status: 'error', message: 'История не найдена' }, 404)
  }

  const existing = db
    .prepare('SELECT 1 FROM story_likes WHERE story_id = ? AND user_id = ?')
    .get(storyId, user.id)

  let likedByMe = false
  if (existing) {
    db.prepare('DELETE FROM story_likes WHERE story_id = ? AND user_id = ?').run(
      storyId,
      user.id
    )
    db.prepare('UPDATE stories SET likes = MAX(0, likes - 1) WHERE id = ?').run(storyId)
    likedByMe = false
  } else {
    db.prepare(
      'INSERT INTO story_likes (story_id, user_id, created_at) VALUES (?, ?, ?)'
    ).run(storyId, user.id, Date.now())
    db.prepare('UPDATE stories SET likes = likes + 1 WHERE id = ?').run(storyId)
    likedByMe = true
  }

  const updated = db
    .prepare('SELECT likes FROM stories WHERE id = ?')
    .get(storyId) as { likes: number }

  return c.json({
    status: 'ok',
    storyId,
    likes: Number(updated.likes),
    likedByMe,
  })
})

app.delete('/:id', async (c) => {
  const user = getSessionUser(c)
  if (!user) {
    return c.json(
      { status: 'error', message: 'Войдите в аккаунт, чтобы удалить историю' },
      401
    )
  }

  const storyId = Number(c.req.param('id'))
  if (!Number.isInteger(storyId) || storyId <= 0) {
    return c.json({ status: 'error', message: 'Некорректный ID истории' }, 400)
  }

  const story = db
    .prepare('SELECT id, user_id, account, img FROM stories WHERE id = ?')
    .get(storyId) as
    | { id: number; user_id: number | null; account: string; img: string | null }
    | undefined

  if (!story) {
    return c.json({ status: 'error', message: 'История не найдена' }, 404)
  }

  const isOwner =
    story.user_id === user.id ||
    (story.user_id === null && story.account.toLowerCase() === user.account.toLowerCase())

  if (!isOwner) {
    return c.json(
      { status: 'error', message: 'Можно удалять только свои истории' },
      403
    )
  }

  db.prepare('DELETE FROM stories WHERE id = ?').run(storyId)

  if (story.img && story.img.startsWith('/uploads/')) {
    const refs = db
      .prepare('SELECT COUNT(*) AS count FROM stories WHERE img = ?')
      .get(story.img) as { count: number }
    if (refs.count === 0) {
      await deleteUploadedImage(story.img)
    }
  }

  return c.json({
    status: 'ok',
    deletedId: storyId,
  })
})

export default app
