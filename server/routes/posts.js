import { Router }   from 'express'
import Post          from '../models/Post.js'
import { requireAuth } from '../middleware/auth.js'
import { deleteObject } from '../utils/s3.js'

import { requireRole } from '../middleware/auth.js'

const router = Router()

// ── ADMIN: purge ALL feed posts + S3 images ───────────────────────────────────
router.delete('/purge-all', [requireAuth, requireRole('admin')], async (req, res) => {
  try {
    const posts = await Post.find({}).select('s3Key')
    const keys  = posts.map(p => p.s3Key).filter(Boolean)
    await Promise.all(keys.map(k => deleteObject(k).catch(() => {})))
    const { deletedCount } = await Post.deleteMany({})
    res.json({ message: `Deleted ${deletedCount} posts and ${keys.length} S3 objects.` })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── FEED — all posts, newest first ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { user, limit = 30, skip = 0 } = req.query
    const filter = {}
    if (user) filter.author = user

    const posts = await Post.find(filter)
      .populate('author', 'name profilePhoto role department')
      .populate('comments.user', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))

    res.json({ posts })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── CREATE POST ───────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.status !== 'approved') {
      return res.status(403).json({ error: 'Your account must be approved to post.' })
    }
    const { imageUrl, s3Key, caption } = req.body
    if (!imageUrl) return res.status(400).json({ error: 'Image is required.' })
    const post = await Post.create({ imageUrl, s3Key, caption, author: req.user._id })
    await post.populate('author', 'name profilePhoto role department')
    res.status(201).json({ post })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE POST ───────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Post not found.' })
    const isOwner = post.author.toString() === req.user._id.toString()
    const isAdmin = ['admin','core'].includes(req.user.role)
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not allowed.' })
    if (post.s3Key) await deleteObject(post.s3Key)
    await post.deleteOne()
    res.json({ message: 'Post deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── LIKE / UNLIKE ─────────────────────────────────────────────────────────────
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Not found.' })
    const uid = req.user._id.toString()
    const liked = post.likes.map(l => l.toString()).includes(uid)
    if (liked) post.likes = post.likes.filter(l => l.toString() !== uid)
    else        post.likes.push(req.user._id)
    await post.save()
    res.json({ likes: post.likes.length, liked: !liked })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── ADD COMMENT ───────────────────────────────────────────────────────────────
router.post('/:id/comment', requireAuth, async (req, res) => {
  try {
    const { text } = req.body
    if (!text?.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' })
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Not found.' })
    post.comments.push({ user: req.user._id, text: text.trim() })
    await post.save()
    await post.populate('comments.user', 'name profilePhoto')
    res.json({ comment: post.comments[post.comments.length - 1] })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE COMMENT ────────────────────────────────────────────────────────────
router.delete('/:id/comment/:commentId', requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Not found.' })
    const comment = post.comments.id(req.params.commentId)
    if (!comment) return res.status(404).json({ error: 'Comment not found.' })
    const isOwner = comment.user.toString() === req.user._id.toString()
    const isAdmin = ['admin','core'].includes(req.user.role)
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not allowed.' })
    comment.deleteOne()
    await post.save()
    res.json({ message: 'Comment deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
