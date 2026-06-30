import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).send('Missing id')
  try {
    const img = await redis.get(`wiki:img:${id}`)
    if (!img) return res.status(404).send('Not found')
    const buf = Buffer.from(img.data, 'base64')
    res.setHeader('Content-Type', img.mimeType || 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(buf)
  } catch (err) {
    res.status(500).send(String(err))
  }
}
