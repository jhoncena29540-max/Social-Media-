
import React, { useState } from 'react';
// Fix: Use namespaced import for firebase/auth to avoid export errors
import * as authNamespace from 'firebase/auth';
// Fix: Use namespaced import for firestore
import * as firestoreModule from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserRole } from '../types';

// Fix: Destructure missing members from namespace using any casting
const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = authNamespace as any;
const { doc, setDoc, serverTimestamp } = firestoreModule as any;

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, {
          displayName: displayName,
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
        });

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email,
          username: username.toLowerCase(),
          displayName,
          photoURL: user.photoURL,
          coverURL: '',
          bio: '',
          website: '',
          role: UserRole.USER,
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          likesReceived: 0,
          viewsReceived: 0,
          createdAt: serverTimestamp(),
          isOnline: true,
          lastActive: serverTimestamp()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-brand-white dark:bg-brand-black">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-black dark:bg-white flex items-center justify-center rounded-2xl mx-auto mb-6 shadow-2xl">
            <span className="text-white dark:text-black font-black text-3xl">S</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-2 italic">SOCIALICON</h1>
          <p className="text-brand-gray-500 font-medium">Connect with the elite.</p>
        </div>

        <div className="bg-brand-gray-50 dark:bg-brand-gray-900/50 p-8 rounded-3xl border border-brand-gray-100 dark:border-brand-gray-800 shadow-xl backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-6">{isLogin ? 'Welcome Back' : 'Join the SocialIcon'}</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-bold mb-1.5 ml-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5 ml-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                    placeholder="johndoe_99"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-bold mb-1.5 ml-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5 ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-brand-white dark:bg-brand-black border border-brand-gray-200 dark:border-brand-gray-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-500 text-sm font-medium mt-2 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-brand-black dark:bg-brand-white text-white dark:text-black rounded-xl font-black text-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-lg active:scale-95 mt-4"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white dark:border-black border-t-transparent animate-spin rounded-full mx-auto"></div>
              ) : (
                isLogin ? 'SIGN IN' : 'CREATE ACCOUNT'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-bold hover:underline"
            >
              {isLogin ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
