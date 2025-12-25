
import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Heart, MessageCircle, Edit3, Trash2, 
  CornerDownRight, Send, X, Loader2, ShieldAlert,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Comment } from '../types.ts';
import { auth, db } from '../firebase.ts';
import * as firestoreModule from 'firebase/firestore';

const { 
  doc, updateDoc, increment, collection, addDoc, serverTimestamp, 
  getDoc, setDoc, deleteDoc, where, limit, query, onSnapshot, orderBy 
} = firestoreModule as any;

interface CommentItemProps {
  comment: Comment;
  postId: string;
  onDelete: (id: string) => void;
  onFlag: (id: string) => void;
  depth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, postId, onDelete, onFlag, depth = 0 }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [hasReplies, setHasReplies] = useState(comment.replyCount ? comment.replyCount > 0 : false);

  const isAuthor = auth.currentUser?.uid === comment.authorId;
  const maxDepth = 3;

  useEffect(() => {
    if (!auth.currentUser) return;
    const likeId = `${auth.currentUser.uid}_${comment.id}`;
    getDoc(doc(db, 'comment_likes', likeId)).then((snap: any) => setIsLiked(snap.exists()));
  }, [comment.id]);

  /**
   * RE-ENGINEERED: Index-Free Reply Fetching
   * We only use 'parentId' as the filter. Sorting is done in JS.
   */
  useEffect(() => {
    if (!showReplies) return;
    const q = query(
      collection(db, 'comments'),
      where('parentId', '==', comment.id)
    );
    const unsubscribe = onSnapshot(q, (snap: any) => {
      const fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Comment));
      // Sort in frontend to avoid index requirement
      fetched.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setReplies(fetched);
    });
    return () => unsubscribe();
  }, [showReplies, comment.id]);

  const handleLike = async () => {
    if (!auth.currentUser) return;
    const likeId = `${auth.currentUser.uid}_${comment.id}`;
    const likeRef = doc(db, 'comment_likes', likeId);
    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, 'comments', comment.id), { likesCount: increment(-1) });
        setLikesCount(prev => Math.max(0, prev - 1));
        setIsLiked(false);
      } else {
        await setDoc(likeRef, { userId: auth.currentUser.uid, commentId: comment.id, createdAt: serverTimestamp() });
        await updateDoc(doc(db, 'comments', comment.id), { likesCount: increment(1) });
        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false);
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'comments', comment.id), { 
        content: editContent,
        updatedAt: serverTimestamp() 
      });
      setIsEditing(false);
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || submitting) return;
    setSubmitting(true);
    try {
      const replyData = {
        postId,
        parentId: comment.id,
        authorId: auth.currentUser!.uid,
        authorUsername: auth.currentUser!.displayName || 'User',
        authorPhotoURL: auth.currentUser!.photoURL || '',
        content: replyContent.trim(),
        likesCount: 0,
        createdAt: serverTimestamp(),
        moderationStatus: 'clean'
      };
      await addDoc(collection(db, 'comments'), replyData);
      await updateDoc(doc(db, 'comments', comment.id), { replyCount: increment(1) });
      await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
      setReplyContent('');
      setIsReplying(false);
      setShowReplies(true);
      setHasReplies(true);
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  return (
    <div className={`flex flex-col space-y-3 ${depth > 0 ? 'ml-6 md:ml-10 border-l-2 border-brand-gray-100 dark:border-brand-gray-900 pl-4' : ''}`}>
      <div className="flex space-x-3 group/comment animate-in fade-in slide-in-from-left-2">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-gray-200 dark:bg-brand-gray-800 flex-shrink-0 border border-brand-white dark:border-brand-black shadow-sm">
          <img src={comment.authorPhotoURL} alt="" className="w-full h-full object-cover" />
        </div>
        
        <div className="flex-1">
          <div className="bg-brand-white dark:bg-brand-gray-900 p-4 rounded-2xl border border-brand-gray-100 dark:border-brand-gray-800 shadow-sm relative group/bubble transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-1">
              <p className="font-black text-[10px] uppercase tracking-widest">@{comment.authorUsername}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-brand-gray-400">
                {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate()) + ' ago' : 'Just now'}
              </p>
            </div>

            {isEditing ? (
              <div className="space-y-3 mt-2">
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-brand-gray-50 dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-brand-black"
                  rows={2}
                />
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-brand-gray-400">Cancel</button>
                  <button onClick={handleUpdate} disabled={submitting} className="px-4 py-1 bg-brand-black text-white dark:bg-brand-white dark:text-black rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center space-x-2">
                    {submitting ? <Loader2 size={10} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-sm font-medium leading-relaxed ${comment.moderationStatus === 'flagged' ? 'opacity-50 italic' : ''}`}>
                {comment.content}
              </p>
            )}

            <div className="mt-3 flex items-center space-x-4 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
              <button onClick={handleLike} className={`flex items-center space-x-1.5 transition-colors ${isLiked ? 'text-red-500' : 'text-brand-gray-400 hover:text-red-500'}`}>
                <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 0 : 2.5} />
                <span className="text-[10px] font-black italic">{likesCount}</span>
              </button>
              
              {depth < maxDepth && (
                <button onClick={() => setIsReplying(!isReplying)} className={`flex items-center space-x-1.5 transition-colors ${isReplying ? 'text-brand-black dark:text-brand-white' : 'text-brand-gray-400 hover:text-brand-black'}`}>
                  <MessageCircle size={14} />
                  <span className="text-[10px] font-black italic">Reply</span>
                </button>
              )}

              {isAuthor && !isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-brand-gray-400 hover:text-brand-black transition-colors">
                  <Edit3 size={14} />
                </button>
              )}
              
              {(isAuthor || auth.currentUser?.uid === comment.authorId) && (
                <button onClick={() => onDelete(comment.id)} className="text-brand-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}

              {!isAuthor && (
                <button onClick={() => onFlag(comment.id)} className="text-brand-gray-400 hover:text-orange-500 transition-colors">
                  <ShieldAlert size={14} />
                </button>
              )}
            </div>
          </div>

          {isReplying && (
            <form onSubmit={handleReply} className="mt-4 flex items-center space-x-3 animate-in slide-in-from-top-2">
              <div className="w-1 h-8 bg-brand-gray-100 dark:bg-brand-gray-800 rounded-full" />
              <input 
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 bg-brand-gray-50 dark:bg-brand-gray-950 border border-brand-gray-100 dark:border-brand-gray-900 rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-brand-black"
                autoFocus
              />
              <button disabled={!replyContent.trim() || submitting} className="p-2 bg-brand-black text-white rounded-xl shadow-lg disabled:opacity-20">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
              <button type="button" onClick={() => setIsReplying(false)} className="p-2 text-brand-gray-400"><X size={14} /></button>
            </form>
          )}

          {hasReplies && (
            <button 
              onClick={() => setShowReplies(!showReplies)}
              className="mt-3 ml-2 flex items-center space-x-2 text-[9px] font-black uppercase tracking-[0.2em] text-brand-gray-400 hover:text-brand-black transition-colors"
            >
              <div className="w-4 h-px bg-brand-gray-200 dark:bg-brand-gray-800" />
              {showReplies ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              <span>{showReplies ? 'Hide Replies' : `Show Replies (${comment.replyCount})`}</span>
            </button>
          )}
        </div>
      </div>

      {showReplies && (
        <div className="space-y-4">
          {replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              postId={postId} 
              onDelete={onDelete} 
              onFlag={onFlag} 
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;
