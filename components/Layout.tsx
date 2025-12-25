
import React, { useState, useEffect } from 'react';
import * as RouterNamespace from 'react-router-dom';
import { 
  Home, 
  Search, 
  Play, 
  Bell, 
  Mail, 
  User as UserIcon, 
  LogOut, 
  PlusSquare,
  TrendingUp,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { auth, db } from '../firebase.ts';
import * as firestoreModule from 'firebase/firestore';

const { NavLink, Outlet, useNavigate } = RouterNamespace as any;
const { doc, onSnapshot, updateDoc, serverTimestamp, query, collection, where } = firestoreModule as any;
type User = any;

interface LayoutProps {
  user: User | null;
}

const Layout: React.FC<LayoutProps> = ({ user }) => {
  const navigate = useNavigate();
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    
    // User Profile Data
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snap: any) => {
      if (snap.exists()) setCurrentUserData(snap.data());
    });

    // Unread Notifications Listener
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      where('read', '==', false)
    );
    const unsubscribeNotifications = onSnapshot(q, (snap: any) => {
      setUnreadNotifications(snap.size);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeNotifications();
    };
  }, [user]);

  const handleLogout = async () => {
    if (user?.uid) {
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, { isOnline: false, lastActive: serverTimestamp() });
      } catch (err) {}
    }
    await auth.signOut();
    navigate('/auth');
  };

  const navItems = [
    { icon: Home, label: 'Feed', path: '/' },
    { icon: Search, label: 'Explore', path: '/explore' },
    { icon: Play, label: 'Broadcasts', path: '/reels' },
    { icon: Bell, label: 'Alerts', path: '/notifications', badge: unreadNotifications },
    { icon: Mail, label: 'Chats', path: '/messages' },
    { icon: UserIcon, label: 'Profile', path: currentUserData?.username ? `/u/${currentUserData.username}` : (user ? `/u/${user.uid}` : '/auth') },
  ];

  return (
    <div className="flex min-h-screen bg-brand-white transition-colors duration-500">
      <div className="flex w-full max-w-[1440px] mx-auto relative">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex flex-col w-72 border-r border-brand-gray-100 sticky top-0 h-screen p-8">
          <div className="mb-12 flex items-center space-x-3 px-2">
            <div className="w-10 h-10 bg-brand-black flex items-center justify-center rounded-2xl shadow-xl">
              <span className="text-white font-black text-xl">S</span>
            </div>
            <span className="text-2xl font-black tracking-tighter italic">SOCIALICON</span>
          </div>

          <nav className="flex-1 space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={(navData: any) => {
                  const isActive = navData.isActive;
                  return `
                    flex items-center space-x-4 px-5 py-4 rounded-[1.5rem] transition-all duration-300 group relative
                    ${isActive 
                      ? 'bg-brand-black text-white shadow-2xl scale-[1.02]' 
                      : 'text-brand-gray-400 hover:bg-brand-gray-50 hover:text-brand-black'}
                  `;
                }}
              >
                {(navData: any) => {
                  const isActive = navData.isActive;
                  return (
                    <>
                      <div className="relative">
                        <item.icon size={22} className={`${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
                        {item.badge > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white shadow-lg border border-white animate-pulse">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.2em]">{item.label}</span>
                    </>
                  );
                }}
              </NavLink>
            ))}

            <button
              onClick={() => navigate('/')}
              className="w-full mt-6 flex items-center justify-center space-x-3 bg-brand-black text-white py-5 rounded-[2rem] hover:opacity-90 transition-all font-black text-xs uppercase tracking-[0.3em] shadow-2xl active:scale-95 border-b-4 border-brand-gray-800"
            >
              <PlusSquare size={18} />
              <span>New Signal</span>
            </button>
          </nav>

          <div className="mt-auto space-y-3">
            {currentUserData && (
              <div className="flex items-center space-x-4 px-6 py-4 mb-4 bg-brand-gray-50 rounded-[1.5rem] border border-brand-gray-100">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-gray-200 border border-brand-white shadow-sm">
                  <img src={currentUserData.photoURL} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest truncate">{currentUserData.displayName}</p>
                  <p className="text-[8px] font-bold text-brand-gray-400 truncate tracking-tight">@{currentUserData.username}</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center space-x-4 px-6 py-4 w-full rounded-[1.5rem] text-brand-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 bg-brand-white">
          <header className="md:hidden flex items-center justify-between p-6 border-b border-brand-gray-100 sticky top-0 bg-brand-white/80 backdrop-blur-3xl z-50">
             <div className="flex items-center space-x-3">
               <div className="w-8 h-8 bg-brand-black rounded-xl flex items-center justify-center">
                 <span className="text-white font-black text-xs">S</span>
               </div>
               <span className="text-lg font-black tracking-tighter italic text-brand-black">SOCIALICON</span>
             </div>
          </header>

          <div className="pb-32 md:pb-12">
            <Outlet />
          </div>

          {/* Bottom Nav Mobile */}
          <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-brand-black/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex justify-around items-center p-2 z-50 border border-white/10">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={(navData: any) => {
                  const isActive = navData.isActive;
                  return `
                    p-4 rounded-full transition-all flex items-center justify-center relative
                    ${isActive 
                      ? 'bg-brand-white text-brand-black shadow-xl scale-110' 
                      : 'text-brand-gray-500'}
                  `;
                }}
              >
                {(navData: any) => {
                  const isActive = navData.isActive;
                  return (
                    <div className="relative">
                      <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                      {item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white shadow-lg border border-brand-black animate-pulse">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </div>
                  );
                }}
              </NavLink>
            ))}
          </nav>
        </main>

        {/* Right Sidebar */}
        <aside className="hidden xl:block w-96 p-10 border-l border-brand-gray-100 sticky top-0 h-screen overflow-y-auto">
          <section className="bg-brand-gray-50 border border-brand-gray-100 rounded-[2.5rem] p-8 mb-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] italic flex items-center">
                <TrendingUp size={16} className="mr-2" /> Global Signals
              </h3>
              <Sparkles size={14} className="text-brand-gray-400 animate-pulse" />
            </div>
            <div className="space-y-6">
               <div className="group cursor-pointer">
                <p className="text-[10px] text-brand-gray-500 font-black uppercase tracking-widest mb-1">Grid / Tech</p>
                <p className="font-bold text-lg group-hover:underline tracking-tight">#NeonBroadcast</p>
                <p className="text-[10px] text-brand-gray-400 font-bold mt-1">18.2K Signals</p>
              </div>
              <div className="group cursor-pointer">
                <p className="text-[10px] text-brand-gray-500 font-black uppercase tracking-widest mb-1">Design / UX</p>
                <p className="font-bold text-lg group-hover:underline tracking-tight">#SaaSAesthetic</p>
                <p className="text-[10px] text-brand-gray-400 font-bold mt-1">12.4K Signals</p>
              </div>
            </div>
          </section>

          <section className="bg-brand-gray-50 border border-brand-gray-100 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-black text-xs uppercase tracking-[0.2em] italic mb-8">Node Recommendations</h3>
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-brand-gray-200 rounded-full border-2 border-brand-white shadow-lg"></div>
                    <div>
                      <p className="font-black text-xs uppercase tracking-widest">Alpha_Zero</p>
                      <p className="text-[10px] text-brand-gray-400 font-bold">@alpha_0</p>
                    </div>
                  </div>
                  <button className="bg-brand-black text-white text-[9px] font-black uppercase tracking-widest py-2.5 px-6 rounded-full shadow-lg active:scale-95 transition-all">Link</button>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-brand-white w-full max-w-sm rounded-[2.5rem] border border-brand-gray-200 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase mb-2 text-brand-black">Logout Node?</h2>
              <p className="text-brand-gray-500 text-sm font-medium leading-relaxed mb-8">
                Are you sure you want to end your session? You will need to re-authenticate to access your node broadcasts.
              </p>
              <div className="flex w-full space-x-4">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-4 bg-brand-gray-50 text-brand-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-brand-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex-1 py-4 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 shadow-xl shadow-red-500/20 transition-all"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
