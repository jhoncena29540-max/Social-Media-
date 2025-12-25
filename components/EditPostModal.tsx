
import React, { useState, useRef } from 'react';
import { X, Save, Image as ImageIcon, Video as VideoIcon, Loader2, Trash2, AlertCircle, PlusSquare } from 'lucide-react';
import { db, storage, auth } from '../firebase.ts';
import * as firestoreModule from 'firebase/firestore';
import * as storageModule from 'firebase/storage';
import { Post, PostType } from '../types.ts';

const { doc, updateDoc, deleteDoc, increment } = firestoreModule as any;
const { ref, uploadBytes, getDownloadURL } = storageModule as any;

interface EditPostModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedFields: Partial<Post>) => void;
  onDelete?: () => void;
}

const EditPostModal: React.FC<EditPostModalProps> = ({ post, isOpen, onClose, onUpdate, onDelete }) => {
  const [content, setContent] = useState(post.content);
  const [mediaURL, setMediaURL] = useState(post.mediaURL || '');
  const [postType, setPostType] = useState<PostType>(post.type);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const storageRef = ref(storage, `posts/${post.authorId}/edited_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      setMediaURL(url);
      setPostType(isVideo ? PostType.VIDEO : PostType.IMAGE);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("ARE YOU ABSOLUTELY SURE?\nThis post will be permanently deleted and cannot be recovered.")) return;
    
    setDeleting(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      await deleteDoc(postRef);
      
      const userRef = doc(db, 'users', auth.currentUser!.uid);
      await updateDoc(userRef, { postsCount: increment(-1) });
      
      if (onDelete) onDelete();
      onClose();
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim() && !mediaURL) return;
    setLoading(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      const updates = { 
        content: content.trim(), 
        mediaURL, 
        type: postType 
      };
      await updateDoc(postRef, updates);
      onUpdate(updates);
      onClose();
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = content.trim() !== post.content || mediaURL !== post.mediaURL || postType !== post.type;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-white/90 dark:bg-brand-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
      <div className="bg-brand-white dark:bg-brand-gray-950 w-full max-w-2xl rounded-[3rem] border border-brand-gray-100 dark:border-brand-gray-900 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-10 py-8 border-b border-brand-gray-50 dark:border-brand-gray-900">
          <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Modify Post</h2>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-gray-400 mt-2">Update your presence</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 rounded-full transition-all active:scale-90 text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white">
            <X size={24} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gray-400 ml-4">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What are you thinking?"
              className="w-full bg-brand-gray-50 dark:bg-brand-black border border-brand-gray-100 dark:border-brand-gray-800 rounded-[2.5rem] p-8 focus:border-brand-black dark:focus:border-brand-white outline-none transition-all resize-none font-medium text-xl leading-relaxed shadow-inner min-h-[180px]"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gray-400">Media</label>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 text-[9px] font-black uppercase tracking-widest text-brand-black dark:text-brand-white hover:opacity-60 transition-opacity"
              >
                <ImageIcon size={14} />
                <span>Replace Media</span>
              </button>
            </div>

            {mediaURL ? (
              <div className="relative rounded-[2.5rem] overflow-hidden border border-brand-gray-100 dark:border-brand-gray-800 bg-brand-gray-50 dark:bg-brand-gray-900 group aspect-video flex items-center justify-center shadow-md">
                {postType === PostType.VIDEO || postType === PostType.REEL ? (
                  <video src={mediaURL} controls className="w-full h-full object-contain bg-black" />
                ) : (
                  <img src={mediaURL} alt="" className="w-full h-full object-cover" />
                )}
                
                {uploading && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-md flex flex-col items-center justify-center">
                    <Loader2 size={40} className="animate-spin text-brand-black dark:text-brand-white mb-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Optimizing...</span>
                  </div>
                )}
                
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { setMediaURL(''); setPostType(PostType.TEXT); }}
                    className="p-4 bg-red-500 text-white rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all"
                    title="Remove Media"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-16 border-2 border-dashed border-brand-gray-100 dark:border-brand-gray-900 rounded-[2.5rem] flex flex-col items-center justify-center text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white hover:border-brand-black dark:hover:border-brand-white transition-all bg-brand-gray-50/50 dark:bg-brand-black/10"
              >
                <PlusSquare size={32} className="mb-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Upload New Media</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-10 border-t border-brand-gray-50 dark:border-brand-gray-900 flex flex-col sm:flex-row items-center justify-between gap-6 bg-brand-white dark:bg-brand-gray-950">
          <button 
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-[0.3em] text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 group"
          >
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 group-hover:bg-red-100 transition-colors">
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </div>
            <span>{deleting ? 'Removing...' : 'Delete Permanently'}</span>
          </button>
          
          <div className="flex items-center space-x-6 w-full sm:w-auto">
            <button 
              onClick={onClose} 
              className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={loading || uploading || !hasChanges}
              className="flex-1 sm:flex-none bg-brand-black dark:bg-brand-white text-white dark:text-brand-black px-12 py-5 rounded-[1.5rem] font-black flex items-center justify-center space-x-4 disabled:opacity-20 text-[11px] uppercase tracking-[0.3em] shadow-[0_20px_60px_rgba(0,0,0,0.3)] hover:opacity-90 active:scale-95 transition-all"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{loading ? 'Processing' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleMediaUpload} className="hidden" accept="image/*,video/*" />
    </div>
  );
};

export default EditPostModal;
