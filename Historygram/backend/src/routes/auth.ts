import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import argon2 from 'argon2'
import db from '../modules/db.js'
import type { UserRow } from '../modules/db.js'
import {
  SESSION_COOKIE_NAME,
  createSessionId,
  getSessionUser,
  toPublicUser,
} from '../modules/session.js'
import { saveUploadedImage } from '../modules/uploads.js'

const app = new Hono()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

app.use(
  '/*',
  cors({
    origin: (origin) => origin || FRONTEND_URL,
    credentials: true,
  })
)

function getStringField(body: Record<string, unknown>, key: string): string {
  const val = body[key]
  return typeof val === 'string' ? val.trim() : ''
}

async function parseRequestBody(c: Context): Promise<Record<string, unknown>> {
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

function createSession(c: Context, userId: number): void {
  const sessionId = createSessionId()
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS

  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
  db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(sessionId, userId, expiresAt, now)

  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

app.post('/register', async (c) => {
  const body = await parseRequestBody(c)

  const account = getStringField(body, 'account')
  const email = getStringField(body, 'email').toLowerCase()
  const password = getStringField(body, 'password')

  if (!account || !email || !password) {
    return c.json(
      { status: 'error', message: 'Заполните account, email и password' },
      400
    )
  }

  if (password.length < 8) {
    return c.json(
      { status: 'error', message: 'Пароль должен быть не короче 8 символов' },
      400
    )
  }

  try {
    const password_hash = await argon2.hash(password)

    const stmt = db.prepare(
      'INSERT INTO users (account, email, password_hash) VALUES (?, ?, ?)'
    )
    const result = stmt.run(account, email, password_hash)
    const userId = Number(result.lastInsertRowid)

    db.prepare(
      'UPDATE stories SET user_id = ? WHERE user_id IS NULL AND LOWER(account) = LOWER(?)'
    ).run(userId, account)

    createSession(c, userId)

    return c.json(
      {
        status: 'ok',
        user: toPublicUser({
          id: userId,
          account,
          email,
          avatar: null,
        }),
      },
      201
    )
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint failed')) {
      return c.json(
        { status: 'error', message: 'Такой аккаунт или email уже занят' },
        409
      )
    }

    console.error('Ошибка регистрации:', err)
    return c.json({ status: 'error', message: 'Ошибка сервера' }, 500)
  }
})

app.post('/login', async (c) => {
  const body = await parseRequestBody(c)

  const rawLogin =
    getStringField(body, 'login') ||
    getStringField(body, 'email') ||
    getStringField(body, 'account')
  const password = getStringField(body, 'password')

  if (!rawLogin || !password) {
    return c.json(
      { status: 'error', message: 'Введите логин/email и пароль' },
      400
    )
  }

  const normalizedLogin = rawLogin.toLowerCase()

  const user = db
    .prepare('SELECT * FROM users WHERE account = ? OR email = ?')
    .get(rawLogin, normalizedLogin) as UserRow | undefined

  if (!user) {
    return c.json({ status: 'error', message: 'Неверный логин или пароль' }, 401)
  }

  const isValid = await argon2.verify(user.password_hash, password)

  if (!isValid) {
    return c.json({ status: 'error', message: 'Неверный логин или пароль' }, 401)
  }

  createSession(c, user.id)

  return c.json({
    status: 'ok',
    user: toPublicUser(user),
  })
})

app.get('/me', (c) => {
  const user = getSessionUser(c)
  if (!user) {
    return c.json({ status: 'ok', user: null })
  }

  return c.json({
    status: 'ok',
    user: toPublicUser(user),
  })
})

app.post('/avatar', async (c) => {
  const user = getSessionUser(c)
  if (!user) {
    return c.json({ status: 'error', message: 'Необходима авторизация' }, 401)
  }

  const body = await parseRequestBody(c)
  const uploaded = body.avatar

  let avatarPath: string | null = user.avatar
  try {
    if (uploaded instanceof File) {
      avatarPath = await saveUploadedImage(uploaded)
    } else if (typeof uploaded === 'string') {
      const trimmed = uploaded.trim()
      avatarPath = trimmed || null
    } else {
      return c.json({ status: 'error', message: 'Выберите файл или укажите ссылку на аватар' }, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки аватара'
    return c.json({ status: 'error', message }, 400)
  }

  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarPath, user.id)

  return c.json({
    status: 'ok',
    user: toPublicUser({
      ...user,
      avatar: avatarPath,
    }),
  })
})

app.post('/logout', (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME)
  if (sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.json({ status: 'ok' })
})

export default app