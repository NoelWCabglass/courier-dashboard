import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

function json(res, data, status = 200) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(data)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const { action, id } = req.query

      if (action === 'getPages') {
        const index = await redis.get('wiki:index') || []
        return json(res, { ok: true, pages: index })
      }

      if (action === 'getPage' && id) {
        const content = await redis.get(`wiki:page:${id}`) || ''
        return json(res, { ok: true, content })
      }

      return json(res, { ok: false, error: 'Unknown action' }, 400)
    }

    if (req.method === 'POST') {
      const body = req.body
      const { action } = body

      if (action === 'savePage') {
        const { id, title, content, parentId, locked, viewRoles, editRoles, updatedBy } = body
        const pageId = id || `page_${Date.now()}`
        let index = await redis.get('wiki:index') || []

        const existing = index.find(p => p.id === pageId)
        const meta = {
          id: pageId,
          title: title || 'Untitled',
          parentId: parentId || null,
          locked: locked || false,
          viewRoles: viewRoles || [],
          editRoles: editRoles || ['admin'],
          updatedAt: new Date().toISOString(),
          updatedBy: updatedBy || '',
          order: existing?.order ?? index.length,
        }

        if (existing) {
          index = index.map(p => p.id === pageId ? meta : p)
        } else {
          index.push(meta)
        }

        await redis.set('wiki:index', index)
        if (content !== undefined) {
          await redis.set(`wiki:page:${pageId}`, content)
        }
        return json(res, { ok: true, page: meta })
      }

      if (action === 'deletePage') {
        const { id } = body
        let index = await redis.get('wiki:index') || []
        const page = index.find(p => p.id === id)
        if (page?.locked) return json(res, { ok: false, error: 'Page is locked' }, 403)
        index = index.filter(p => p.id !== id && p.parentId !== id)
        await redis.set('wiki:index', index)
        await redis.del(`wiki:page:${id}`)
        return json(res, { ok: true })
      }

      if (action === 'uploadImage') {
        const { fileName, fileData, mimeType } = body
        if (!fileName || !fileData) return json(res, { ok: false, error: 'Missing file data' }, 400)
        // Store image as base64 in Redis with a unique key
        const imageId = `img_${Date.now()}`
        await redis.set(`wiki:img:${imageId}`, { fileName, mimeType, data: fileData })
        const url = `/api/wiki-image?id=${imageId}`
        return json(res, { ok: true, url })
      }

      return json(res, { ok: false, error: 'Unknown action' }, 400)
    }

    return json(res, { ok: false, error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Wiki API error:', err)
    return json(res, { ok: false, error: String(err) }, 500)
  }
}
