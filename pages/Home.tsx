
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as firestoreModule from 'firebase/firestore';
import * as RouterNamespace from 'react-router-dom';
import { db, auth } from '../firebase.ts';
import { Post, PostType } from '../types.ts';
import PostCard from '../components/PostCard.tsx';
import CreatePost from '../components/CreatePost.tsx';
import { 
  Search, SlidersHorizontal, Sparkles, PlusSquare, X, TrendingUp
} from 'lucide-react';

const { useSearchParams, useOutletContext } = RouterNamespace as any;
const { collection, query, limit, getDocs, where, startAfter, onSnapshot } = firestoreModule as any;
type QueryDocumentSnapshot = any;

const Home: React.FC = () => {
  const { trendingTags = [] } = useOutletContext() as { trendingTags: any[] };
  const [searchParams, setSearchParams] = useSearchParams();
  const [rawPosts, setRawPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'Latest' | 'Following' | 'Trending'>('Latest');
  const [isCreating, setIsCreating] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const activeTopic = searchParams.get('tag') || 'ALL';

  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    // Blocks listener
    const blocksQ = query(collection(db, 'blocks'), where('blockerId', '==', user.uid));
    const unsubscribeBlocks = onSnapshot(blocksQ, (snap: any) => {
      setBlockedIds(new Set(snap.docs.map((d: any) => d.data().blockedId)));
    }, (err: any) => console.error("Blocks sync failure:", err));

    // Follows listener
    const followQ = query(collection(db, 'follows'), where('followerId', '==', user.uid));
    const unsubscribeFollows = onSnapshot(followQ, (snap: any) => {
      setFollowingIds(snap.docs.map((d: any) => d.data().followedId));
    }, (err: any) => console.error("Follows sync failure:", err));

    return () => {
      unsubscribeBlocks();
      unsubscribeFollows();
    };
  }, [auth.currentUser]);

  // Client-side sorting and filtering
  const posts = useMemo(() => {
    const currentUserId = auth.currentUser?.uid;
    const now = Date.now();

    let filtered = rawPosts.filter(p => {
      if (blockedIds.has(p.authorId)) return false;
      
      const isPastScheduled = p.scheduledAt && p.scheduledAt.toMillis() <= now;
      const isLive = p.isPublished || isPastScheduled;
      const isVisible = (p.visibility === 'public' && isLive) || p.authorId === currentUserId;
      
      if (!isVisible) return false;

      if (activeTab === 'Following' && !followingIds.includes(p.authorId) && p.authorId !== currentUserId) {
        return false;
      }

      if (activeTopic !== 'ALL') {
        const matchesTag = (p.tags || []).some(t => t.toLowerCase() === activeTopic.toLowerCase());
        if (!matchesTag) return false;
      }

      const terms = searchQuery.toLowerCase().trim();
      if (terms) {
        if (terms.startsWith('#')) {
          const tagToSearch = terms.slice(1);
          return (p.tags || []).some(t => t.toLowerCase() === tagToSearch);
        }
        return p.content.toLowerCase().includes(terms) || 
               p.authorUsername.toLowerCase().includes(terms) ||
               (p.tags || []).some(t => t.toLowerCase().includes(terms));
      }
      return true;
    });
    
    if (activeTab === 'Trending' || activeTopic !== 'ALL') {
      return [...filtered].sort((a, b) => {
        const scoreA = (a.likesCount * 3) + (a.commentsCount * 2) + (a.viewsCount / 5);
        const scoreB = (b.likesCount * 3) + (b.commentsCount * 2) + (b.viewsCount / 5);
        if (scoreA === scoreB) {
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        }
        return scoreB - scoreA;
      });
    }

    return [...filtered].sort((a, b) => {
      const tA = a.createdAt?.toMillis() || 0;
      const tB = b.createdAt?.toMillis() || 0;
      return tB - tA;
    });
  }, [rawPosts, blockedIds, activeTab, followingIds, searchQuery, activeTopic, auth.currentUser]);

  const fetchPosts = async (isInitial = true) => {
    if (!auth.currentUser) return;
    if (isInitial) {
      setLoading(true);
      setRawPosts([]);
      setLastDoc(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const baseLimit = 40;
      let q = query(
        collection(db, 'posts'), 
        where('visibility', '==', 'public'),
        limit(baseLimit)
      );

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const postsData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];

      setRawPosts(prev => isInitial ? postsData : [...prev, ...postsData]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === baseLimit);
    } catch (error: any) {
      console.error("Posts loading error:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (auth.currentUser) fetchPosts(true);
    
    // Real-time listener for the top 50 posts to handle edits/deletes instantly
    const realTimeQ = query(
        collection(db, 'posts'),
        where('visibility', '==', 'public'),
        limit(50)
    );

    const unsubscribe = onSnapshot(realTimeQ, (snap: any) => {
        snap.docChanges().forEach((change: any) => {
            const data = { id: change.doc.id, ...change.doc.data() } as Post;
            if (change.type === 'added') {
                setRawPosts(prev => {
                    if (prev.find(p => p.id === data.id)) return prev;
                    return [data, ...prev];
                });
            } else if (change.type === 'modified') {
                setRawPosts(prev => prev.map(p => p.id === data.id ? data : p));
            } else if (change.type === 'removed') {
                setRawPosts(prev => prev.filter(p => p.id !== data.id));
            }
        });
    }, (err: any) => {
        console.error("Real-time sync failed:", err);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const lastPostRef = useCallback((node: HTMLDivElement) => {
    if (node && !loading && !loadingMore && hasMore) {
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) fetchPosts(false);
      });
      observer.current.observe(node);
    }
  }, [loading, loadingMore, hasMore]);

  const clearTopic = () => {
    setSearchParams({});
  };

  const selectTag = (tag: string) => {
    setSearchParams({ tag });
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="sticky top-0 md:top-0 z-50 pt-4 bg-brand-white/80 backdrop-blur-3xl rounded-b-[2.5rem] border-b border-brand-gray-100 mb-12 shadow-sm">
        
        {/* Search Bar */}
        <div className="px-6 pb-4">
          <div className="flex items-center space-x-4">
            <div className="relative group flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-gray-400 group-focus-within:text-brand-black transition-colors" size={20} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts or topics..." 
                className="w-full bg-brand-gray-50 border border-brand-gray-100 rounded-[2rem] py-5 pl-16 pr-6 focus:outline-none transition-all text-sm font-bold tracking-tight text-brand-black shadow-sm"
              />
            </div>
            {activeTopic !== 'ALL' && (
              <button 
                onClick={clearTopic}
                className="flex items-center space-x-2 px-6 py-4 bg-brand-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-right-4"
              >
                <span>#{activeTopic}</span>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Real-time Trending Bar */}
        <div className="px-8 pb-4 flex items-center space-x-3 overflow-x-auto scrollbar-hide">
          <div className="flex-shrink-0 flex items-center space-x-2 text-brand-gray-400">
            <TrendingUp size={14} />
            <span className="text-[9px] font-black uppercase tracking-widest">Trending Now</span>
          </div>
          <div className="flex items-center space-x-2">
            {trendingTags.map((tag: any) => (
              <button 
                key={tag.name}
                onClick={() => selectTag(tag.name)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${activeTopic === tag.name ? 'bg-brand-black text-white border-brand-black' : 'bg-brand-white text-brand-gray-500 border-brand-gray-100 hover:border-brand-black hover:text-brand-black'}`}
              >
                #{tag.name}
              </button>
            ))}
            {trendingTags.length === 0 && (
              <span className="text-[9px] text-brand-gray-300 font-bold uppercase tracking-widest">Warming up...</span>
            )}
          </div>
        </div>
      </div>

      {/* Create Button */}
      <div className="mb-12 px-6 animate-in fade-in slide-in-from-top-4 duration-500">
        {!isCreating ? (
          <button 
            onClick={() => setIsCreating(true)}
            className="w-full bg-brand-black dark:bg-brand-white text-white dark:text-black py-6 rounded-[2.5rem] hover:opacity-90 transition-all font-black text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-[0.98] flex items-center justify-center space-x-4 group"
          >
            <PlusSquare size={22} className="group-hover:rotate-90 transition-transform duration-500" />
            <span>Post something</span>
          </button>
        ) : (
          <div className="relative group/creator">
            <button 
              onClick={() => setIsCreating(false)}
              className="absolute -top-4 -right-4 z-[60] p-3 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-full shadow-2xl hover:text-red-500 transition-all active:scale-90"
              title="Stop"
            >
              <X size={20} />
            </button>
            <div className="animate-in zoom-in-95 duration-300">
              <CreatePost />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-12 mt-12 pb-40">
        {loading ? (
          <div className="space-y-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-brand-gray-50 h-[400px] rounded-[2.5rem] border border-brand-gray-100 animate-pulse"></div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-40 bg-brand-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-brand-gray-100">
            <div className="w-20 h-20 bg-brand-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl">
              <SlidersHorizontal size={32} className="opacity-10 text-brand-black" />
            </div>
            <p className="text-xl font-black uppercase tracking-[0.3em] italic opacity-10 leading-none text-brand-black">No posts found</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <div key={post.id} ref={index === posts.length - 1 ? lastPostRef : null} className="animate-in fade-in slide-in-from-bottom-6 duration-700">
              <PostCard post={post} />
            </div>
          ))
        )}
        {loadingMore && (
          <div className="flex justify-center p-16">
             <div className="w-10 h-10 border-4 border-brand-black border-t-transparent animate-spin rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
