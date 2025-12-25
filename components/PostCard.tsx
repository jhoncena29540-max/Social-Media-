
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Send, Globe, Users, 
  Copy, Check, Edit3, Trash2, ArrowUp, X, MessageSquareShare, Eye, Tag, Hash, Loader2
} from 'lucide-react';
import { Post, Comment, PostType } from '../types.ts';
import { auth, db } from '../firebase.ts';
import * as firestoreModule from 'firebase/firestore';

const { 
  doc, updateDoc, increment, collection, addDoc, serverTimestamp, 
  getDoc, setDoc, deleteDoc, where, limit, startAfter, 
  getDocs, query, onSnapshot, orderBy 
} = firestoreModule as any;
type QueryDocumentSnapshot = any;

interface PostCardProps {
  post: Post;
}

const PostCard: React.FC<PostCardProps> = ({ post: initialPost }) => {
  const [post, setPost] = useState(initialPost);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [viewsCount, setViewsCount] = useState(post.viewsCount || 0);
  const [showComments, setShowComments] = useState(false);
  const hasIncrementedView = useRef(false);
  
  const [rawComments, setRawComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, 'likes', `${auth.currentUser.uid}_${post.id}`)).then((snap: any) => setIsLiked(snap.exists()));
    getDoc(doc(db, 'saved_posts', `${auth.currentUser.uid}_${post.id}`)).then((snap: any) => setIsSaved(snap.exists()));
  }, [post.id]);

  useEffect(() => {
    let timer: any;
    if (auth.currentUser && !hasIncrementedView.current) {
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
  }, [post.id]);

  // Load comments in real-time when visible
  useEffect(() => {
    if (!showComments) return;
    const q = query(
      collection(db, 'comments'),
      where('postId', '==', post.id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap: any) => {
      setRawComments(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [showComments, post.id]);

  const handleLike = async () => {
    if (!auth.currentUser) return;
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

        // Notify author
        if (post.authorId !== auth.currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: post.authorId,
            senderId: auth.currentUser.uid,
            senderUsername: auth.currentUser.displayName || 'Anonymous',
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
    if (!auth.currentUser || !newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const commentData = {
        postId: post.id,
        authorId: auth.currentUser.uid,
        authorUsername: auth.currentUser.displayName || 'Anonymous',
        authorPhotoURL: auth.currentUser.photoURL || '',
        content: newComment.trim(),
        likesCount: 0,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'comments'), commentData);
      await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(1) });
      
      // Notify author
      if (post.authorId !== auth.currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: post.authorId,
          senderId: auth.currentUser.uid,
          senderUsername: auth.currentUser.displayName || 'Anonymous',
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
    const url = `${window.location.origin}/u/${post.authorUsername}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToggle = async () => {
    if (!auth.currentUser) return;
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
    if (!window.confirm("Broadcast will be permanently deleted. Proceed?")) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      window.location.reload(); 
    } catch (err) { console.error(err); }
  };

  return (
    <article className="bg-brand-white dark:bg-brand-gray-950 border border-brand-gray-200 dark:border-brand-gray-800 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-700">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-gray-100 dark:bg-brand-gray-800 border-2 border-brand-white dark:border-brand-black shadow-sm">
            <img src={post.authorPhotoURL} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <p className="font-black text-xs uppercase tracking-[0.15em]">@{post.authorUsername}</p>
              {post.category && (
                <span className="px-2 py-0.5 bg-brand-black dark:bg-brand-white text-white dark:text-brand-black rounded-full text-[8px] font-black uppercase tracking-widest">
                  {post.category}
                </span>
              )}
            </div>
            <p className="text-[9px] text-brand-gray-400 font-black uppercase tracking-widest italic mt-0.5">
              {post.createdAt ? formatDistanceToNow(post.createdAt.toDate()) + ' ago' : 'Live'}
            </p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-all">
            <MoreHorizontal size={22} />
          </button>
          {showMenu && (
             <div className="absolute right-0 mt-3 w-56 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-3xl shadow-2xl z-50 py-3 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <button onClick={handleCopyLink} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 flex items-center space-x-4">
                   {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />} 
                   <span>{copied ? 'Copied Link' : 'Copy Node URL'}</span>
                </button>
                {auth.currentUser?.uid === post.authorId && (
                  <button onClick={handleDeletePost} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 flex items-center space-x-4 text-red-500">
                    <Trash2 size={16} /> <span>Purge Signal</span>
                  </button>
                )}
             </div>
          )}
        </div>
      </div>

      <div className="px-8 pb-4">
        <p className="whitespace-pre-wrap text-lg font-medium mb-4 leading-relaxed tracking-tight">{post.content}</p>
        
        {/* Topic Tags Display */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {post.tags.map(tag => (
              <span key={tag} className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white cursor-pointer transition-colors">
                <Hash size={10} />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        )}

        {post.mediaURL && (
          <div className="rounded-[2rem] overflow-hidden border border-brand-gray-100 dark:border-brand-gray-900 group/media relative shadow-inner bg-brand-gray-50 dark:bg-brand-gray-900">
            {post.type === PostType.VIDEO || post.type === PostType.REEL ? (
              <video src={post.mediaURL} controls className="w-full max-h-[700px]" />
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
            className={`flex items-center space-x-2.5 transition-all duration-300 relative ${isLiked ? 'text-red-500' : 'text-brand-gray-400 hover:text-red-500'}`}
          >
            <div className={`transition-transform duration-300 ${likeAnimating ? 'scale-150' : 'scale-100'}`}>
              <Heart size={24} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 0 : 2} />
            </div>
            <span className="text-[11px] font-black italic">{likesCount}</span>
          </button>
          <button onClick={() => setShowComments(!showComments)} className={`flex items-center space-x-2.5 transition-all ${showComments ? 'text-brand-black dark:text-brand-white' : 'text-brand-gray-400'}`}>
            <MessageCircle size={24} />
            <span className="text-[11px] font-black italic">{post.commentsCount}</span>
          </button>
          <div className="flex items-center space-x-2.5 text-brand-gray-400 cursor-default">
            <Eye size={22} />
            <span className="text-[11px] font-black italic">{viewsCount}</span>
          </div>
          <button className="text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-all">
            <Share2 size={24} />
          </button>
        </div>
        <button onClick={handleSaveToggle} className={`${isSaved ? 'text-brand-black dark:text-brand-white' : 'text-brand-gray-400'}`}>
          <Bookmark size={24} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {showComments && (
        <div className="px-8 py-8 border-t border-brand-gray-100 dark:border-brand-gray-900 bg-brand-gray-50 dark:bg-brand-gray-950/40 animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleCommentSubmit} className="flex flex-col space-y-3 mb-10">
            <div className="flex items-center space-x-4">
              <input 
                value={newComment} 
                onChange={e => setNewComment(e.target.value)} 
                placeholder="Secure transmission..." 
                className="flex-1 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-[1.5rem] px-6 py-4 text-sm outline-none shadow-inner" 
              />
              <button disabled={!newComment.trim() || submittingComment} className="p-4 bg-brand-black dark:bg-brand-white text-white dark:text-black rounded-2xl shadow-xl disabled:opacity-20 transition-all active:scale-95">
                {submittingComment ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </form>

          <div className="space-y-6">
            {rawComments.map(comment => (
              <div key={comment.id} className="flex space-x-4 group">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-gray-200 dark:bg-brand-gray-800 flex-shrink-0">
                  <img src={comment.authorPhotoURL} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="bg-brand-white dark:bg-brand-gray-900 p-4 rounded-2xl border border-brand-gray-100 dark:border-brand-gray-800 shadow-sm">
                    <p className="font-black text-[10px] uppercase tracking-widest mb-1">@{comment.authorUsername}</p>
                    <p className="text-sm font-medium leading-relaxed">{comment.content}</p>
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-brand-gray-400 mt-2 ml-2">
                    {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate()) + ' ago' : 'Sending...'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default PostCard;
