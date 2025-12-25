
import React, { useState, useRef } from 'react';
import * as firestoreModule from 'firebase/firestore';
import * as storageModule from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { 
  Image, Video, FileText, Send, X, Type as TextIcon, 
  PlayCircle, Globe, Users, ChevronDown, Sparkles, 
  Loader2, Hash, Wand2, Tag 
} from 'lucide-react';
import { PostType } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const { collection, addDoc, serverTimestamp, doc, updateDoc, increment, Timestamp, query, where, getDocs, limit } = firestoreModule as any;
const { ref, uploadBytes, getDownloadURL } = storageModule as any;

const CreatePost: React.FC = () => {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [postType, setPostType] = useState<PostType>(PostType.TEXT);
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categories = ['General', 'Tech', 'Design', 'Grid', 'Intel', 'Visual'];

  const suggestTags = async () => {
    if (!content.trim()) return;
    setAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this social media post content and suggest 3-5 relevant short topic tags for a high-performance discovery engine. Post content: "${content}". Output only as a JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      const suggested = JSON.parse(response.text || "[]");
      setTags(Array.from(new Set([...tags, ...suggested])));
    } catch (err) {
      console.error("AI Tagging Error:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMedia(file);
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
      setPostType(file.type.startsWith('video/') ? PostType.VIDEO : PostType.IMAGE);
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
    setPostType(PostType.TEXT);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^#/, '');
      if (!tags.includes(newTag)) setTags([...tags, newTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleMentions = async (postContent: string, postId: string) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = postContent.match(mentionRegex);
    if (!mentions || !auth.currentUser) return;

    for (const mention of mentions) {
      const username = mention.slice(1).toLowerCase();
      if (username === auth.currentUser.displayName?.toLowerCase()) continue;

      try {
        const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const recipientId = snap.docs[0].id;
          await addDoc(collection(db, 'notifications'), {
            recipientId,
            senderId: auth.currentUser.uid,
            senderUsername: auth.currentUser.displayName || 'Anonymous',
            senderPhotoURL: auth.currentUser.photoURL || '',
            type: 'mention',
            postId,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.error("Mention notify failed:", err);
      }
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser || (!content && !selectedMedia)) return;

    setUploading(true);
    try {
      let mediaURL = '';
      if (selectedMedia) {
        const mediaRef = ref(storage, `posts/${auth.currentUser.uid}/${Date.now()}_${selectedMedia.name}`);
        const snapshot = await uploadBytes(mediaRef, selectedMedia);
        mediaURL = await getDownloadURL(snapshot.ref);
      }

      const postData = {
        authorId: auth.currentUser.uid,
        authorUsername: auth.currentUser.displayName || 'user',
        authorPhotoURL: auth.currentUser.photoURL || '',
        type: postType,
        category,
        tags,
        content,
        mediaURL,
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: serverTimestamp(),
        isPublished: true,
        visibility: visibility
      };

      const docRef = await addDoc(collection(db, 'posts'), postData);
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { postsCount: increment(1) });

      // Detect Mentions
      await handleMentions(content, docRef.id);

      setContent('');
      setCategory('General');
      setTags([]);
      removeMedia();
    } catch (error) {
      console.error("Signal Broadcast Failure:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-brand-white dark:bg-brand-gray-950 border border-brand-gray-200 dark:border-brand-gray-800 rounded-[2.5rem] p-8 shadow-2xl mb-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-black via-brand-gray-300 to-brand-black dark:from-brand-white dark:via-brand-gray-700 dark:to-brand-white opacity-10" />
      
      <div className="flex bg-brand-gray-50 dark:bg-brand-gray-900/50 p-2 rounded-2xl mb-8 space-x-1 border border-brand-gray-100 dark:border-brand-gray-800 overflow-x-auto scrollbar-hide">
        {[
          { type: PostType.TEXT, icon: TextIcon, label: 'Standard' },
          { type: PostType.IMAGE, icon: Image, label: 'Visual' },
          { type: PostType.VIDEO, icon: Video, label: 'Cinema' },
          { type: PostType.ARTICLE, icon: FileText, label: 'Intel' },
        ].map((t) => (
          <button
            key={t.type}
            onClick={() => { 
              setPostType(t.type); 
              if (t.type === PostType.IMAGE || t.type === PostType.VIDEO) fileInputRef.current?.click(); 
            }}
            className={`flex-shrink-0 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              postType === t.type 
                ? 'bg-brand-black dark:bg-brand-white text-white dark:text-black shadow-lg' 
                : 'text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white'
            }`}
          >
            <t.icon size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex space-x-6 md:space-x-8">
        <div className="w-14 h-14 rounded-full bg-brand-gray-200 dark:bg-brand-gray-800 overflow-hidden flex-shrink-0 border-2 border-brand-white dark:border-brand-black shadow-lg">
          {auth.currentUser?.photoURL && <img src={auth.currentUser.photoURL} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative">
              <button 
                onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                className="flex items-center space-x-3 px-4 py-2 bg-brand-gray-50 dark:bg-brand-gray-900 border border-brand-gray-200 dark:border-brand-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-brand-gray-600 hover:text-brand-black dark:hover:text-brand-white transition-all shadow-sm"
              >
                {visibility === 'public' ? <Globe size={14} /> : <Users size={14} />}
                <span>{visibility === 'public' ? 'Public' : 'Followers'}</span>
                <ChevronDown size={12} className={showVisibilityMenu ? 'rotate-180' : ''} />
              </button>
              {showVisibilityMenu && (
                <div className="absolute top-full left-0 mt-3 w-48 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <button onClick={() => { setVisibility('public'); setShowVisibilityMenu(false); }} className="w-full flex items-center space-x-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 border-b border-brand-gray-50 dark:border-brand-gray-900">
                    <Globe size={16} /> <span>Public</span>
                  </button>
                  <button onClick={() => { setVisibility('followers'); setShowVisibilityMenu(false); }} className="w-full flex items-center space-x-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900">
                    <Users size={16} /> <span>Followers</span>
                  </button>
                </div>
              )}
            </div>

            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              className="px-4 py-2 bg-brand-gray-50 dark:bg-brand-gray-900 border border-brand-gray-200 dark:border-brand-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-brand-gray-600 outline-none focus:ring-1 focus:ring-brand-black dark:focus:ring-brand-white transition-all cursor-pointer"
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Broadcast your signal..."
            className="w-full bg-transparent border-none resize-none focus:ring-0 text-xl font-medium min-h-[100px] placeholder:text-brand-gray-300 dark:placeholder:text-brand-gray-700 leading-relaxed tracking-tight"
          />

          {/* Tags Section */}
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="flex items-center space-x-2 px-3 py-1 bg-brand-black dark:bg-brand-white text-white dark:text-black rounded-full text-[9px] font-black uppercase tracking-widest">
                <Hash size={10} />
                <span>{tag}</span>
                <button onClick={() => removeTag(tag)} className="hover:opacity-50"><X size={10}/></button>
              </span>
            ))}
            <div className="flex items-center space-x-2">
              <input 
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
                placeholder="Add topic..."
                className="bg-transparent border-none focus:ring-0 text-[10px] font-black uppercase tracking-widest p-1 w-24 placeholder:text-brand-gray-400"
              />
              <button 
                onClick={suggestTags}
                disabled={analyzing || !content}
                className={`p-2 rounded-full transition-all ${analyzing ? 'animate-spin text-brand-gray-400' : 'text-brand-black dark:text-brand-white hover:bg-brand-gray-100 dark:hover:bg-brand-gray-900'}`}
                title="AI Topic Analysis"
              >
                {analyzing ? <Loader2 size={14} /> : <Wand2 size={14} />}
              </button>
            </div>
          </div>

          {mediaPreview && (
            <div className="relative mt-6 rounded-[2rem] overflow-hidden border border-brand-gray-100 dark:border-brand-gray-800 bg-brand-gray-50 dark:bg-brand-gray-900">
              {selectedMedia?.type.startsWith('image/') ? (
                <img src={mediaPreview} className="w-full h-auto max-h-[300px] object-cover" alt="" />
              ) : (
                <video src={mediaPreview} controls className="w-full max-h-[300px]" />
              )}
              <button onClick={removeMedia} className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-brand-black transition-all">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-brand-gray-50 dark:border-brand-gray-900/50 pt-8">
            <div className="flex items-center space-x-2 opacity-30">
              <Tag size={14} />
              <p className="text-[9px] font-black uppercase tracking-widest">Topic Authenticated</p>
            </div>
            <button 
              onClick={handleSubmit} 
              disabled={uploading || (!content && !selectedMedia)} 
              className="bg-brand-black dark:bg-brand-white text-white dark:text-black px-12 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:opacity-90 active:scale-95 disabled:opacity-20 transition-all flex items-center space-x-3"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span>{uploading ? 'Transmitting...' : 'Broadcast'}</span>
            </button>
          </div>
        </div>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleMediaSelect} className="hidden" accept="image/*,video/*" />
    </div>
  );
};

export default CreatePost;
