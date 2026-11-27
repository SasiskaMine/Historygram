import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import Stories from './routes/stories.js';
import Auth from './routes/auth.js';
import { readUploadedImage } from './modules/uploads.js';
const app = new Hono();
app.route('/stories', Stories);
app.route('/auth', Auth);
app.get('/uploads/:filename', async (c) => {
    const filename = c.req.param('filename');
    const file = await readUploadedImage(filename);
    if (!file) {
        return c.notFound();
    }
    return new Response(new Uint8Array(file.data), {
        headers: {
            'Content-Type': file.contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
});
serve({
    fetch: app.fetch,
    port: 3001
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
