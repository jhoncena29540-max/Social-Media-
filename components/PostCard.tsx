
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Send, Globe, Users, 
  Copy, Check, Edit3, Trash2, ArrowUp, X, MessageSquareShare, Eye, Tag, Hash, Loader2, Clock, ShieldAlert,
  ArrowUpDown
} from 'lucide-react';
import { Post, Comment, PostType, UserRole } from '../types.ts';
import { auth, db } from '../firebase.ts';
import * as firestoreModule from 'firebase/firestore';
import EditPostModal from './EditPostModal.tsx';
import CommentItem from './CommentItem.tsx';

const { 
  doc, updateDoc, increment, collection, addDoc, serverTimestamp, 
  getDoc, setDoc, deleteDoc, where, limit, startAfter, 
  getDocs, query, onSnapshot, orderBy 
} = firestoreModule as any;

interface PostCardProps {
  post: Post;
}

type SortOption = 'latest' | 'relevant';

const PostCard: React.FC<PostCardProps> = ({ post: initialPost }) => {
  const [post, setPost] = useState(initialPost);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [viewsCount, setViewsCount] = useState(post.viewsCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const hasIncrementedView = useRef(false);
  
  const [rawComments, setRawComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sorting and Lazy Loading for comments
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [loadingComments, setLoadingComments] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [lastCommentDoc, setLastCommentDoc] = useState<any>(null);

  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  const isFuture = useMemo(() => {
    return post.scheduledAt && post.scheduledAt.toMillis() > Date.now();
  }, [post.scheduledAt]);

  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, 'likes', `${auth.currentUser.uid}_${post.id}`)).then((snap: any) => setIsLiked(snap.exists()));
    getDoc(doc(db, 'saved_posts', `${auth.currentUser.uid}_${post.id}`)).then((snap: any) => setIsSaved(snap.exists()));
    getDoc(doc(db, 'users', auth.currentUser.uid)).then((snap: any) => {
      if (snap.exists()) setUserRole(snap.data().role || UserRole.USER);
    });
  }, [post.id]);

  useEffect(() => {
    let timer: any;
    if (auth.currentUser && !hasIncrementedView.current && !isFuture) {
      timer = setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'posts', post.id), { viewsCount: increment(1) });
          await updateDoc(doc(db, 'users', post.authorId), { viewsReceived: increment(1) });
          setViewsCount(prev => prev + 1);
          hasIncrementedView.current = true;
        } catch (err) {}
      }, 3000); 
    }
    return () => clearTimeout(timer);
  }, [post.id, isFuture]);

  /**
   * RE-ENGINEERED: Index-Free Comment Fetching
   * We avoid composite index requirements by using only one where clause.
   */
  const fetchComments = useCallback(async (isInitial = true) => {
    if (!showComments) return;
    setLoadingComments(true);
    try {
      const commentLimit = 30;
      let q = query(
        collection(db, 'comments'),
        where('postId', '==', post.id),
        limit(commentLimit)
      );

      if (!isInitial && lastCommentDoc) {
        q = query(q, startAfter(lastCommentDoc));
      }

      const snap = await getDocs(q);
      const allFetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Comment));
      
      // Filter for top-level comments and sort manually in memory to avoid index requirements
      const topLevel = allFetched.filter(c => !c.parentId);
      topLevel.sort((a, b) => {
        if (sortBy === 'latest') {
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        } else {
          return (b.likesCount || 0) - (a.likesCount || 0);
        }
      });

      if (isInitial) {
        setRawComments(topLevel);
      } else {
        setRawComments(prev => [...prev, ...topLevel]);
      }
      
      setLastCommentDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMoreComments(snap.docs.length === commentLimit);
    } catch (err) {
      console.error("Index-free comment fetch failed:", err);
    } finally {
      setLoadingComments(false);
    }
  }, [post.id, showComments, sortBy, lastCommentDoc]);

  useEffect(() => {
    if (showComments) fetchComments(true);
    else {
      setRawComments([]);
      setLastCommentDoc(null);
      setHasMoreComments(true);
    }
  }, [showComments, sortBy]);

  const handleLike = async () => {
    if (!auth.currentUser || isFuture) return;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
    const likeId = `${auth.currentUser.uid}_${post.id}`;
    const likeRef = doc(db, 'likes', likeId);
    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, 'posts', post.id), { likesCount: increment(-1) });
        await updateDoc(doc(db, 'users', post.authorId), { likesReceived: increment(-1) });
        setLikesCount(prev => Math.max(0, prev - 1));
        setIsLiked(false);
      } else {
        await setDoc(likeRef, { userId: auth.currentUser.uid, postId: post.id, createdAt: serverTimestamp() });
        await updateDoc(doc(db, 'posts', post.id), { likesCount: increment(1) });
        await updateDoc(doc(db, 'users', post.authorId), { likesReceived: increment(1) });
        setLikesCount(prev => prev + 1);
        setIsLiked(true);

        if (post.authorId !== auth.currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: post.authorId,
            senderId: auth.currentUser.uid,
            senderUsername: auth.currentUser.displayName || 'Someone',
            senderPhotoURL: auth.currentUser.photoURL || '',
            type: 'like',
            postId: post.id,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (err) { console.error(err); }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newComment.trim() || submittingComment || isFuture) return;

    setSubmittingComment(true);
    try {
      const commentData = {
        postId: post.id,
        parentId: null,
        authorId: auth.currentUser.uid,
        authorUsername: auth.currentUser.displayName || 'Someone',
        authorPhotoURL: auth.currentUser.photoURL || '',
        content: newComment.trim(),
        likesCount: 0,
        replyCount: 0,
        createdAt: serverTimestamp(),
        moderationStatus: 'clean'
      };

      const docRef = await addDoc(collection(db, 'comments'), commentData);
      await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(1) });
      
      const newCommentObj = { id: docRef.id, ...commentData, createdAt: { toDate: () => new Date(), toMillis: () => Date.now() } } as any;
      setRawComments(prev => [newCommentObj, ...prev]);

      if (post.authorId !== auth.currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: post.authorId,
          senderId: auth.currentUser.uid,
          senderUsername: auth.currentUser.displayName || 'Someone',
          senderPhotoURL: auth.currentUser.photoURL || '',
          type: 'comment',
          postId: post.id,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setNewComment('');
    } catch (err) {
      console.error("Comment failed:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/#/u/${post.authorUsername}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToggle = async () => {
    if (!auth.currentUser || isFuture) return;
    const saveId = `${auth.currentUser.uid}_${post.id}`;
    const saveRef = doc(db, 'saved_posts', saveId);
    try {
      const snap = await getDoc(saveRef);
      if (snap.exists()) { await deleteDoc(saveRef); setIsSaved(false); }
      else { 
        await setDoc(saveRef, { userId: auth.currentUser.uid, postId: post.id, authorId: post.authorId, createdAt: serverTimestamp() });
        setIsSaved(true);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeletePost = async () => {
    if (!window.confirm("ARE YOU SURE? This post will be permanently removed.")) return;
    setIsRemoving(true);
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      await updateDoc(doc(db, 'users', auth.currentUser!.uid), { postsCount: increment(-1) });
    } catch (err) { 
      console.error("Deletion failed:", err);
      setIsRemoving(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Remove this comment?")) return;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
      await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(-1) });
      setRawComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) { console.error(err); }
  };

  const handleFlagComment = async (commentId: string) => {
    try {
      await updateDoc(doc(db, 'comments', commentId), { moderationStatus: 'flagged' });
      alert("Comment flagged for review.");
    } catch (err) { console.error(err); }
  };

  const isModerator = userRole === UserRole.MODERATOR || userRole === UserRole.ADMIN;
  const isAuthor = auth.currentUser?.uid === post.authorId;

  if (isRemoving) {
    return (
      <div className="animate-out fade-out slide-out-to-right-10 duration-500 overflow-hidden h-0 opacity-0 transform scale-95" />
    );
  }

  return (
    <article className={`bg-brand-white dark:bg-brand-gray-950 border border-brand-gray-200 dark:border-brand-gray-800 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-700 transform hover:-translate-y-1 ${isFuture ? 'opacity-70' : ''}`}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-gray-100 dark:bg-brand-gray-800 border-2 border-brand-white dark:border-brand-black shadow-sm transform transition-transform hover:scale-105">
            <img src={post.authorPhotoURL} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <p className="font-black text-xs uppercase tracking-[0.15em] hover:underline cursor-pointer">@{post.authorUsername}</p>
              {post.category && (
                <span className="px-2 py-0.5 bg-brand-black dark:bg-brand-white text-white dark:text-brand-black rounded-full text-[8px] font-black uppercase tracking-widest">
                  {post.category}
                </span>
              )}
              {isFuture && (
                <span className="px-2 py-0.5 bg-brand-gray-100 text-brand-black rounded-full text-[8px] font-black uppercase tracking-widest flex items-center">
                  <Clock size={8} className="mr-1" /> Scheduled
                </span>
              )}
            </div>
            <p className="text-[9px] text-brand-gray-400 font-black uppercase tracking-widest italic mt-0.5">
              {isFuture ? (
                `Will post ${format(post.scheduledAt.toDate(), 'MMM d, HH:mm')}`
              ) : (
                post.createdAt ? formatDistanceToNow(post.createdAt.toDate()) + ' ago' : 'Just now'
              )}
            </p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-all transform active:scale-90">
            <MoreHorizontal size={22} />
          </button>
          {showMenu && (
             <div className="absolute right-0 mt-3 w-56 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-3xl shadow-2xl z-50 py-3 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <button onClick={handleCopyLink} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 flex items-center space-x-4">
                   {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />} 
                   <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
                </button>
                {isAuthor && (
                  <button onClick={() => { setIsEditModalOpen(true); setShowMenu(false); }} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 flex items-center space-x-4">
                    <Edit3 size={16} /> <span>Edit Post</span>
                  </button>
                )}
                {(isAuthor || isModerator) && (
                  <button onClick={handleDeletePost} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 flex items-center space-x-4 text-red-500">
                    <Trash2 size={16} /> <span>Remove Post</span>
                  </button>
                )}
             </div>
          )}
        </div>
      </div>

      <div className="px-8 pb-4">
        <p className="whitespace-pre-wrap text-lg font-medium mb-4 leading-relaxed tracking-tight">{post.content}</p>
        
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {post.tags.map(tag => (
              <span key={tag} className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white cursor-pointer transition-colors px-2 py-1 bg-brand-gray-50 dark:bg-brand-gray-900 rounded-lg">
                <Hash size={10} />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        )}

        {post.mediaURL && (
          <div className="rounded-[2rem] overflow-hidden border border-brand-gray-100 dark:border-brand-gray-900 group/media relative shadow-inner bg-brand-gray-50 dark:bg-brand-gray-900 mb-4">
            {post.type === PostType.VIDEO || post.type === PostType.REEL ? (
              <video src={post.mediaURL} controls className="w-full max-h-[700px] object-contain bg-black" />
            ) : (
              <img src={post.mediaURL} alt="" className="w-full h-auto max-h-[700px] object-cover transition-transform duration-1000 group-hover/media:scale-105" />
            )}
          </div>
        )}
      </div>

      <div className="px-8 py-5 border-t border-brand-gray-50 dark:border-brand-gray-900/50 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <button 
            onClick={handleLike} 
            disabled={isFuture}
            className={`flex items-center space-x-2.5 transition-all duration-300 relative ${isLiked ? 'text-red-500' : 'text-brand-gray-400 hover:text-red-500'} ${isFuture ? 'opacity-30' : ''}`}
          >
            <div className={`transition-transform duration-300 ${likeAnimating ? 'scale-150' : 'scale-100'}`}>
              <Heart size={24} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 0 : 2} />
            </div>
            <span className="text-[11px] font-black italic">{likesCount}</span>
          </button>
          <button 
            onClick={() => !isFuture && setShowComments(!showComments)} 
            className={`flex items-center space-x-2.5 transition-all ${showComments ? 'text-brand-black dark:text-brand-white' : 'text-brand-gray-400'} ${isFuture ? 'opacity-30' : ''}`}
          >
            <MessageCircle size={24} />
            <span className="text-[11px] font-black italic">{post.commentsCount}</span>
          </button>
          <div className="flex items-center space-x-2.5 text-brand-gray-400 cursor-default">
            <Eye size={22} />
            <span className="text-[11px] font-black italic">{viewsCount}</span>
          </div>
          <button className={`text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-all transform active:scale-90 ${isFuture ? 'opacity-30' : ''}`}>
            <Share2 size={24} />
          </button>
        </div>
        <button 
          onClick={handleSaveToggle} 
          disabled={isFuture}
          className={`${isSaved ? 'text-brand-black dark:text-brand-white' : 'text-brand-gray-400'} ${isFuture ? 'opacity-30' : ''} transform active:scale-90`}
        >
          <Bookmark size={24} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {showComments && !isFuture && (
        <div className="px-8 py-8 border-t border-brand-gray-100 dark:border-brand-gray-900 bg-brand-gray-50 dark:bg-brand-gray-950/40 animate-in slide-in-from-top-4 duration-300">
          
          <div className="flex items-center justify-between mb-8">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gray-400">Discussion</p>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setSortBy('latest')} 
                className={`text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'latest' ? 'text-brand-black dark:text-brand-white' : 'text-brand-gray-400'}`}
              >
                Latest
              </button>
              <button 
                onClick={() => setSortBy('relevant')} 
                className={`text-[9px] font-black uppercase tracking-widest transition-colors ${sortBy === 'relevant' ? 'text-brand-black dark:text-brand-white' : 'text-brand-gray-400'}`}
              >
                Relevant
              </button>
              <ArrowUpDown size={12} className="text-brand-gray-400" />
            </div>
          </div>

          <form onSubmit={handleCommentSubmit} className="flex flex-col space-y-3 mb-10">
            <div className="flex items-center space-x-4">
              <input 
                value={newComment} 
                onChange={e => setNewComment(e.target.value)} 
                placeholder="Add a comment..." 
                className="flex-1 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-[1.5rem] px-6 py-4 text-sm outline-none shadow-inner transition-all focus:border-brand-black dark:focus:border-brand-white" 
              />
              <button disabled={!newComment.trim() || submittingComment} className="p-4 bg-brand-black dark:bg-brand-white text-white dark:text-black rounded-2xl shadow-xl disabled:opacity-20 transition-all active:scale-95">
                {submittingComment ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </form>

          <div className="space-y-8">
            {rawComments.map(comment => (
              <CommentItem 
                key={comment.id} 
                comment={comment} 
                postId={post.id}
                onDelete={handleDeleteComment}
                onFlag={handleFlagComment}
              />
            ))}
          </div>

          {hasMoreComments && (
            <div className="mt-12 flex justify-center">
              <button 
                onClick={() => fetchComments(false)} 
                disabled={loadingComments}
                className="px-10 py-4 bg-brand-white dark:bg-brand-black border border-brand-gray-100 dark:border-brand-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-gray-50 transition-all disabled:opacity-50"
              >
                {loadingComments ? <Loader2 size={16} className="animate-spin" /> : 'Load More Comments'}
              </button>
            </div>
          )}
        </div>
      )}
      
      {isEditModalOpen && (
        <EditPostModal 
          post={post} 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
          onUpdate={(updates) => setPost(prev => ({ ...prev, ...updates }))}
          onDelete={() => setIsRemoving(true)}
        />
      )}
    </article>
  );
};

export default PostCard;
