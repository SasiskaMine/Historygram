import { randomBytes } from 'node:crypto';
import { deleteCookie, getCookie } from 'hono/cookie';
import db from './db.js';
export const SESSION_COOKIE_NAME = 'session';
export function getUserStats(userId, account) {
    const row = db
        .prepare(`SELECT
         COALESCE(SUM(likes), 0) AS totalLikes,
         COUNT(*) AS storiesCount
       FROM stories
       WHERE user_id = ? OR LOWER(account) = LOWER(?)`)
        .get(userId, account);
    return {
        totalLikes: Number(row?.totalLikes ?? 0),
        storiesCount: Number(row?.storiesCount ?? 0),
    };
}
export function toPublicUser(user) {
    const stats = getUserStats(user.id, user.account);
    return {
        id: user.id,
        account: user.account,
        email: user.email,
        avatar: user.avatar ?? null,
        totalLikes: stats.totalLikes,
        storiesCount: stats.storiesCount,
    };
}
export function getSessionUser(c) {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (!sessionId) {
        return null;
    }
    const row = db
        .prepare(`SELECT u.id, u.account, u.email, u.avatar, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`)
        .get(sessionId);
    if (!row || row.expires_at <= Date.now()) {
        db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
        deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
        return null;
    }
    return {
        id: row.id,
        account: row.account,
        email: row.email,
        avatar: row.avatar ?? null,
    };
}
export function createSessionId() {
    return randomBytes(32).toString('hex');
}
