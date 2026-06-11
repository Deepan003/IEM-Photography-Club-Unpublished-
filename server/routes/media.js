/**
 * Media proxy — streams S3 objects through the server.
 * No S3 public access or CORS config needed on the bucket.
 * Access photos via: /api/media/gallery/photo.jpg
 *
 * The S3 client is created inside the handler (lazy) so that
 * dotenv has already loaded the credentials before first use.
 */
import { Router }           from 'express'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const router = Router()

function getS3() {
  return new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
}

// GET /api/media/:key  (key can include slashes, e.g. gallery/abc.jpg)
router.get('/:key(*)', async (req, res) => {
  const key = req.params.key

  if (!key) return res.status(400).json({ error: 'No key provided.' })

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key:    key,
    })

    const { Body, ContentType, ContentLength } = await getS3().send(command)

    res.setHeader('Content-Type',  ContentType  || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')  // browser caches 1 day
    if (ContentLength) res.setHeader('Content-Length', ContentLength)

    // Stream the object body directly to the client
    Body.pipe(res)

  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'File not found.' })
    }
    console.error('[media]', err.message)
    res.status(500).json({ error: 'Could not fetch media.' })
  }
})

export default router
