
import React, { useState, useEffect, useRef } from 'react';
import * as RouterNamespace from 'react-router-dom';
import * as firestoreModule from 'firebase/firestore';
import * as storageModule from 'firebase/storage';
import { auth, db, storage } from '../firebase.ts';
import { Message, Chat, UserProfile } from '../types.ts';
import { Send, MoreVertical, ChevronLeft, Check, CheckCheck, X, Camera, MessageSquare, Phone, Video, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const { useParams, useNavigate } = RouterNamespace as any;
const { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  limit, 
  serverTimestamp,
  doc,
  updateDoc,
  writeBatch,
  orderBy
} = firestoreModule as any;
const { ref, uploadBytes, getDownloadURL } = storageModule as any;

const ChatItem: React.FC<{ chat: Chat; active: boolean; onClick: () => void }> = ({ chat, active, onClick }) => {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const partnerId = chat.participants.find(p => p !== auth.currentUser?.uid);

  useEffect(() => {
    if (partnerId) {
      return onSnapshot(doc(db, 'users', partnerId), (snap: any) => {
        if (snap.exists()) setPartner({ ...snap.data(), uid: snap.id } as UserProfile);
      });
    }
  }, [partnerId]);

  const unreadCount = chat.unreadCount?.[auth.currentUser?.uid || ''] || 0;
  const isTyping = chat.typingStatus?.[partnerId || ''] === true;

  return (
    <div 
      onClick={onClick}
      className={`p-5 flex items-center space-x-4 cursor-pointer hover:bg-brand-gray-50 dark:hover:bg-brand-gray-900 transition-all border-l-4 ${active ? 'bg-brand-gray-50 dark:bg-brand-gray-900 border-brand-black dark:border-brand-white' : 'border-transparent'}`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-brand-gray-200 dark:bg-brand-gray-800 overflow-hidden border border-brand-gray-200 dark:border-brand-gray-800 shadow-sm">
          {partner?.photoURL && <img src={partner.photoURL} alt="" className="w-full h-full object-cover" />}
        </div>
        {partner?.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-brand-white dark:border-brand-black rounded-full shadow-sm"></div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <p className="font-black text-[10px] uppercase tracking-widest truncate text-brand-black dark:text-brand-white">@{partner?.username || 'User'}</p>
          <p className="text-[8px] text-brand-gray-400 font-bold uppercase tracking-widest">
            {chat.lastMessageAt ? format(chat.lastMessageAt.toDate(), 'HH:mm') : ''}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-xs truncate font-medium ${unreadCount > 0 ? 'text-brand-black dark:text-brand-white font-bold' : 'text-brand-gray-500'}`}>
            {isTyping ? <span className="text-green-500 italic animate-pulse">Typing...</span> : (chat.lastMessage || 'Start talking')}
          </p>
          {unreadCount > 0 && (
            <div className="ml-2 w-4 h-4 bg-brand-black dark:bg-brand-white text-white dark:text-black rounded-full flex items-center justify-center text-[8px] font-black">
              {unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatPage: React.FC = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activePartner, setActivePartner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', auth.currentUser.uid));
    return onSnapshot(q, (snapshot: any) => {
      const fetched = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as Chat);
      fetched.sort((a, b) => (b.lastMessageAt?.toMillis() || 0) - (a.lastMessageAt?.toMillis() || 0));
      setChats(fetched);
      setLoading(false);
    });
  }, [auth.currentUser]);

  useEffect(() => {
    if (!chatId || chats.length === 0 || !auth.currentUser) return;
    const currentChat = chats.find(c => c.id === chatId);
    if (!currentChat) return;

    const pId = currentChat.participants.find(p => p !== auth.currentUser?.uid);
    if (pId) {
      return onSnapshot(doc(db, 'users', pId), (snap: any) => {
        if (snap.exists()) setActivePartner({ ...snap.data(), uid: snap.id } as UserProfile);
      });
    }
  }, [chatId, chats, auth.currentUser]);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    const q = query(collection(db, 'messages'), where('chatId', '==', chatId), orderBy('createdAt', 'asc'), limit(100));
    const unsubscribe = onSnapshot(q, async (snapshot: any) => {
      const fetched = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as Message);
      setMessages(fetched);
      
      const batch = writeBatch(db);
      let needsUpdate = false;
      fetched.forEach(msg => {
        if (msg.senderId !== auth.currentUser?.uid && msg.status !== 'read') {
          batch.update(doc(db, 'messages', msg.id), { status: 'read' });
          needsUpdate = true;
        }
      });
      
      if (needsUpdate) {
        await batch.commit();
        await updateDoc(doc(db, 'chats', chatId), { [`unreadCount.${auth.currentUser?.uid}`]: 0 });
      }

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsubscribe();
  }, [chatId, auth.currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !chatId || (!newMessage.trim() && !mediaFile)) return;

    const content = newMessage;
    const file = mediaFile;
    setNewMessage('');
    setMediaFile(null);
    setMediaPreview(null);
    setUploadingMedia(true);

    try {
      let mediaURL = '';
      if (file) {
        const fileRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        mediaURL = await getDownloadURL(fileRef);
      }

      const partnerId = chats.find(c => c.id === chatId)?.participants.find(p => p !== auth.currentUser?.uid);

      await addDoc(collection(db, 'messages'), {
        chatId,
        senderId: auth.currentUser.uid,
        content: content || (file ? 'Photo Attachment' : ''),
        mediaURL,
        status: 'sent',
        createdAt: serverTimestamp()
      });
      
      const updateObj: any = {
        lastMessage: content || 'Photo Attachment',
        lastMessageAt: serverTimestamp(),
      };
      
      if (partnerId) {
        const chatDoc = chats.find(c => c.id === chatId);
        updateObj[`unreadCount.${partnerId}`] = (chatDoc?.unreadCount?.[partnerId] || 0) + 1;
      }

      await updateDoc(doc(db, 'chats', chatId), updateObj);
      clearTyping();
    } catch (error) {
      console.error("Message Error:", error);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!auth.currentUser || !chatId) return;
    updateDoc(doc(db, 'chats', chatId), { [`typingStatus.${auth.currentUser.uid}`]: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(clearTyping, 3000);
  };

  const clearTyping = () => {
    if (!auth.currentUser || !chatId) return;
    updateDoc(doc(db, 'chats', chatId), { [`typingStatus.${auth.currentUser.uid}`]: false });
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen overflow-hidden bg-brand-white dark:bg-brand-black">
      {/* Chats List Sidebar */}
      <div className={`w-full md:w-96 border-r border-brand-gray-100 dark:border-brand-gray-900 flex flex-col ${chatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-8 border-b border-brand-gray-100 dark:border-brand-gray-900 bg-brand-white dark:bg-brand-black z-10">
          <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-brand-black dark:text-brand-white">Messages</h2>
        </div>
        <div className="overflow-y-auto flex-1 pb-20 md:pb-0 scrollbar-hide">
          {chats.map(chat => (
            <ChatItem 
              key={chat.id} 
              chat={chat} 
              active={chatId === chat.id} 
              onClick={() => navigate(`/messages/${chat.id}`)} 
            />
          ))}
          {!loading && chats.length === 0 && (
            <div className="p-12 text-center text-brand-gray-400 mt-10">
              <MessageSquare size={48} className="mx-auto mb-6 opacity-10" />
              <p className="text-[10px] font-black uppercase tracking-widest italic leading-relaxed">No messages.<br/>Pick someone to chat with.</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Window */}
      {chatId ? (
        <div className="flex-1 flex flex-col bg-brand-gray-50/20 dark:bg-brand-gray-950/20 relative">
          <header className="px-8 py-5 border-b border-brand-gray-100 dark:border-brand-gray-900 flex items-center justify-between bg-brand-white/80 dark:bg-brand-black/80 backdrop-blur-3xl sticky top-0 z-20">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/messages')} className="md:hidden p-2 -ml-3 text-brand-gray-500 rounded-full transition-colors">
                <ChevronLeft size={24} />
              </button>
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-brand-gray-100 dark:bg-brand-gray-900 overflow-hidden border border-brand-gray-200 dark:border-brand-gray-800">
                  {activePartner?.photoURL && <img src={activePartner.photoURL} className="w-full h-full object-cover" alt="" />}
                </div>
                {activePartner?.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-brand-white dark:border-brand-black rounded-full shadow-md"></div>}
              </div>
              <div className="flex flex-col">
                <p className="font-black text-[10px] uppercase tracking-widest text-brand-black dark:text-brand-white">@{activePartner?.username || 'User'}</p>
                <div className="flex items-center space-x-2">
                  {chats.find(c => c.id === chatId)?.typingStatus?.[activePartner?.uid || ''] ? (
                    <span className="text-[8px] text-green-500 font-black uppercase tracking-widest animate-pulse">Typing...</span>
                  ) : activePartner?.isOnline ? (
                    <span className="text-[8px] text-green-500 font-black uppercase tracking-widest">Online</span>
                  ) : (
                    <span className="text-[8px] text-brand-gray-400 font-black uppercase tracking-widest italic">Offline</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-6">
                <button className="text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-all"><Phone size={20} /></button>
                <button className="text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-all"><Video size={20} /></button>
                <button className="p-2 text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-all"><MoreVertical size={20} /></button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
            {messages.map((msg, idx) => {
              const isMine = msg.senderId === auth.currentUser?.uid;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] md:max-w-[65%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {msg.mediaURL && (
                      <div className="mb-2 rounded-2xl overflow-hidden border border-brand-gray-100 dark:border-brand-gray-900 shadow-sm max-w-sm">
                        <img src={msg.mediaURL} alt="" className="w-full h-auto object-cover" />
                      </div>
                    )}
                    {msg.content && (
                      <div className={`px-5 py-3.5 rounded-[1.5rem] shadow-sm text-sm font-medium leading-relaxed tracking-tight relative ${
                        isMine 
                          ? 'bg-brand-black text-white dark:bg-brand-white dark:text-black rounded-tr-sm' 
                          : 'bg-brand-white dark:bg-brand-gray-900 border border-brand-gray-100 dark:border-brand-gray-800 rounded-tl-sm text-brand-black dark:text-brand-white'
                      }`}>
                        {msg.content}
                        <div className={`absolute bottom-1 right-3 flex items-center space-x-1 ${isMine ? 'text-white/50 dark:text-black/50' : 'text-brand-gray-400'}`}>
                           <span className="text-[7px] font-bold uppercase tracking-tighter">
                             {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
                           </span>
                           {isMine && (
                               msg.status === 'read' ? <CheckCheck size={10} className="text-blue-400" /> : <Check size={10} />
                           )}
                        </div>
                        <div className="h-2 w-8" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-6 border-t border-brand-gray-100 dark:border-brand-gray-900 flex flex-col bg-brand-white dark:bg-brand-black">
            {mediaPreview && (
                <div className="mb-4 relative w-24 h-24 rounded-2xl overflow-hidden border border-brand-gray-200 dark:border-brand-gray-800 animate-in zoom-in">
                    <img src={mediaPreview} className="w-full h-full object-cover" alt="" />
                    <button type="button" onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12}/></button>
                </div>
            )}
            <div className="flex items-center space-x-4">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white rounded-2xl transition-all"
              >
                <Camera size={24} />
              </button>
              <input 
                type="text" 
                value={newMessage}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="flex-1 bg-brand-gray-50 dark:bg-brand-gray-950 border border-brand-gray-100 dark:border-brand-gray-900 px-6 py-4 rounded-2xl text-sm focus:outline-none transition-all font-medium text-brand-black dark:text-brand-white shadow-inner"
              />
              <button 
                type="submit"
                disabled={uploadingMedia || (!newMessage.trim() && !mediaFile)}
                className="p-4 bg-brand-black dark:bg-brand-white text-white dark:text-black rounded-2xl disabled:opacity-20 transition-all hover:scale-105 active:scale-95 shadow-xl"
              >
                {uploadingMedia ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
              </button>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if(file) {
                    setMediaFile(file);
                    setMediaPreview(URL.createObjectURL(file));
                }
            }} />
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center p-20 bg-brand-gray-50/20 dark:bg-brand-gray-950/20">
          <div className="w-24 h-24 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl">
             <MessageSquare size={48} className="text-brand-black dark:text-brand-white opacity-10" />
          </div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-4 text-brand-black dark:text-brand-white">Messages</h2>
          <p className="text-brand-gray-500 text-center max-w-sm font-medium italic opacity-60">
            Pick a chat to start talking.
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
