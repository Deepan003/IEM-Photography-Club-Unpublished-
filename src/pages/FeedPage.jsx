import { useState, useEffect, useRef, useCallback } from 'react'
import { Link }              from 'react-router-dom'
import PageLayout            from '../components/PageLayout.jsx'
import { SkeletonFeedPost } from '../components/Skeleton.jsx'
import GlassButton           from '../components/GlassButton.jsx'
import ImageUpload           from '../components/ImageUpload.jsx'
import ConfirmDialog         from '../components/ConfirmDialog.jsx'
import { postsApi, uploadFileToS3 } from '../api/api.js'
import { useTheme, useAuth } from '../App.jsx'
import { useData }           from '../hooks/useData.js'

// ── Time ago ──────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60)        return `${s}s`
  if (s < 3600)      return `${Math.floor(s/60)}m`
  if (s < 86400)     return `${Math.floor(s/3600)}h`
  if (s < 2592000)   return `${Math.floor(s/86400)}d`
  return new Date(date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })
}

// ── Heart icon ────────────────────────────────────────────────────────────────
const Heart = ({ filled }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth={filled?0:2}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
const Comment = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

// ── Single post card ──────────────────────────────────────────────────────────
function PostCard({ post, currentUser, onDeleted, L }) {
  const [liked,     setLiked]     = useState(post.likes?.includes(currentUser?._id))
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments,  setComments]  = useState(post.comments || [])
  const [newComment,setNewComment]= useState('')
  const [posting,   setPosting]   = useState(false)
  const [lightbox,  setLightbox]  = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const isOwner = currentUser?._id === (post.author?._id || post.author)
  const isAdmin = currentUser && ['admin','core'].includes(currentUser.role)

  const toggleLike = async () => {
    if (!currentUser) { document.dispatchEvent(new CustomEvent('open-auth')); return }
    setLiked(l => !l)
    setLikeCount(c => liked ? c-1 : c+1)
    try { await postsApi.like(post._id) } catch (e) { setLiked(l => !l); setLikeCount(c => liked ? c+1 : c-1) }
  }

  const addComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUser) return
    if (!currentUser) { document.dispatchEvent(new CustomEvent('open-auth')); return }
    setPosting(true)
    try {
      const { comment } = await postsApi.comment(post._id, newComment)
      setComments(c => [...c, comment])
      setNewComment('')
    } catch { /* comment failed silently */ }
    finally { setPosting(false) }
  }

  const removeComment = async (cid) => {
    await postsApi.deleteComment(post._id, cid).catch(() => {})
    setComments(c => c.filter(x => x._id !== cid))
  }

  const deletePost = async () => {
    await postsApi.delete(post._id).catch(() => {})
    onDeleted?.(post._id)
  }

  const author = post.author || {}
  const initials = (author.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  return (
    <div className={`auth-glass rounded-3xl overflow-hidden border ${L?'border-black/8':'border-white/8'} mb-4`}>
      {/* Post header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Link to="/members">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/15 bg-gray-800 flex items-center justify-center">
              {author.profilePhoto
                ? <img src={author.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="font-clash text-xs font-bold text-white">{initials}</span>}
            </div>
          </Link>
          <div>
            <p className={`font-inter text-sm font-semibold leading-tight ${L?'text-gray-900':'text-white'}`}>{author.name}</p>
            <p className={`font-inter text-[10px] ${L?'text-gray-500':'text-gray-500'}`}>{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        {(isOwner || isAdmin) && (
          <button onClick={() => setDelConfirm(true)} className="text-gray-600 hover:text-red-400 transition-colors text-sm px-2">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        )}
      </div>

      {/* Image */}
      <div className="relative cursor-pointer" onClick={() => setLightbox(true)}>
        <img src={post.imageUrl} alt="" className="w-full object-cover max-h-[540px]" style={{ aspectRatio:'1/1', objectFit:'cover' }} />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-4">
          <button onClick={toggleLike}
            className={`transition-all duration-200 hover:scale-110 ${liked ? 'text-red-500' : L?'text-gray-600 hover:text-gray-900':'text-gray-400 hover:text-white'}`}>
            <Heart filled={liked} />
          </button>
          <button onClick={() => setShowComments(s => !s)}
            className={`transition-colors ${L?'text-gray-600 hover:text-gray-900':'text-gray-400 hover:text-white'}`}>
            <Comment />
          </button>
        </div>

        {likeCount > 0 && (
          <p className={`font-inter text-sm font-semibold ${L?'text-gray-900':'text-white'}`}>
            {likeCount} {likeCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {/* Caption */}
        {post.caption && (
          <p className={`font-inter text-sm ${L?'text-gray-800':'text-gray-200'} leading-relaxed`}>
            <span className="font-semibold">{author.name?.split(' ')[0]} </span>
            {post.caption}
          </p>
        )}

        {/* Comments toggle */}
        {comments.length > 0 && !showComments && (
          <button onClick={() => setShowComments(true)}
            className={`font-inter text-xs ${L?'text-gray-500':'text-gray-500'} hover:text-red-400 transition-colors`}>
            View all {comments.length} comments
          </button>
        )}

        {/* Comments list */}
        {showComments && (
          <div className="space-y-2 pt-1">
            {comments.map(c => (
              <div key={c._id} className="flex items-start gap-2 group">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0 mt-0.5">
                  {c.user?.profilePhoto
                    ? <img src={c.user.profilePhoto} alt="" className="w-full h-full object-cover" />
                    : <span className="font-clash text-[8px] font-bold text-white flex items-center justify-center h-full">{(c.user?.name||'?')[0]}</span>}
                </div>
                <div className="flex-1">
                  <span className={`font-inter text-xs font-semibold ${L?'text-gray-800':'text-gray-200'}`}>{c.user?.name?.split(' ')[0]} </span>
                  <span className={`font-inter text-xs ${L?'text-gray-700':'text-gray-300'}`}>{c.text}</span>
                </div>
                {(c.user?._id === currentUser?._id || isAdmin) && (
                  <button onClick={() => removeComment(c._id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs">✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        {currentUser && (
          <form onSubmit={addComment} className="flex items-center gap-2 pt-1 border-t border-white/5">
            <input value={newComment} onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              className={`flex-1 bg-transparent font-inter text-sm outline-none ${L?'text-gray-800 placeholder:text-gray-400':'text-gray-200 placeholder:text-gray-600'}`} />
            {newComment.trim() && (
              <button type="submit" disabled={posting}
                className="font-inter text-xs text-red-500 hover:text-red-400 font-semibold transition-colors">
                {posting ? '…' : 'Post'}
              </button>
            )}
          </form>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[300] bg-black/96 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={post.imageUrl} alt="" className="max-w-3xl w-full max-h-[90vh] object-contain rounded-2xl" />
          <button onClick={() => setLightbox(false)} className="absolute top-6 right-6 text-white/60 hover:text-white">✕</button>
        </div>
      )}

      <ConfirmDialog
        open={delConfirm}
        title="Delete this post?"
        message="This post will be permanently deleted and cannot be recovered."
        confirmLabel="Delete"
        onConfirm={() => { setDelConfirm(false); deletePost() }}
        onCancel={() => setDelConfirm(false)}
      />
    </div>
  )
}

// ── Upload new post ───────────────────────────────────────────────────────────
function UploadPost({ onPosted, L }) {
  const [open,     setOpen]    = useState(false)
  const [uploaded, setUploaded]= useState(null)
  const [caption,  setCaption] = useState('')
  const [posting,  setPosting] = useState(false)
  const [error,    setError]   = useState('')

  const submit = async () => {
    if (!uploaded) return setError('Please select an image.')
    setPosting(true); setError('')
    try {
      const { post } = await postsApi.create({ imageUrl: uploaded.publicUrl, s3Key: uploaded.key, caption })
      onPosted?.(post)
      setOpen(false); setUploaded(null); setCaption('')
    } catch (e) { setError(e.message) }
    finally { setPosting(false) }
  }

  return (
    <>
      <GlassButton variant="red" onClick={() => setOpen(true)}
        className="font-inter text-sm font-medium flex items-center gap-2 px-5"
        style={{ borderRadius:'14px', minHeight:'44px' }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Post
      </GlassButton>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative auth-glass w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 auth-sheet-mobile sm:auth-modal-desktop space-y-4">
            <div className="sm:hidden flex justify-center pt-1 pb-2">
              <div className="w-9 h-1 bg-white/20 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className={`font-clash text-lg font-semibold ${L?'text-gray-900':'text-white'}`}>New Post</h3>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <ImageUpload folder="posts" onUpload={r => setUploaded(r)} label="Choose photo" preview={true} />

            <textarea value={caption} onChange={e => setCaption(e.target.value.slice(0,2200))}
              rows={3} placeholder="Write a caption… (optional)"
              className="glass-input w-full resize-none text-sm" style={{ borderRadius:'12px' }} />
            <p className={`text-right font-inter text-[10px] -mt-2 ${L?'text-gray-400':'text-gray-600'}`}>{caption.length}/2200</p>

            {error && <p className="font-inter text-xs text-red-400">{error}</p>}

            <GlassButton onClick={submit} variant="red" disabled={posting || !uploaded}
              className="w-full font-inter text-sm" style={{ borderRadius:'12px', minHeight:'48px' }}>
              {posting ? 'Sharing…' : 'Share'}
            </GlassButton>
          </div>
        </div>
      )}
    </>
  )
}

// ── Main feed page ────────────────────────────────────────────────────────────
export default function FeedPage() {
  const { theme }         = useTheme()
  const { user }          = useAuth()
  const [posts,   setPosts]   = useState([])
  const [loading, setLoading] = useState(true)
  const L = theme === 'light'

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try { const d = await postsApi.feed({ limit: 50 }); setPosts(d.posts) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  // Poll for new posts every 30s
  useEffect(() => {
    const t = setInterval(() => postsApi.feed({ limit: 1 }).then(d => {
      if (d.posts[0] && d.posts[0]._id !== posts[0]?._id) fetchPosts()
    }).catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [posts, fetchPosts])

  const handlePosted = (newPost) => setPosts(p => [newPost, ...p])
  const handleDeleted = (id)     => setPosts(p => p.filter(x => x._id !== id))

  return (
    <PageLayout title={null}>
      <div className={`min-h-screen pt-14 transition-colors ${L?'bg-gray-50':'bg-[#050505]'}`}>
        {/* Header */}
        <div className={`sticky top-14 z-40 border-b backdrop-blur-md transition-colors ${L?'bg-white/90 border-black/8':'bg-black/85 border-white/8'}`}>
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className={`font-clash text-xl font-bold ${L?'text-gray-900':'text-white'}`}>
              📷 IEM Feed
            </h1>
            {user ? (
              <UploadPost onPosted={handlePosted} L={L} />
            ) : (
              <GlassButton variant="red" onClick={() => document.dispatchEvent(new CustomEvent('open-auth'))}
                className="font-inter text-sm px-5" style={{ borderRadius:'12px', minHeight:'38px' }}>
                Join to Post
              </GlassButton>
            )}
          </div>
        </div>

        {/* Feed */}
        <div className="max-w-lg mx-auto px-4 py-5">
          {loading ? (
            <SkeletonFeedPost n={3} L={L} />
          ) : posts.length === 0 ? (
            <div className={`py-24 text-center auth-glass rounded-3xl border ${L?'border-black/7':'border-white/7'}`}>
              <p className="text-5xl mb-4">📸</p>
              <p className={`font-clash font-bold text-xl mb-2 ${L?'text-gray-900':'text-white'}`}>No Posts Yet</p>
              <p className={`font-inter text-sm ${L?'text-gray-500':'text-gray-500'}`}>Be the first to share a photo!</p>
            </div>
          ) : (
            posts.map(p => (
              <PostCard key={p._id} post={p} currentUser={user} onDeleted={handleDeleted} L={L} />
            ))
          )}
        </div>
      </div>
    </PageLayout>
  )
}
