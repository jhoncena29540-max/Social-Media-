
import React, { useState } from 'react';
import * as authNamespace from 'firebase/auth';
import * as firestoreModule from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserRole } from '../types';
import { Mail, Lock, User, AtSign, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

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
      // Cleaner error messaging
      const message = err.message.replace('Firebase: ', '').replace(' (auth/', ' - ').replace(').', '');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-brand-white dark:bg-brand-black selection:bg-brand-black selection:text-brand-white">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Brand Header */}
        <div className="text-center mb-12">
          <div className="w-14 h-14 bg-brand-black dark:bg-brand-white flex items-center justify-center rounded-[1.25rem] mx-auto mb-6 shadow-[0_20px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_40px_rgba(255,255,255,0.1)] transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <span className="text-brand-white dark:text-brand-black font-black text-2xl">S</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-3 uppercase italic">SocialIcon</h1>
          <p className="text-brand-gray-400 font-medium text-sm">Where influence meets aesthetics.</p>
        </div>

        {/* Auth Card */}
        <div className="bg-brand-white dark:bg-brand-gray-950 p-10 rounded-[2.5rem] border border-brand-gray-100 dark:border-brand-gray-900 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.08)]">
          <div className="mb-10">
            <h2 className="text-3xl font-black tracking-tight mb-2">
              {isLogin ? 'Welcome back' : 'Join the Circle'}
            </h2>
            <p className="text-brand-gray-500 text-sm font-medium">
              {isLogin ? 'Enter your credentials to continue.' : 'Create your professional identity today.'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400 ml-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray-300 group-focus-within:text-brand-black dark:group-focus-within:text-brand-white transition-colors" size={18} />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-brand-gray-50 dark:bg-brand-black border border-brand-gray-100 dark:border-brand-gray-900 rounded-2xl focus:border-brand-black dark:focus:border-brand-white transition-all outline-none font-medium text-sm shadow-inner"
                      placeholder="Jane Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400 ml-1">Username</label>
                  <div className="relative group">
                    <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray-300 group-focus-within:text-brand-black dark:group-focus-within:text-brand-white transition-colors" size={18} />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-brand-gray-50 dark:bg-brand-black border border-brand-gray-100 dark:border-brand-gray-900 rounded-2xl focus:border-brand-black dark:focus:border-brand-white transition-all outline-none font-medium text-sm shadow-inner"
                      placeholder="janedoe"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray-300 group-focus-within:text-brand-black dark:group-focus-within:text-brand-white transition-colors" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-brand-gray-50 dark:bg-brand-black border border-brand-gray-100 dark:border-brand-gray-900 rounded-2xl focus:border-brand-black dark:focus:border-brand-white transition-all outline-none font-medium text-sm shadow-inner"
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-gray-400 ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray-300 group-focus-within:text-brand-black dark:group-focus-within:text-brand-white transition-colors" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-brand-gray-50 dark:bg-brand-black border border-brand-gray-100 dark:border-brand-gray-900 rounded-2xl focus:border-brand-black dark:focus:border-brand-white transition-all outline-none font-medium text-sm shadow-inner"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-2xl animate-in shake duration-300">
                <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
                <p className="text-red-600 dark:text-red-400 text-xs font-bold leading-tight">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full py-5 bg-brand-black dark:bg-brand-white text-brand-white dark:text-brand-black rounded-2xl font-black text-xs uppercase tracking-[0.3em] overflow-hidden transition-all hover:opacity-90 active:scale-[0.98] shadow-[0_20px_40px_rgba(0,0,0,0.15)] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <span>{isLogin ? 'Log In' : 'Create Account'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-xs font-black uppercase tracking-[0.2em] text-brand-gray-400 hover:text-brand-black dark:hover:text-brand-white transition-all flex items-center justify-center mx-auto space-x-2"
            >
              <span>{isLogin ? "No account? Sign up" : "Already registered? Log in"}</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.3em] text-brand-gray-300 dark:text-brand-gray-700">
          SocialIcon &copy; 2024 • Minimalist Social Infrastructure
        </p>
      </div>
    </div>
  );
};

export default Auth;
