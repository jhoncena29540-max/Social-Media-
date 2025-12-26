
import React, { useState, useRef } from 'react';
import * as firestoreModule from 'firebase/firestore';
import * as storageModule from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { 
  Image as ImageIcon, Video as VideoIcon, Send, X, Type as TextIcon, 
  Globe, Users, ChevronDown, 
  Loader2, Hash, Wand2, Clock, Calendar, Check, Layers, BookOpen, Timer, Zap
} from 'lucide-react';
import { PostType } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { addHours, addDays, format, startOfHour, addMinutes } from 'date-fns';

const { collection, addDoc, serverTimestamp, doc, updateDoc, increment, Timestamp, query, where, getDocs, limit } = firestoreModule as any;
const { ref, uploadBytes, getDownloadURL } = storageModule as any;

const CreatePost: React.FC = () => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [postType, setPostType] = useState<PostType>(PostType.TEXT);
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [showScheduler, setShowScheduler] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const postTypes = [
    { type: PostType.TEXT, icon: TextIcon, label: 'Text' },
    { type: PostType.IMAGE, icon: ImageIcon, label: 'Photo' },
    { type: PostType.VIDEO, icon: VideoIcon, label: 'Video' },
    { type: PostType.REEL, icon: Layers, label: 'Reel' },
    { type: PostType.ARTICLE, icon: BookOpen, label: 'Article' },
  ];

  const suggestTags = async () => {
    if (!content.trim()) return;
    setAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this social media post content and suggest 3-5 relevant short topic tags. Content: "${title} ${content}". Output only as a JSON array of strings.`,
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
      console.error("Tagging Error:", err);
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
    if (postType !== PostType.ARTICLE) {
        setPostType(PostType.TEXT);
    }
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

  const setPresetTime = (hours: number) => {
    const target = addHours(new Date(), hours);
    setScheduledAt(format(target, "yyyy-MM-dd'T'HH:mm"));
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

      const scheduleDate = scheduledAt ? new Date(scheduledAt) : null;
      const isFuture = scheduleDate && scheduleDate.getTime() > Date.now();

      const postData: any = {
        authorId: auth.currentUser.uid,
        authorUsername: auth.currentUser.displayName || 'user',
        authorPhotoURL: auth.currentUser.photoURL || '',
        type: postType,
        tags,
        content,
        mediaURL,
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: serverTimestamp(),
        scheduledAt: scheduleDate ? Timestamp.fromDate(scheduleDate) : null,
        isPublished: !isFuture,
        visibility: visibility
      };

      if (postType === PostType.ARTICLE && title) {
        postData.title = title;
      }

      await addDoc(collection(db, 'posts'), postData);
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { postsCount: increment(1) });

      setContent('');
      setTitle('');
      setTags([]);
      setScheduledAt('');
      setShowScheduler(false);
      removeMedia();
    } catch (error) {
      console.error("Posting Failure:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-brand-white dark:bg-brand-gray-950 border border-brand-gray-200 dark:border-brand-gray-800 rounded-[2.5rem] p-8 shadow-2xl mb-12 relative overflow-hidden transition-all">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-black via-brand-gray-300 to-brand-black dark:from-brand-white dark:via-brand-gray-700 dark:to-brand-white opacity-10" />
      
      <div className="mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gray-400 ml-4 mb-4">Select Format</p>
        <div className="inline-flex p-1.5 bg-brand-gray-50 dark:bg-brand-gray-900 border border-brand-gray-100 dark:border-brand-gray-800 rounded-2xl overflow-x-auto scrollbar-hide max-w-full">
          {postTypes.map((t) => (
            <button
              key={t.type}
              onClick={() => { 
                setPostType(t.type); 
                if (t.type === PostType.IMAGE || t.type === PostType.VIDEO || t.type === PostType.REEL) fileInputRef.current?.click(); 
              }}
              className={`flex items-center space-x-3 py-3 px-6 rounded-xl transition-all duration-300 whitespace-nowrap ${
                postType === t.type 
                  ? 'bg-brand-black dark:bg-brand-white text-white dark:text-black shadow-lg scale-100' 
                  : 'text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white'
              }`}
            >
              <t.icon size={16} strokeWidth={postType === t.type ? 2.5 : 2} />
              <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
            </button>
          ))}
        </div>
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
                <span>{visibility === 'public' ? 'Everyone' : 'Followers'}</span>
                <ChevronDown size={12} className={showVisibilityMenu ? 'rotate-180' : ''} />
              </button>
              {showVisibilityMenu && (
                <div className="absolute top-full left-0 mt-3 w-48 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <button onClick={() => { setVisibility('public'); setShowVisibilityMenu(false); }} className="w-full flex items-center justify-between px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 border-b border-brand-gray-50 dark:border-brand-gray-900">
                    <div className="flex items-center space-x-4"><Globe size={16} /> <span>Everyone</span></div>
                    {visibility === 'public' && <Check size={14} />}
                  </button>
                  <button onClick={() => { setVisibility('followers'); setShowVisibilityMenu(false); }} className="w-full flex items-center justify-between px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900">
                    <div className="flex items-center space-x-4"><Users size={16} /> <span>Followers</span></div>
                    {visibility === 'followers' && <Check size={14} />}
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowScheduler(!showScheduler)}
              className={`flex items-center space-x-3 px-4 py-2 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                scheduledAt 
                  ? 'bg-brand-black dark:bg-brand-white text-white dark:text-black border-brand-black dark:border-brand-white' 
                  : 'bg-brand-gray-50 dark:bg-brand-gray-900 border-brand-gray-200 dark:border-brand-gray-800 text-brand-gray-600 hover:text-brand-black'
              }`}
            >
              <Clock size={14} />
              <span>{scheduledAt ? `Scheduled: ${format(new Date(scheduledAt), 'MMM d, HH:mm')}` : 'Pick Time'}</span>
            </button>
          </div>

          {showScheduler && (
            <div className="mb-8 p-6 bg-brand-gray-50 dark:bg-brand-gray-900/50 border border-brand-gray-200 dark:border-brand-gray-800 rounded-[2rem] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3 text-brand-black dark:text-brand-white">
                  <Timer size={16} className="text-brand-black dark:text-brand-white" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Post Scheduler</span>
                </div>
                {scheduledAt && (
                  <button 
                    onClick={() => { setScheduledAt(''); setShowScheduler(false); }} 
                    className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-xl transition-all"
                  >
                    <Zap size={12} />
                    <span>Post Now</span>
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: '1 Hour', value: 1 },
                  { label: '3 Hours', value: 3 },
                  { label: 'Tomorrow', value: 24 },
                  { label: '2 Days', value: 48 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setPresetTime(preset.value)}
                    className="py-3 px-4 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-brand-black dark:hover:border-white transition-all shadow-sm active:scale-95"
                  >
                    +{preset.label}
                  </button>
                ))}
              </div>

              <div className="relative group">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray-400 group-focus-within:text-brand-black transition-colors" size={16} />
                <input 
                  type="datetime-local" 
                  value={scheduledAt}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl pl-12 pr-4 py-4 text-xs font-bold outline-none focus:ring-1 focus:ring-brand-black dark:focus:ring-white transition-all shadow-inner"
                />
              </div>
              <p className="mt-4 text-[9px] text-brand-gray-400 font-bold uppercase tracking-widest italic text-center">Your post will automatically go live at the selected time.</p>
            </div>
          )}

          {postType === PostType.ARTICLE && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article Title"
              className="w-full bg-transparent border-none focus:ring-0 text-3xl font-black italic tracking-tighter uppercase mb-4 placeholder:text-brand-gray-200 dark:placeholder:text-brand-gray-800"
            />
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={postType === PostType.ARTICLE ? "Write your detailed article here..." : "What's on your mind?"}
            className={`w-full bg-transparent border-none resize-none focus:ring-0 font-medium placeholder:text-brand-gray-300 dark:placeholder:text-brand-gray-700 leading-relaxed tracking-tight ${postType === PostType.ARTICLE ? 'text-lg min-h-[300px]' : 'text-xl min-h-[100px]'}`}
          />

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
                title="AI Topics"
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
              <Clock size={14} />
              <p className="text-[9px] font-black uppercase tracking-widest">{scheduledAt ? 'Scheduling Mode' : 'Instant Post'}</p>
            </div>
            <button 
              onClick={handleSubmit} 
              disabled={uploading || (!content && !selectedMedia)} 
              className="bg-brand-black dark:bg-brand-white text-white dark:text-black px-12 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:opacity-90 active:scale-95 disabled:opacity-20 transition-all flex items-center space-x-3"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span>{uploading ? 'Posting...' : (scheduledAt ? 'Schedule' : 'Post')}</span>
            </button>
          </div>
        </div>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleMediaSelect} className="hidden" accept="image/*,video/*" />
    </div>
  );
};

export default CreatePost;
