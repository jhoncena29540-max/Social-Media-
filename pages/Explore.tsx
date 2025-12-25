
import React, { useState, useEffect, useMemo } from 'react';
import * as firestoreModule from 'firebase/firestore';
import { db } from '../firebase';
import { Post, PostType, UserProfile } from '../types';
import { LayoutGrid, Eye, Sparkles, Loader2, Play, Video, Heart, Search, Users, ChevronRight, Tag } from 'lucide-react';
import * as RouterNamespace from 'react-router-dom';

const { collection, query, limit, onSnapshot, where, getDocs, orderBy, startAt, endAt } = firestoreModule as any;
const { Link } = RouterNamespace as any;

const Explore: React.FC = () => {
  const [rawExplorePosts, setRawExplorePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Tech', 'Design', 'Gaming', 'News', 'Art', 'General'];

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const allPosts = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as Post);
      
      allPosts.sort((a, b) => {
        const scoreA = (a.likesCount * 3) + (a.viewsCount / 5);
        const scoreB = (b.likesCount * 3) + (b.commentsCount / 5);
        return scoreB - scoreA;
      });
      
      setRawExplorePosts(allPosts);
      setLoading(false);
    }, (err: any) => {
      console.error("Explore fetch error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleSearch = async () => {
      if (!searchTerm.trim()) {
        setUserResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      try {
        const lowerSearch = searchTerm.toLowerCase();
        const userQ = query(
          collection(db, 'users'),
          orderBy('username'),
          startAt(lowerSearch),
          endAt(lowerSearch + '\uf8ff'),
          limit(10)
        );
        
        const snap = await getDocs(userQ);
        const results = snap.docs.map((doc: any) => ({ uid: doc.id, ...doc.data() }) as UserProfile);
        setUserResults(results);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(handleSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const trendingVisuals = useMemo(() => {
    const now = Date.now();
    return rawExplorePosts.filter(p => {
        const isVisual = p.type === PostType.IMAGE || p.type === PostType.VIDEO || p.type === PostType.REEL;
        const isTimePassed = p.scheduledAt ? p.scheduledAt.toMillis() <= now : true;
        const isActive = p.isPublished === true || isTimePassed;
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return isVisual && isActive && matchesCategory;
    });
  }, [rawExplorePosts, selectedCategory]);

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="mb-16 space-y-10">
        <div>
          <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none mb-4">Explore</h1>
          <p className="text-brand-gray-400 font-black tracking-[0.4em] text-[10px] uppercase opacity-60">Discover new things</p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="relative group flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-gray-300 group-focus-within:text-brand-black dark:group-focus-within:text-brand-white transition-colors" size={20} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for people..." 
              className="w-full bg-brand-gray-50 dark:bg-brand-gray-950 border-2 border-brand-gray-100 dark:border-brand-gray-900 rounded-[2rem] py-5 pl-16 pr-6 focus:outline-none focus:border-brand-black dark:focus:border-brand-white transition-all text-sm font-bold tracking-tight shadow-inner"
            />
            {searching && (
              <div className="absolute right-6 top-1/2 -translate-y-1/2">
                <Loader2 size={18} className="animate-spin text-brand-gray-400" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedCategory === cat
                  ? 'bg-brand-black dark:bg-brand-white text-white dark:text-black shadow-lg scale-105'
                  : 'bg-brand-gray-50 dark:bg-brand-gray-900 text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {searchTerm.trim() !== '' && (
        <section className="mb-20 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center space-x-3 mb-8 px-2">
            <Users size={18} className="text-brand-gray-400" />
            <h2 className="text-xs font-black uppercase tracking-[0.3em]">Users found</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userResults.map((user) => (
              <Link 
                key={user.uid} 
                to={`/u/${user.username}`}
                className="group flex items-center justify-between p-6 bg-brand-gray-50 dark:bg-brand-gray-950 border border-brand-gray-100 dark:border-brand-gray-900 rounded-[2.5rem] hover:shadow-2xl transition-all hover:scale-[1.02]"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-gray-200 dark:bg-brand-gray-800 border-2 border-brand-white dark:border-brand-black shadow-lg group-hover:rotate-12 transition-transform">
                    <img src={user.photoURL} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div>
                    <p className="font-black text-xs uppercase tracking-widest">@{user.username}</p>
                    <p className="text-[10px] text-brand-gray-400 font-bold">{user.displayName}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-brand-gray-300 group-hover:text-brand-black dark:group-hover:text-brand-white transform translate-x-0 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
            
            {!searching && userResults.length === 0 && (
              <div className="col-span-full py-10 text-center bg-brand-gray-50 dark:bg-brand-gray-950/30 rounded-[2.5rem] border-2 border-dashed border-brand-gray-100 dark:border-brand-gray-900">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-20 italic">No people matched "{searchTerm}"</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className={searchTerm.trim() !== '' ? 'opacity-40 grayscale pointer-events-none blur-sm transition-all duration-700' : 'transition-all duration-700'}>
        <div className="flex items-center justify-between mb-10 px-2">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] flex items-center">
            <LayoutGrid size={16} className="mr-3" /> {selectedCategory === 'All' ? 'Trending Photos & Videos' : `${selectedCategory} Posts`}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center p-24">
            <Loader2 size={48} className="animate-spin text-brand-black dark:text-brand-white" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-10">
            {trendingVisuals.map((post) => (
              <div key={post.id} className="relative aspect-square group cursor-pointer overflow-hidden rounded-[3rem] bg-brand-gray-100 dark:bg-brand-gray-950 border border-brand-gray-100 dark:border-brand-gray-900 animate-in zoom-in-95 duration-1000 shadow-sm hover:shadow-2xl">
                <img 
                  src={post.mediaURL || `https://placehold.co/600x600/000000/FFFFFF?text=${post.type.toUpperCase()}`} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-1000" 
                  alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col items-center justify-end p-10 text-white text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] mb-6 opacity-70">@{post.authorUsername}</p>
                  <div className="flex items-center space-x-10">
                    <span className="flex flex-col items-center group/impact">
                      <Heart size={22} fill="white" strokeWidth={0} className="mb-2 group-hover/impact:scale-125 transition-transform" /> 
                      <span className="text-[10px] font-black">{post.likesCount}</span>
                    </span>
                    <span className="flex flex-col items-center group/view">
                      <Eye size={22} className="mb-2 group-hover/view:scale-125 transition-transform" /> 
                      <span className="text-[10px] font-black">{post.viewsCount || 0}</span>
                    </span>
                  </div>
                </div>
                
                <div className="absolute top-6 left-6 flex space-x-2">
                  {post.type === PostType.REEL && <div className="p-3 bg-brand-black/50 backdrop-blur-2xl rounded-2xl text-white shadow-lg"><Play size={14} fill="white" /></div>}
                  {post.type === PostType.VIDEO && <div className="p-3 bg-brand-black/50 backdrop-blur-2xl rounded-2xl text-white shadow-lg"><Video size={14} fill="white" /></div>}
                  {post.category && <div className="p-2 px-3 bg-brand-white/10 backdrop-blur-2xl rounded-xl text-white shadow-lg text-[8px] font-black uppercase tracking-widest">{post.category}</div>}
                </div>
              </div>
            ))}
            {trendingVisuals.length === 0 && (
              <div className="col-span-full text-center py-48 opacity-10">
                <p className="font-black italic text-lg tracking-[0.4em] uppercase">No posts available.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Explore;
