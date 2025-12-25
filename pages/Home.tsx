
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as firestoreModule from 'firebase/firestore';
import { db, auth } from '../firebase.ts';
import { Post, PostType } from '../types.ts';
import PostCard from '../components/PostCard.tsx';
import CreatePost from '../components/CreatePost.tsx';
import { 
  Search, SlidersHorizontal, Sparkles, Filter, LayoutGrid, 
  FileText, Video, Image as ImageIcon, TrendingUp, Users, 
  ChevronDown, Bold, Italic, List, ListOrdered, Quote, Code, 
  Minus, Link, Terminal, Image as ImageRefIcon, Hash 
} from 'lucide-react';

const { collection, query, limit, getDocs, where, startAfter, onSnapshot } = firestoreModule as any;
type QueryDocumentSnapshot = any;

const Home: React.FC = () => {
  const [rawPosts, setRawPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'Latest' | 'Following' | 'Trending'>('Latest');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('ALL');

  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    const blocksQ = query(collection(db, 'blocks'), where('blockerId', '==', user.uid));
    const unsubscribeBlocks = onSnapshot(blocksQ, (snap: any) => {
      setBlockedIds(new Set(snap.docs.map((d: any) => d.data().blockedId)));
    }, (err: any) => console.error("Presence Sync Failure:", err));

    const followQ = query(collection(db, 'follows'), where('followerId', '==', user.uid));
    const unsubscribeFollows = onSnapshot(followQ, (snap: any) => {
      setFollowingIds(snap.docs.map((d: any) => d.data().followedId));
    }, (err: any) => console.error("Link Sync Failure:", err));

    return () => {
      unsubscribeBlocks();
      unsubscribeFollows();
    };
  }, [auth.currentUser]);

  const posts = useMemo(() => {
    const now = Date.now();
    const currentUserId = auth.currentUser?.uid;

    let filtered = rawPosts.filter(p => {
      if (blockedIds.has(p.authorId)) return false;
      const isVisible = (p.visibility === 'public' && p.isPublished) || p.authorId === currentUserId;
      if (!isVisible) return false;

      if (activeTab === 'Following' && !followingIds.includes(p.authorId) && p.authorId !== currentUserId) {
        return false;
      }

      // Topic Filter (Maintained for logic but UI is removed per request)
      if (activeTopic !== 'ALL') {
        const matchesCategory = p.category === activeTopic;
        const matchesTag = (p.tags || []).includes(activeTopic);
        if (!matchesCategory && !matchesTag) return false;
      }

      // Enhanced Search
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
    
    if (activeTab === 'Trending') {
      return [...filtered].sort((a, b) => {
        const scoreA = (a.likesCount * 3) + (a.commentsCount * 2) + (a.viewsCount / 5);
        const scoreB = (b.likesCount * 3) + (b.commentsCount * 2) + (b.viewsCount / 5);
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
      console.error("Signal Retrieval Error:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (auth.currentUser) fetchPosts(true);
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

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="sticky top-0 md:top-0 z-50 pt-4 bg-brand-white/80 dark:bg-[#050505]/80 backdrop-blur-3xl rounded-b-[2.5rem] border-b border-brand-gray-100 dark:border-brand-gray-900 mb-12 shadow-sm">
        
        {/* Signal Search */}
        <div className="px-6 pb-6">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-gray-400 group-focus-within:text-brand-black dark:group-focus-within:text-brand-white transition-colors" size={20} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter grid or search topics #AI..." 
              className="w-full bg-brand-gray-50 dark:bg-brand-gray-950 border border-brand-gray-100 dark:border-brand-gray-900 rounded-[2rem] py-5 pl-16 pr-6 focus:outline-none transition-all text-sm font-bold tracking-tight text-brand-black dark:text-brand-white shadow-sm"
            />
          </div>
        </div>
      </div>

      <CreatePost />

      <div className="space-y-12 mt-12 pb-40">
        {loading ? (
          <div className="space-y-10">
            {[1, 2].map(i => (
              <div key={i} className="bg-brand-gray-50 dark:bg-brand-gray-950/50 h-[400px] rounded-[2.5rem] border border-brand-gray-100 dark:border-brand-gray-900 animate-pulse"></div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-40 bg-brand-gray-50/50 dark:bg-brand-gray-950/20 rounded-[2.5rem] border-2 border-dashed border-brand-gray-100 dark:border-brand-gray-900">
            <div className="w-20 h-20 bg-brand-white dark:bg-brand-black rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl">
              <SlidersHorizontal size={32} className="opacity-10 text-brand-black dark:text-brand-white" />
            </div>
            <p className="text-xl font-black uppercase tracking-[0.3em] italic opacity-10 leading-none text-brand-black dark:text-brand-white">Grid Silent</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400 mt-4 opacity-40">
              No active signal transmissions detected.
            </p>
          </div>
        ) : (
          posts.map((post, index) => (
            <div key={post.id} ref={index === posts.length - 1 ? lastPostRef : null} className="animate-in fade-in duration-700">
              <PostCard post={post} />
            </div>
          ))
        )}
        {loadingMore && (
          <div className="flex justify-center p-16">
             <div className="w-10 h-10 border-4 border-brand-black dark:border-brand-white border-t-transparent animate-spin rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
