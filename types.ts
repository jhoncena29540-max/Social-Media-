
// Fix: Use any for Timestamp if the specific type export is failing in this environment
export type Timestamp = any;

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin'
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  photoURL: string;
  coverURL: string;
  bio: string;
  website: string;
  role: UserRole;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  likesReceived: number;
  viewsReceived: number;
  createdAt: Timestamp;
  isOnline: boolean;
  lastActive: Timestamp;
}

export enum PostType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  REEL = 'reel',
  ARTICLE = 'article'
}

export interface Post {
  id: string;
  authorId: string;
  authorUsername: string;
  authorPhotoURL: string;
  type: PostType;
  category?: string; // Standard Category (Tech, Design, etc.)
  tags: string[]; // RAG-based topic tags for discovery
  content: string;
  mediaURL?: string;
  thumbnailURL?: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  trendingScore?: number;
  createdAt: Timestamp;
  scheduledAt?: Timestamp;
  isPublished: boolean;
  visibility: 'public' | 'followers';
}

export interface SavedPost {
  id: string;
  userId: string;
  postId: string;
  authorId: string;
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  postId: string;
  parentId?: string;
  authorId: string;
  authorUsername: string;
  authorPhotoURL: string;
  content: string;
  likesCount: number;
  replyCount?: number;
  createdAt: Timestamp;
  moderationStatus?: 'flagged' | 'clean' | 'hidden';
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  senderUsername: string;
  senderPhotoURL: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'reply';
  postId?: string;
  commentId?: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  unreadCount: { [uid: string]: number };
  typingStatus?: { [uid: string]: boolean };
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  mediaURL?: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Timestamp;
}