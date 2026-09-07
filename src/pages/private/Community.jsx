import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../../components/layout/TopBar'
import Footer from '../../components/layout/Footer'
import PostCard from '../../components/community/PostCard'
import PostComposer from '../../components/community/PostComposer'
import Icon from '../../components/common/Icon'
import { useAuth } from '../../hooks/useAuth'
import { APPWRITE_DATABASE_ID, COLLECTIONS, appwriteClient } from '../../services/appwrite'
import {
  POST_CATEGORIES,
  deletePost,
  getPosts,
  toggleBookmark,
  toggleLike,
} from '../../services/community'

const PAGE_SIZE = 20

function Community() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('newest')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const offsetRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const abortRef = useRef(0)

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  const load = useCallback(
    async (reset = true, offsetOverride) => {
      const currentOffset = typeof offsetOverride === 'number' ? offsetOverride : reset ? 0 : offsetRef.current
      if (reset) setLoading(true)
      else setLoadingMore(true)
      setError('')
      const requestId = ++abortRef.current
      try {
        const result = await getPosts({ category, sort, search, offset: currentOffset, limit: PAGE_SIZE })
        if (requestId !== abortRef.current) return
        if (reset) {
          setPosts(result.posts || [])
        } else {
          setPosts((prev) => [...prev, ...(result.posts || [])])
        }
        setTotal(result.total || 0)
        const nextOffset = reset ? (result.posts?.length || 0) : currentOffset + (result.posts?.length || 0)
        setOffset(nextOffset)
        offsetRef.current = nextOffset
      } catch (err) {
        if (requestId !== abortRef.current) return
        if (reset) {
          setPosts([])
          setTotal(0)
        }
        setError(err?.response?.data?.message || 'Could not load the community feed. Please try again shortly.')
      } finally {
        if (requestId === abortRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [category, sort, search],
  )

  // Debounced search + filter changes reset pagination
  useEffect(() => {
    setOffset(0)
    offsetRef.current = 0
    const handle = setTimeout(() => load(true, 0), search ? 350 : 0)
    return () => clearTimeout(handle)
  }, [category, sort, search, load])

  const handleCreated = async () => {
    setComposerOpen(false)
    setOffset(0)
    offsetRef.current = 0
    await load(true, 0)
  }

  const handleLike = useCallback(async (post) => {
    try {
      const result = await toggleLike(post.$id)
      setPosts((prev) =>
        prev.map((item) =>
          item.$id === post.$id ? { ...item, liked_by_me: result.liked, likes_count: result.likes_count } : item,
        ),
      )
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update like. Please try again.')
    }
  }, [])

  const handleBookmark = useCallback(async (post) => {
    try {
      const result = await toggleBookmark(post.$id)
      setPosts((prev) =>
        prev.map((item) =>
          item.$id === post.$id ? { ...item, bookmarked_by_me: result.bookmarked } : item,
        ),
      )
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update bookmark. Please try again.')
    }
  }, [])

  const handleDelete = async (post) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await deletePost(post.$id)
      setPosts((prev) => prev.filter((item) => item.$id !== post.$id))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete post. Please try again.')
    }
  }

  // Realtime: refresh feed when a new post is created elsewhere
  useEffect(() => {
    if (!APPWRITE_DATABASE_ID) return
    let unsub = null
    try {
      unsub = appwriteClient.subscribe(
        `databases.${APPWRITE_DATABASE_ID}.collections.${COLLECTIONS.communityPosts}.documents`,
        (event) => {
          if (event.events?.some((e) => e.includes('create'))) {
            load(true, 0)
          }
        },
      )
    } catch {}
    return () => {
      try { unsub?.() } catch {}
    }
  }, [load])

  const hasMore = posts.length < total

  return (
    <div className="min-h-screen">
      <TopBar />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em]">Community</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Learn together</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink-muted">
              Share questions, resources, successes, and advice with fellow learners.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/community/saved" className="btn-secondary !h-10 !px-4 !text-sm">
              Saved posts
            </Link>
            <Link
              to={`/community/users/${user.$id}`}
              className="btn-secondary !h-10 !px-4 !text-sm"
            >
              My profile
            </Link>
            <button onClick={() => setComposerOpen((open) => !open)} className="btn-primary !h-10 !px-4 !text-sm">
              {composerOpen ? 'Cancel' : 'New post'}
            </button>
          </div>
        </div>

        {composerOpen && (
          <div className="mt-6">
            <PostComposer onCreated={handleCreated} onCancelled={() => setComposerOpen(false)} />
          </div>
        )}

        <section className="mt-10">
          <div className="flex flex-wrap items-center gap-2">
            <Icon name="message" size={18} className="text-brand-deep" />
            <h2 className="text-xl font-black tracking-tight">Posts</h2>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search posts, tags, categories…"
            className="input-base w-full sm:w-80"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`chip !px-3 !py-1.5 !text-xs ${category === '' ? 'chip-active' : ''}`}
            >
              All
            </button>
            {POST_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(category === item ? '' : item)}
                className={`chip !px-3 !py-1.5 !text-xs ${category === item ? 'chip-active' : ''}`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSort('newest')}
              className={`chip !px-3 !py-1.5 !text-xs ${sort === 'newest' ? 'chip-active' : ''}`}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => setSort('popular')}
              className={`chip !px-3 !py-1.5 !text-xs ${sort === 'popular' ? 'chip-active' : ''}`}
            >
              Popular
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-bold text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="card h-56 animate-pulse bg-warm" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-8 rounded-xl border border-accent-yellow bg-cream px-6 py-12 text-center">
            <Icon name="message" size={40} className="mx-auto text-brand-deep" />
            <p className="mt-4 text-2xl font-black tracking-tight">No posts yet</p>
            <p className="mt-2 mx-auto max-w-md text-sm text-ink-muted">
              {search || category
                ? 'No posts match your filters yet. Try widening your search.'
                : 'Start the conversation — share a question, resource, or success story with the community.'}
            </p>
            <button onClick={() => setComposerOpen(true)} className="btn-primary mt-6 !h-10 !px-4 !text-sm">
              Write the first post
            </button>
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              {total} post{total === 1 ? '' : 's'}
            </p>
            <button onClick={() => load(true, 0)} disabled={loading} className="btn-text !text-sm">
              Refresh
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <PostCard
              key={post.$id}
              post={post}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onDelete={post.user_id === user.$id ? handleDelete : undefined}
            />
          ))}
        </div>
        {hasMore && !loading && (
          <div className="mt-6 flex justify-center">
            <button onClick={() => load(false, offsetRef.current)} disabled={loadingMore} className="btn-secondary !h-10 !px-6 !text-sm disabled:opacity-50">
              {loadingMore ? 'Loading…' : `Load more (${total - posts.length} remaining)`}
            </button>
          </div>
        )}
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default Community