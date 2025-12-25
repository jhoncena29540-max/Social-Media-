
import React, { useState, useEffect } from 'react';
import * as firestoreModule from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Notification as NotificationType } from '../types';
import { Heart, MessageCircle, UserPlus, AtSign, Reply, CheckCheck, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import * as RouterNamespace from 'react-router-dom';

const { Link, useNavigate } = RouterNamespace as any;
const { collection, query, where, limit, onSnapshot, doc, writeBatch, updateDoc } = firestoreModule as any;

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot: any) => {
        const fetched = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as NotificationType);
        fetched.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setNotifications(fetched);
        setLoading(false);
        setError(null);
      },
      (err: any) => {
        console.error("Notifications Error:", err);
        setLoading(false);
        setError(err.message);
      }
    );

    return () => unsubscribe();
  }, [auth.currentUser]);

  const markAllAsRead = async () => {
    if (!auth.currentUser || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      const ref = doc(db, 'notifications', n.id);
      batch.update(ref, { read: true });
    });
    await batch.commit();
  };

  const handleNotificationClick = async (n: NotificationType) => {
    if (!n.read) {
      const ref = doc(db, 'notifications', n.id);
      await updateDoc(ref, { read: true });
    }
    navigate(`/u/${n.senderUsername}`);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={16} className="text-red-500" fill="currentColor" />;
      case 'comment': return <MessageCircle size={16} className="text-blue-500" />;
      case 'follow': return <UserPlus size={16} className="text-green-500" />;
      case 'mention': return <AtSign size={16} className="text-purple-500" />;
      case 'reply': return <Reply size={16} className="text-orange-500" />;
      default: return null;
    }
  };

  const getMessage = (n: NotificationType) => {
    switch (n.type) {
      case 'like': return 'liked your post';
      case 'comment': return 'commented on your post';
      case 'follow': return 'followed you';
      case 'mention': return 'mentioned you in a post';
      case 'reply': return 'replied to your comment';
      default: return 'interacted with you';
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none mb-2">Notifications</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400 opacity-60">See what's happening</p>
        </div>
        <button 
          onClick={markAllAsRead}
          className="flex items-center space-x-3 px-6 py-3 bg-brand-gray-50 dark:bg-brand-gray-900 border border-brand-gray-100 dark:border-brand-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-brand-gray-500 hover:text-brand-black dark:hover:text-brand-white transition-all shadow-sm active:scale-95"
        >
          <CheckCheck size={14} />
          <span>Mark read</span>
        </button>
      </div>

      {error && (
        <div className="mb-8 p-8 bg-brand-gray-50 dark:bg-brand-gray-950 border border-brand-gray-100 dark:border-brand-gray-900 rounded-[2.5rem] text-center">
          <AlertTriangle size={32} className="mx-auto mb-4 text-red-500" />
          <p className="text-xs font-black uppercase tracking-widest mb-2">Error</p>
          <p className="text-[10px] text-brand-gray-400 font-bold">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-24">
            <div className="w-10 h-10 border-4 border-brand-black dark:border-brand-white border-t-transparent animate-spin rounded-full"></div>
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((n) => (
            <button 
              onClick={() => handleNotificationClick(n)}
              key={n.id}
              className={`w-full flex items-center space-x-6 p-6 rounded-[2rem] transition-all border text-left group ${
                n.read 
                  ? 'opacity-60 bg-transparent border-transparent grayscale hover:grayscale-0 hover:opacity-100 hover:bg-brand-gray-50 dark:hover:bg-brand-gray-950' 
                  : 'bg-brand-white dark:bg-brand-gray-900 border-brand-gray-100 dark:border-brand-gray-800 shadow-lg'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-brand-gray-200 dark:bg-brand-gray-800 border-2 border-brand-white dark:border-brand-black shadow-md group-hover:scale-110 transition-transform">
                  <img src={n.senderPhotoURL} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-brand-white dark:bg-brand-black p-1.5 rounded-full border border-brand-gray-200 dark:border-brand-gray-800 shadow-xl">
                  {getIcon(n.type)}
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium leading-relaxed tracking-tight">
                  <span className="font-black italic">@{n.senderUsername}</span> {getMessage(n)}
                </p>
                <p className="text-[9px] text-brand-gray-400 mt-1 uppercase font-black tracking-widest italic opacity-50">
                  {n.createdAt ? formatDistanceToNow(n.createdAt.toDate()) + ' ago' : 'Just now'}
                </p>
              </div>

              {!n.read && (
                <div className="w-2.5 h-2.5 bg-brand-black dark:bg-brand-white rounded-full animate-pulse shadow-xl flex-shrink-0"></div>
              )}
            </button>
          ))
        ) : !error && (
          <div className="text-center py-40 bg-brand-gray-50/50 dark:bg-brand-gray-950/20 rounded-[3rem] border-2 border-dashed border-brand-gray-100 dark:border-brand-gray-900 opacity-30">
            <AlertTriangle size={64} className="mx-auto mb-6 opacity-10" />
            <p className="text-lg font-black italic tracking-[0.4em] uppercase">No notifications.</p>
            <p className="text-[10px] font-black uppercase tracking-widest mt-4">There's nothing here yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
