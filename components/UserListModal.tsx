
import React, { useState, useEffect } from 'react';
import { X, UserPlus, UserMinus, Search } from 'lucide-react';
// Fix: Use namespaced import for firestore
import * as firestoreModule from 'firebase/firestore';
import { db, auth } from '../firebase.ts';
import { UserProfile } from '../types.ts';
import * as RouterNamespace from 'react-router-dom';

const { Link } = RouterNamespace as any;
const { collection, query, where, getDocs, doc, getDoc, deleteDoc, setDoc, serverTimestamp, updateDoc, increment, addDoc } = firestoreModule as any;

interface UserListModalProps {
  userId: string;
  type: 'Followers' | 'Following';
  isOpen: boolean;
  onClose: () => void;
}

const UserListModal: React.FC<UserListModalProps> = ({ userId, type, isOpen, onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const field = type === 'Followers' ? 'followedId' : 'followerId';
        const q = query(collection(db, 'follows'), where(field, '==', userId));
        const snap = await getDocs(q);
        
        const userPromises = snap.docs.map(async (fDoc: any) => {
          const targetId = type === 'Followers' ? fDoc.data().followerId : fDoc.data().followedId;
          const uDoc = await getDoc(doc(db, 'users', targetId));
          return uDoc.exists() ? { ...uDoc.data(), uid: uDoc.id } as UserProfile : null;
        });

        const results = (await Promise.all(userPromises)).filter(u => u !== null) as UserProfile[];
        setUsers(results);

        // Check if current user is following these people
        if (auth.currentUser) {
          const followChecks = results.map(async (u) => {
            const fSnap = await getDoc(doc(db, 'follows', `${auth.currentUser!.uid}_${u.uid}`));
            return { id: u.uid, isFollowing: fSnap.exists() };
          });
          const checks = await Promise.all(followChecks);
          const map: Record<string, boolean> = {};
          checks.forEach(c => map[c.id] = c.isFollowing);
          setFollowingMap(map);
        }
      } catch (err) {
        console.error("Error fetching user list:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen, userId, type]);

  const toggleFollow = async (targetUser: UserProfile) => {
    if (!auth.currentUser || targetUser.uid === auth.currentUser.uid) return;
    
    const followId = `${auth.currentUser.uid}_${targetUser.uid}`;
    const isFollowing = followingMap[targetUser.uid];
    
    try {
      if (isFollowing) {
        await deleteDoc(doc(db, 'follows', followId));
        await updateDoc(doc(db, 'users', targetUser.uid), { followersCount: increment(-1) });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { followingCount: increment(-1) });
        setFollowingMap(prev => ({ ...prev, [targetUser.uid]: false }));
      } else {
        await setDoc(doc(db, 'follows', followId), {
          followerId: auth.currentUser.uid,
          followedId: targetUser.uid,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'users', targetUser.uid), { followersCount: increment(1) });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { followingCount: increment(1) });
        setFollowingMap(prev => ({ ...prev, [targetUser.uid]: true }));

        // Notify target user
        await addDoc(collection(db, 'notifications'), {
          recipientId: targetUser.uid,
          senderId: auth.currentUser.uid,
          senderUsername: auth.currentUser.displayName || 'someone',
          senderPhotoURL: auth.currentUser.photoURL || '',
          type: 'follow',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-brand-white dark:bg-brand-black w-full max-w-md rounded-3xl border border-brand-gray-200 dark:border-brand-gray-800 shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-brand-gray-100 dark:border-brand-gray-900">
          <h2 className="text-xl font-black italic tracking-tighter uppercase">{type}</h2>
          <button onClick={onClose} className="p-2 hover:bg-brand-gray-100 dark:hover:bg-brand-gray-900 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-10 flex justify-center">
              <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent animate-spin rounded-full"></div>
            </div>
          ) : users.length > 0 ? (
            users.map(user => (
              <div key={user.uid} className="flex items-center justify-between">
                <Link to={`/u/${user.username}`} onClick={onClose} className="flex items-center space-x-3 group">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-gray-200 dark:bg-brand-gray-800">
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-tighter group-hover:underline">@{user.username}</p>
                    <p className="text-[10px] text-brand-gray-500 font-bold">{user.displayName}</p>
                  </div>
                </Link>
                {auth.currentUser && auth.currentUser.uid !== user.uid && (
                  <button 
                    onClick={() => toggleFollow(user)}
                    className={`p-2 rounded-xl transition-all ${followingMap[user.uid] ? 'text-brand-gray-400 hover:text-red-500' : 'text-brand-black dark:text-brand-white bg-brand-gray-100 dark:bg-brand-gray-900'}`}
                  >
                    {followingMap[user.uid] ? <UserMinus size={20} /> : <UserPlus size={20} />}
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-brand-gray-400">
              <p className="font-bold italic text-sm">No one here yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserListModal;
