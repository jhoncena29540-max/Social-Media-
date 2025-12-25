
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as RouterNamespace from 'react-router-dom';
import * as firestoreModule from 'firebase/firestore';
import { auth, db } from '../firebase.ts';
import { UserProfile, Post } from '../types.ts';
import PostCard from '../components/PostCard.tsx';
import EditProfileModal from '../components/EditProfileModal.tsx';
import UserListModal from '../components/UserListModal.tsx';
import { Grid, Play, Bookmark, Heart, FileText, Mail, Link as LinkIcon, Calendar, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const { useParams, useNavigate } = RouterNamespace as any;
const { collection, query, where, getDocs, updateDoc, increment, doc, serverTimestamp, setDoc, deleteDoc, getDoc, limit, startAfter, addDoc, onSnapshot } = firestoreModule as any;
type QueryDocumentSnapshot = any;

type ProfileTab = 'Posts' | 'Reels' | 'Pending' | 'Likes' | 'Saved';
type ContentFilter = 'All' | 'Text' | 'Image' | 'Video' | 'Article';

const Profile: React.FC = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rawPosts, setRawPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [filter, setFilter] = useState<ContentFilter>('All');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userListConfig, setUserListConfig] = useState<{ type: 'Followers' | 'Following', isOpen: boolean }>({ type: 'Followers', isOpen: false });
  const [startingChat, setStartingChat] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!username) return;

    let unsubscribeProfile: () => void;

    const fetchProfileData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userId = userDoc.id;

          unsubscribeProfile = onSnapshot(doc(db, 'users', userId), (snap: any) => {
            if (snap.exists()) {
              const userData = { ...snap.data(), uid: snap.id } as UserProfile;
              setProfile(userData);
              setLoading(false);
            }
          });

          if (auth.currentUser && auth.currentUser.uid !== userId) {
            getDoc(doc(db, 'follows', `${auth.currentUser.uid}_${userId}`)).then((f: any) => setIsFollowing(f.exists()));
            getDoc(doc(db, 'blocks', `${auth.currentUser.uid}_${userId}`)).then((b: any) => setIsBlocked(b.exists()));
          }
          
          await fetchContent(userId, true);
        } else {
          setProfile(null);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Profile Fetch Error:", err);
        setLoading(false);
      }
    };

    fetchProfileData();
    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [username]);

  const posts = useMemo(() => {
    let filtered = [...rawPosts];
    if (activeTab === 'Posts' && filter !== 'All') {
      filtered = filtered.filter(p => p.type.toLowerCase() === filter.toLowerCase());
    }
    return filtered.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }, [rawPosts, filter, activeTab]);

  const fetchContent = async (userId: string, isInitial = true) => {
    if (isInitial) {
      setRawPosts([]);
      setLastDoc(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let fetchedPosts: Post[] = [];
      const baseLimit = 20;
      let snapshot;

      const isOwnProfile = auth.currentUser?.uid === userId;

      if (activeTab === 'Saved') {
        let q = query(collection(db, 'saved_posts'), where('userId', '==', auth.currentUser?.uid), limit(baseLimit));
        if (!isInitial && lastDoc) q = query(q, startAfter(lastDoc));
        snapshot = await getDocs(q);
        const savedRefs = snapshot.docs.map((d: any) => d.data().postId);
        for (const pid of savedRefs) {
          const pdoc = await getDoc(doc(db, 'posts', pid));
          if (pdoc.exists()) fetchedPosts.push({ id: pdoc.id, ...pdoc.data() } as Post);
        }
      } else if (activeTab === 'Likes') {
        let q = query(collection(db, 'likes'), where('userId', '==', userId), limit(baseLimit));
        if (!isInitial && lastDoc) q = query(q, startAfter(lastDoc));
        snapshot = await getDocs(q);
        const likedRefs = snapshot.docs.map((d: any) => d.data().postId);
        for (const pid of likedRefs) {
          const pdoc = await getDoc(doc(db, 'posts', pid));
          if (pdoc.exists()) fetchedPosts.push({ id: pdoc.id, ...pdoc.data() } as Post);
        }
      } else {
        let qConstraints = [where('authorId', '==', userId), where('isPublished', '==', true)];
        if (!isOwnProfile) qConstraints.push(where('visibility', '==', 'public'));
        if (activeTab === 'Reels') qConstraints.push(where('type', '==', 'reel'));

        let q = query(collection(db, 'posts'), ...qConstraints, limit(baseLimit));
        if (!isInitial && lastDoc) q = query(q, startAfter(lastDoc));
        snapshot = await getDocs(q);
        fetchedPosts = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as Post);
      }

      setRawPosts(prev => isInitial ? fetchedPosts : [...prev, ...fetchedPosts]);
      setLastDoc(snapshot ? snapshot.docs[snapshot.docs.length - 1] : null);
      setHasMore(snapshot ? snapshot.docs.length === baseLimit : false);
    } catch (err: any) {
      console.error("Content Fetch Failure:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const lastPostRef = useCallback((node: HTMLDivElement) => {
    if (node && !loading && !loadingMore && hasMore && profile) {
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) fetchContent(profile.uid, false);
      });
      observer.current.observe(node);
    }
  }, [loading, loadingMore, hasMore, profile]);

  const handleFollowToggle = async () => {
    if (!auth.currentUser || !profile || isBlocked) return;
    const followId = `${auth.currentUser.uid}_${profile.uid}`;
    const followRef = doc(db, 'follows', followId);
    try {
      if (isFollowing) {
        await deleteDoc(followRef);
        await updateDoc(doc(db, 'users', profile.uid), { followersCount: increment(-1) });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { followingCount: increment(-1) });
        setIsFollowing(false);
      } else {
        await setDoc(followRef, { followerId: auth.currentUser.uid, followedId: profile.uid, createdAt: serverTimestamp() });
        await updateDoc(doc(db, 'users', profile.uid), { followersCount: increment(1) });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { followingCount: increment(1) });
        setIsFollowing(true);
        await addDoc(collection(db, 'notifications'), {
          recipientId: profile.uid,
          senderId: auth.currentUser.uid,
          senderUsername: auth.currentUser.displayName || 'someone',
          senderPhotoURL: auth.currentUser.photoURL || '',
          type: 'follow',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) { console.error(err); }
  };

  const handleStartChat = async () => {
    if (!auth.currentUser || !profile || startingChat) return;
    setStartingChat(true);

    try {
      // Find if chat already exists
      const q = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      let existingChat = snap.docs.find(d => d.data().participants.includes(profile.uid));

      if (existingChat) {
        navigate(`/messages/${existingChat.id}`);
      } else {
        // Create new chat
        const newChatRef = await addDoc(collection(db, 'chats'), {
          participants: [auth.currentUser.uid, profile.uid],
          lastMessage: '',
          lastMessageAt: serverTimestamp(),
          unreadCount: {
            [auth.currentUser.uid]: 0,
            [profile.uid]: 0
          },
          typingStatus: {
            [auth.currentUser.uid]: false,
            [profile.uid]: false
          },
          createdAt: serverTimestamp()
        });
        navigate(`/messages/${newChatRef.id}`);
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
    } finally {
      setStartingChat(false);
    }
  };

  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 size={48} className="animate-spin text-brand-black dark:text-brand-white" /></div>;
  if (!profile) return <div className="p-20 text-center uppercase font-black italic opacity-20 tracking-widest">Identity Nullified.</div>;

  const isOwnProfile = auth.currentUser?.uid === profile.uid;

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in duration-500">
      <div className="relative">
        <div className="h-48 md:h-96 bg-brand-gray-100 dark:bg-brand-gray-950 relative overflow-hidden rounded-b-[4rem]">
           {profile.coverURL ? <img src={profile.coverURL} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-brand-gray-200 dark:bg-brand-gray-800" />}
           <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent"></div>
        </div>
        <div className="px-8 relative">
          <div className="flex justify-between items-end -mt-20 md:-mt-32 mb-8">
            <div className="w-32 h-32 md:w-56 md:h-56 rounded-full border-[8px] border-brand-white dark:border-brand-black bg-brand-gray-100 dark:bg-brand-gray-900 overflow-hidden shadow-2xl relative z-10">
               <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
            </div>
            <div className="flex space-x-4 mb-4">
              {isOwnProfile ? (
                <button onClick={() => setIsEditModalOpen(true)} className="bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 transition-all">Sync Identity</button>
              ) : (
                <>
                  <button 
                    onClick={handleStartChat} 
                    disabled={startingChat}
                    className="p-4 bg-brand-gray-50 dark:bg-brand-gray-900 rounded-3xl border border-brand-gray-200 dark:border-brand-gray-800 shadow-xl flex items-center justify-center hover:bg-brand-gray-100 dark:hover:bg-brand-gray-800 transition-all"
                  >
                    {startingChat ? <Loader2 size={24} className="animate-spin" /> : <Mail size={24} />}
                  </button>
                  <button onClick={handleFollowToggle} className={`px-12 py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl ${isFollowing ? 'bg-brand-gray-200 dark:bg-brand-gray-800 text-brand-gray-500' : 'bg-brand-black text-white dark:bg-brand-white dark:text-black hover:opacity-90'}`}>
                    {isFollowing ? 'Linked' : 'Link Signal'}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">{profile.displayName}</h1>
                <p className="text-brand-gray-500 font-black tracking-[0.3em] text-xs mt-2 uppercase opacity-50">@{profile.username}</p>
              </div>
              {profile.isOnline && <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>}
            </div>
            <p className="text-xl text-brand-gray-700 dark:text-brand-gray-300 font-medium max-w-2xl leading-relaxed tracking-tight">{profile.bio || "Secure identity. Bio encrypted."}</p>
            <div className="flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest text-brand-gray-400">
              {profile.website && (
                <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 hover:text-brand-black dark:hover:text-brand-white transition-colors">
                  <LinkIcon size={14} />
                  <span>{profile.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              <div className="flex items-center space-x-2">
                <Calendar size={14} />
                <span>Uplinked {profile.createdAt ? format(profile.createdAt.toDate(), 'MMM yyyy') : 'Recent'}</span>
              </div>
            </div>

            <div className="flex space-x-12 py-8 border-y border-brand-gray-50 dark:border-brand-gray-900/50 mt-10 overflow-x-auto scrollbar-hide">
              <div className="text-left flex-shrink-0">
                <p className="text-3xl font-black italic tracking-tighter">{formatCount(profile.postsCount || 0)}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gray-400 mt-1">Posts</p>
              </div>
              <button onClick={() => setUserListConfig({ type: 'Followers', isOpen: true })} className="text-left flex-shrink-0 group">
                <p className="text-3xl font-black italic tracking-tighter group-hover:scale-105 transition-transform">{formatCount(profile.followersCount || 0)}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gray-400 mt-1 group-hover:text-brand-black dark:group-hover:text-brand-white transition-colors">Followers</p>
              </button>
              <button onClick={() => setUserListConfig({ type: 'Following', isOpen: true })} className="text-left flex-shrink-0 group">
                <p className="text-3xl font-black italic tracking-tighter group-hover:scale-105 transition-transform">{formatCount(profile.followingCount || 0)}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gray-400 mt-1 group-hover:text-brand-black dark:group-hover:text-brand-white transition-colors">Following</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 flex border-b border-brand-gray-50 dark:border-brand-gray-900/50 px-8 overflow-x-auto scrollbar-hide">
        {[
          { label: 'Posts', icon: Grid },
          { label: 'Reels', icon: Play },
          { label: 'Likes', icon: Heart },
          { label: 'Saved', icon: Bookmark },
        ].map(tab => {
          if ((tab.label === 'Saved' || tab.label === 'Likes') && !isOwnProfile) return null;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label as ProfileTab)}
              className={`flex-1 min-w-[100px] py-6 flex items-center justify-center space-x-3 transition-all font-black text-[10px] uppercase tracking-[0.2em] border-b-4 ${activeTab === tab.label ? 'border-brand-black dark:border-brand-white text-brand-black dark:text-brand-white' : 'border-transparent text-brand-gray-300'}`}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-8 space-y-12">
        {posts.length > 0 ? (
          posts.map((post, idx) => (
            <div key={post.id} ref={idx === posts.length - 1 ? lastPostRef : null} className="animate-in fade-in slide-in-from-bottom-4">
              <PostCard post={post} />
            </div>
          ))
        ) : (
          <div className="py-32 text-center text-brand-gray-300 bg-brand-gray-50 dark:bg-brand-gray-950/30 rounded-[3rem] border-2 border-dashed border-brand-gray-100 dark:border-brand-gray-900">
            <FileText size={64} className="mx-auto mb-6 opacity-5" />
            <p className="font-black italic text-sm tracking-[0.4em] uppercase opacity-20">Silent frequency.</p>
          </div>
        )}
        {loadingMore && <div className="text-center py-10"><Loader2 size={32} className="animate-spin text-brand-black dark:text-brand-white mx-auto" /></div>}
      </div>

      <EditProfileModal 
        profile={profile} 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onUpdate={(updated) => setProfile(prev => prev ? { ...prev, ...updated } : null)} 
      />
      <UserListModal 
        userId={profile.uid} 
        type={userListConfig.type} 
        isOpen={userListConfig.isOpen} 
        onClose={() => setUserListConfig(prev => ({ ...prev, isOpen: false }))} 
      />
    </div>
  );
};

export default Profile;
