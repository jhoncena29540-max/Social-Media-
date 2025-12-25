
import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { db } from '../firebase';
// Fix: Use namespaced import for firestore
import * as firestoreModule from 'firebase/firestore';
import { Post } from '../types';

const { doc, updateDoc } = firestoreModule as any;

interface EditPostModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (newContent: string) => void;
}

const EditPostModal: React.FC<EditPostModalProps> = ({ post, isOpen, onClose, onUpdate }) => {
  const [content, setContent] = useState(post.content);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, { content });
      onUpdate(content);
      onClose();
    } catch (err) {
      console.error("Failed to update post:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-brand-white dark:bg-brand-black w-full max-w-lg rounded-3xl border border-brand-gray-200 dark:border-brand-gray-800 shadow-2xl animate-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-brand-gray-100 dark:border-brand-gray-900">
          <h2 className="text-xl font-black italic tracking-tighter uppercase">Edit Broadcast</h2>
          <button onClick={onClose} className="p-2 hover:bg-brand-gray-100 dark:hover:bg-brand-gray-900 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full bg-brand-gray-50 dark:bg-brand-gray-900 border border-brand-gray-200 dark:border-brand-gray-800 rounded-2xl p-4 focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all resize-none font-medium"
          />
        </div>
        <div className="p-6 border-t border-brand-gray-100 dark:border-brand-gray-900 flex justify-end space-x-3">
          <button onClick={onClose} className="px-6 py-2 font-bold text-brand-gray-500">Cancel</button>
          <button 
            onClick={handleSave}
            disabled={loading || content === post.content}
            className="bg-brand-black dark:bg-brand-white text-white dark:text-black px-8 py-2 rounded-xl font-black flex items-center space-x-2 disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" /> : <Save size={18} />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPostModal;