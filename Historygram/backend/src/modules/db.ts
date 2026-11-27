import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('./database.db')

export interface UserRow {
  id: number
  account: string
  email: string
  password_hash: string
  avatar: string | null
}

export interface SessionRow {
  id: string
  user_id: number
  expires_at: number
  created_at: number
}

export interface StoryRow {
  id: number
  user_id: number | null
  account: string
  title: string
  text: string
  collection: string
  likes: number
  img: string | null
  created_at: number
}

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    account TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    collection TEXT NOT NULL DEFAULT 'Общее',
    likes INTEGER NOT NULL DEFAULT 0,
    img TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS story_likes (
    story_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (story_id, user_id),
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// Migrate existing users table if avatar column was not present
const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
if (!userColumns.some((col) => col.name === 'avatar')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar TEXT')
}

// Seed initial stories once if table is empty
const storyCount = db.prepare('SELECT COUNT(*) AS count FROM stories').get() as { count: number }
if (storyCount.count === 0) {
  const jonUser = db
    .prepare('SELECT id FROM users WHERE LOWER(account) = LOWER(?)')
    .get('jon_kilka') as { id: number } | undefined

  const now = Date.now()
  const insertStory = db.prepare(`
    INSERT INTO stories (user_id, account, title, text, collection, likes, img, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertStory.run(
    jonUser?.id ?? null,
    'jon_kilka',
    'Прогресс сообщества',
    'Учитывая ключевые сценарии поведения, существующая теория позволяет оценить значение прогресса профессионального сообщества. Но выбранный нами инновационный путь в значительной степени обусловливает важность новых предложений.',
    'Сообщество',
    0,
    '/jpg.png',
    now - 60_000
  )

  insertStory.run(
    null,
    'SasiskaMine',
    'Милый тюленчик',
    'Поднимите настроение себе настроение',
    'Настроение',
    0,
    '/jpg2.png',
    now
  )
}

export default db

