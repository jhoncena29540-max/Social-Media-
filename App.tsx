
import React, { useState, useEffect } from 'react';
import * as RouterNamespace from 'react-router-dom';
import * as authNamespace from 'firebase/auth';
import * as firestoreModule from 'firebase/firestore';
import { auth, db } from './firebase.ts';

// Pages - Using explicit extensions for reliable ESM resolution
import Home from './pages/Home.tsx';
import Profile from './pages/Profile.tsx';
import Auth from './pages/Auth.tsx';
import Explore from './pages/Explore.tsx';
import Notifications from './pages/Notifications.tsx';
import ChatPage from './pages/Chat.tsx';
import VideoFeed from './pages/VideoFeed.tsx';

// Components
import Layout from './components/Layout.tsx';
import LoadingScreen from './components/LoadingScreen.tsx';

const { HashRouter: Router, Routes, Route, Navigate } = RouterNamespace as any;
const { onAuthStateChanged } = authNamespace as any;
const { doc, updateDoc, serverTimestamp } = firestoreModule as any;
type User = any;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Presence Heartbeat
  useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, 'users', user.uid);
    const updatePresence = (isOnline: boolean) => {
      updateDoc(userRef, {
        isOnline,
        lastActive: serverTimestamp()
      }).catch(err => console.error("Presence Sync Error:", err));
    };

    updatePresence(true);
    
    // Heartbeat every minute
    const interval = setInterval(() => updatePresence(true), 60000);

    // Visibility check
    const handleVisibility = () => {
      updatePresence(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      updatePresence(false);
    };
  }, [user?.uid]);

  // Force light mode on mount
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Router>
      <div className="min-h-screen bg-brand-white text-brand-black transition-colors duration-300 font-sans">
        <Routes>
          <Route path="/auth" element={!user ? <Auth /> : <Navigate to="/" />} />
          
          <Route element={<Layout user={user} />}>
            <Route path="/" element={user ? <Home /> : <Navigate to="/auth" />} />
            <Route path="/explore" element={user ? <Explore /> : <Navigate to="/auth" />} />
            <Route path="/reels" element={user ? <VideoFeed /> : <Navigate to="/auth" />} />
            <Route path="/notifications" element={user ? <Notifications /> : <Navigate to="/auth" />} />
            <Route path="/messages" element={user ? <ChatPage /> : <Navigate to="/auth" />} />
            <Route path="/messages/:chatId" element={user ? <ChatPage /> : <Navigate to="/auth" />} />
            <Route path="/u/:username" element={user ? <Profile /> : <Navigate to="/auth" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
