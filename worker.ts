// Cloudflare Worker entry for ax (AueXUE / Valaxy).
// Replaces the Cloudflare Pages deployment: the Pages Functions in
// functions/ are called directly from this Worker, and the Valaxy static
// build in dist/ is served via the ASSETS binding. D1 + R2 bindings are
// the same as the Pages project used (DB, BUCKET).
import type { CloudflareEnv } from './types/env'
import { onRequest as onRequestPosts } from './functions/api/posts/[[path]]'
import { onRequest as onRequestAbout } from './functions/api/about/[[path]]'
import { onRequest as onRequestAdmin } from './functions/api/admin/[[path]]'
import { onRequest as onRequestAlbumWebdav } from './functions/api/album-webdav/[[path]]'
import { onRequest as onRequestGallery } from './functions/api/gallery/[[path]]'
import { onRequest as onRequestHtmlFiles } from './functions/api/html-files/[[path]]'
import { onRequest as onRequestLinks } from './functions/api/links/[[path]]'
import { onRequest as onRequestNotice } from './functions/api/notice/[[path]]'
import { onRequest as onRequestAtom } from './functions/atom.xml'
import { onRequest as onRequestHtml } from './functions/[[path]]'

interface WorkerEnv extends CloudflareEnv {
  ASSETS: Fetcher
}

// SPA client-side routes (mirrors dist/_redirects): fall back to index.html
const SPA_PREFIXES = ['/files/', '/posts/', '/categories/', '/tags/', '/archives/', '/admin/']

function segmentsAfter(pathname: string, prefix: string): string[] {
  const rest = pathname.slice(prefix.length)
  return rest.split('/').filter(Boolean)
}

function isSpaRoute(pathname: string): boolean {
  return SPA_PREFIXES.some(prefix => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix))
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // 1. API routes (Pages _routes.json sent /api/* to Functions)
    if (pathname === '/api/posts' || pathname.startsWith('/api/posts/'))
      return onRequestPosts({ request, env, params: { path: segmentsAfter(pathname, '/api/posts') } })
    if (pathname === '/api/about' || pathname.startsWith('/api/about/'))
      return onRequestAbout({ request, env })
    if (pathname === '/api/admin' || pathname.startsWith('/api/admin/'))
      return onRequestAdmin({ request, env, params: { path: segmentsAfter(pathname, '/api/admin') } })
    if (pathname === '/api/album-webdav' || pathname.startsWith('/api/album-webdav/'))
      return onRequestAlbumWebdav({ request, env })
    if (pathname === '/api/gallery' || pathname.startsWith('/api/gallery/'))
      return onRequestGallery({ request, env, params: { path: segmentsAfter(pathname, '/api/gallery') } })
    if (pathname === '/api/html-files' || pathname.startsWith('/api/html-files/'))
      return onRequestHtmlFiles({ request, env, params: { path: segmentsAfter(pathname, '/api/html-files') } })
    if (pathname === '/api/links' || pathname.startsWith('/api/links/'))
      return onRequestLinks({ request, env })
    if (pathname === '/api/notice' || pathname.startsWith('/api/notice/'))
      return onRequestNotice({ request, env })

    // 2. Atom feed
    if (pathname === '/atom.xml')
      return onRequestAtom({ request, env })

    // 3. Static assets from dist/ (including .html files baked by the build).
    // Only a 200 counts as a hit: ASSETS answers a missing path with a
    // redirect to / instead of a 404, which would break SPA routes.
    const asset = await env.ASSETS.fetch(request)
    if (asset.status === 200)
      return asset

    // 4. Custom HTML files stored in R2/D1 (Pages [[path]].ts catch-all for /*.html)
    if (pathname.endsWith('.html'))
      return onRequestHtml({ request, env })

    // 5. SPA fallback for client-side routes. Fetch "/" (not "/index.html":
    // ASSETS redirects /index.html to / with a 307, which would break the
    // fallback). "/" serves the SPA shell with a 200.
    if (isSpaRoute(pathname)) {
      const indexRequest = new Request(new URL('/', url), request)
      return env.ASSETS.fetch(indexRequest)
    }

    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  },
}
