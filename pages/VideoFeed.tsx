
import React, { useEffect, useState, useRef } from 'react';
import * as firestoreModule from 'firebase/firestore';
import { db } from '../firebase';
import { Post, PostType } from '../types';
import { Heart, MessageCircle, Share2, Music, Play } from 'lucide-react';

const { collection, query, where, limit, onSnapshot } = firestoreModule as any;

const VideoFeed: React.FC = () => {
  const [videos, setVideos] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SECURITY FIX: Query must strictly match rules. Filter by public AND isPublished.
    const q = query(
      collection(db, 'posts'),
      where('type', '==', PostType.REEL),
      where('visibility', '==', 'public'),
      where('isPublished', '==', true),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as Post);
      // Manual sort by date
      data.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setVideos(data);
      setLoading(false);
    }, (err: any) => {
      console.error("Reel transmission failed:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-black">
      <div className="w-10 h-10 border-4 border-white border-t-transparent animate-spin rounded-full"></div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen overflow-y-scroll snap-y snap-mandatory bg-black">
      {videos.map((video) => (
        <VideoItem key={video.id} video={video} />
      ))}
      {videos.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-white p-10 text-center">
          <Play size={64} className="mb-4 opacity-20" />
          <h2 className="text-2xl font-bold italic opacity-30">NO VIDEOS FOUND.</h2>
        </div>
      )}
    </div>
  );
};

const VideoItem: React.FC<{ video: Post }> = ({ video }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(() => {});
            setPlaying(true);
          } else {
            videoRef.current?.pause();
            setPlaying(false);
          }
        });
      },
      { threshold: 0.6 }
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="h-full w-full snap-start relative flex items-center justify-center overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={video.mediaURL}
        className="h-full w-full object-cover md:w-auto md:max-w-md lg:max-w-lg"
        loop
        playsInline
        muted={false}
        onClick={() => {
          if (playing) videoRef.current?.pause();
          else videoRef.current?.play();
          setPlaying(!playing);
        }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"></div>

      <div className="absolute bottom-10 left-4 right-16 text-white pointer-events-none drop-shadow-md">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden pointer-events-auto shadow-xl">
             <img src={video.authorPhotoURL} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="font-black italic text-sm pointer-events-auto cursor-pointer">@{video.authorUsername}</span>
        </div>
        <p className="text-sm font-medium line-clamp-2 mb-4 pointer-events-auto">{video.content}</p>
        <div className="flex items-center space-x-2 text-[10px] uppercase font-black tracking-widest opacity-80">
          <Music size={12} className="animate-spin-slow" />
          <span>Video Sound</span>
        </div>
      </div>

      <div className="absolute bottom-24 right-4 flex flex-col space-y-8 items-center">
        <div className="flex flex-col items-center group cursor-pointer pointer-events-auto">
          <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white group-active:scale-90 transition-all border border-white/10">
            <Heart size={24} />
          </div>
          <span className="text-white text-[10px] mt-1 font-black italic">{video.likesCount}</span>
        </div>
        <div className="flex flex-col items-center group cursor-pointer pointer-events-auto">
          <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white group-active:scale-90 transition-all border border-white/10">
            <MessageCircle size={24} />
          </div>
          <span className="text-white text-[10px] mt-1 font-black italic">{video.commentsCount}</span>
        </div>
        <div className="flex flex-col items-center group cursor-pointer pointer-events-auto">
          <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white group-active:scale-90 transition-all border border-white/10">
            <Share2 size={24} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoFeed;
