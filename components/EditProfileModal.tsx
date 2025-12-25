
import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Globe, Info, Save, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { auth, db, storage } from '../firebase';
import * as firestoreModule from 'firebase/firestore';
import * as storageModule from 'firebase/storage';
import { UserProfile } from '../types';

const { doc, updateDoc } = firestoreModule as any;
const { ref, uploadBytes, getDownloadURL } = storageModule as any;

interface EditProfileModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedProfile: Partial<UserProfile>) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ profile, isOpen, onClose, onUpdate }) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [website, setWebsite] = useState(profile.website);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [coverURL, setCoverURL] = useState(profile.coverURL || '');
  const [loading, setLoading] = useState(false);
  
  const pfpInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile.displayName);
      setBio(profile.bio);
      setWebsite(profile.website);
      setPhotoURL(profile.photoURL);
      setCoverURL(profile.coverURL || '');
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photoURL' | 'coverURL') => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setLoading(true);
    try {
      const storageRef = ref(storage, `users/${auth.currentUser.uid}/${type}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (type === 'photoURL') setPhotoURL(url);
      else setCoverURL(url);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const updates = { 
        displayName, 
        bio, 
        website, 
        photoURL, 
        coverURL 
      };
      await updateDoc(userRef, updates);
      onUpdate(updates);
      onClose();
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-brand-white dark:bg-brand-black w-full max-w-xl rounded-3xl overflow-hidden border border-brand-gray-200 dark:border-brand-gray-800 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-brand-gray-100 dark:border-brand-gray-900">
          <h2 className="text-xl font-black italic tracking-tighter">EDIT PROFILE</h2>
          <button onClick={onClose} className="p-2 hover:bg-brand-gray-100 dark:hover:bg-brand-gray-900 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh] scrollbar-hide">
          {/* Cover Section */}
          <div className="space-y-4">
            <label className="text-xs font-black uppercase tracking-widest text-brand-gray-500 block">Cover Photo</label>
            <div className="relative">
              <div className="h-32 bg-brand-gray-100 dark:bg-brand-gray-900 rounded-2xl relative overflow-hidden group border border-brand-gray-100 dark:border-brand-gray-800">
                {coverURL ? (
                  <img src={coverURL} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-brand-gray-200 dark:bg-brand-gray-800 flex items-center justify-center text-brand-gray-400">
                    <ImageIcon size={32} opacity={0.2} />
                  </div>
                )}
                <button onClick={() => coverInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold">
                  <Camera size={24} className="mr-2" /> Change Cover
                </button>
                <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'coverURL')} />
              </div>
            </div>
          </div>

          {/* Profile Picture */}
          <div className="space-y-4">
            <label className="text-xs font-black uppercase tracking-widest text-brand-gray-500 block">Profile Photo</label>
            <div className="flex items-center space-x-6">
              <div className="relative group flex-shrink-0">
                <div className="w-24 h-24 rounded-full border-4 border-brand-white dark:border-brand-black bg-brand-gray-300 dark:bg-brand-gray-800 overflow-hidden relative shadow-xl">
                  <img src={photoURL} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => pfpInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera size={20} />
                  </button>
                  <input type="file" ref={pfpInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'photoURL')} />
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4 pt-4 border-t border-brand-gray-50 dark:border-brand-gray-900">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-brand-gray-500 mb-1 block">Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-brand-gray-50 dark:bg-brand-gray-900/50 border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl px-4 py-3 focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold text-sm" />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-brand-gray-500 mb-1 block">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="About you..." rows={3} className="w-full bg-brand-gray-50 dark:bg-brand-gray-900/50 border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl px-4 py-3 focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all resize-none font-medium text-sm leading-relaxed" />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-brand-gray-500 mb-1 block">Website</label>
              <div className="relative">
                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray-400" />
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="link.com" className="w-full bg-brand-gray-50 dark:bg-brand-gray-900/50 border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl pl-12 pr-4 py-3 focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-brand-gray-100 dark:border-brand-gray-900 flex justify-end space-x-4">
          <button onClick={onClose} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-brand-gray-500 hover:text-brand-black dark:hover:text-brand-white transition-colors">Back</button>
          <button onClick={handleSaveMetadata} disabled={loading} className="bg-brand-black dark:bg-brand-white text-white dark:text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center space-x-3 shadow-2xl hover:opacity-90 active:scale-95 disabled:opacity-20 transition-all">
            {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin rounded-full" /> : <Save size={18} />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
