import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Type definitions based on Zod schemas
interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_photo_url?: string;
  is_verified: boolean;
  is_superhost: boolean;
}

interface Property {
  property_id: string;
  title: string;
  city: string;
  country: string;
}

interface Message {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  attachments?: string[];
  is_read: boolean;
  read_at?: string;
  message_type: 'text' | 'image' | 'document';
  is_automated: boolean;
  created_at: string;
  sender?: User;
}

interface Conversation {
  conversation_id: string;
  property_id?: string;
  booking_id?: string;
  guest_id: string;
  host_id: string;
  conversation_type: 'inquiry' | 'booking' | 'support';
  subject?: string;
  is_active: boolean;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  property?: Property;
  guest?: User;
  host?: User;
  last_message?: Message;
  unread_count?: number;
}

interface CreateMessagePayload {
  conversation_id: string;
  sender_id: string;
  message_text: string;
  attachments?: string[];
  message_type?: 'text' | 'image' | 'document';
  is_automated?: boolean;
}



const UV_MessageCenter: React.FC = () => {
  // Router hooks
  const { conversation_id } = useParams<{ conversation_id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Zustand store - individual selectors to prevent infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const socket = useAppStore(state => state.socket);
  const isConnected = useAppStore(state => state.is_connected);
  const unreadMessages = useAppStore(state => state.notifications_state.unread_messages);
  const setUnreadMessages = useAppStore(state => state.set_unread_messages);
  const joinConversation = useAppStore(state => state.join_conversation);
  const leaveConversation = useAppStore(state => state.leave_conversation);
  const sendTypingIndicator = useAppStore(state => state.send_typing_indicator);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'inquiry' | 'booking' | 'support'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'unread'>('date');
  const [newMessageText, setNewMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showMobileConversations, setShowMobileConversations] = useState(!conversation_id);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  
  // React Query client
  const queryClient = useQueryClient();

  // Get active conversation from URL
  const activeConversationId = conversation_id || searchParams.get('conversation_id') || null;

  // API functions
  const fetchConversations = async (): Promise<{ conversations: Conversation[]; total: number }> => {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/conversations`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { limit: 50, offset: 0 }
      }
    );
    return response.data;
  };

  const fetchConversationMessages = async (conversationId: string): Promise<{ messages: Message[]; total: number }> => {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/conversations/${conversationId}/messages`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { limit: 50, offset: 0 }
      }
    );
    return response.data;
  };

  const sendMessage = async (payload: CreateMessagePayload): Promise<Message> => {
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/messages`,
      payload,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  };

  const markMessageRead = async (messageId: string): Promise<void> => {
    await axios.put(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/messages/${messageId}`,
      { is_read: true, read_at: new Date().toISOString() },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  };



  // React Query hooks
  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    error: conversationsError,
    refetch: refetchConversations
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    enabled: !!authToken && !!currentUser,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  const {
    data: messagesData,
    isLoading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages
  } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () => fetchConversationMessages(activeConversationId!),
    enabled: !!activeConversationId && !!authToken,
    staleTime: 10000,
    refetchOnWindowFocus: false
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (newMessage) => {
      // Update messages cache
      queryClient.setQueryData(['messages', activeConversationId], (oldData: any) => {
        if (!oldData) return { messages: [newMessage], total: 1 };
        return {
          ...oldData,
          messages: [...oldData.messages, newMessage]
        };
      });
      
      // Update conversations cache to reflect last message
      queryClient.setQueryData(['conversations'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          conversations: oldData.conversations.map((conv: Conversation) =>
            conv.conversation_id === activeConversationId
              ? { ...conv, last_message: newMessage, last_message_at: newMessage.created_at }
              : conv
          )
        };
      });
      
      // Clear draft
      setNewMessageText('');
      setSelectedFiles([]);
      
      // Scroll to bottom
      scrollToBottom();
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    }
  });

  const markReadMutation = useMutation({
    mutationFn: markMessageRead,
    onSuccess: () => {
      // Refetch conversations to update unread counts
      refetchConversations();
    }
  });

  // Filtered and sorted conversations
  const filteredConversations = useMemo(() => {
    if (!conversationsData?.conversations) return [];
    
    const filtered = conversationsData.conversations.filter(conv => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesTitle = conv.subject?.toLowerCase().includes(searchLower);
        const matchesUser = 
          conv.guest?.first_name?.toLowerCase().includes(searchLower) ||
          conv.guest?.last_name?.toLowerCase().includes(searchLower) ||
          conv.host?.first_name?.toLowerCase().includes(searchLower) ||
          conv.host?.last_name?.toLowerCase().includes(searchLower);
        const matchesProperty = conv.property?.title?.toLowerCase().includes(searchLower);
        
        if (!matchesTitle && !matchesUser && !matchesProperty) return false;
      }

    // Type filter
      if (filterType !== 'all' && conv.conversation_type !== filterType) return false;
      
      return true;
    });
    
    // Sort conversations
    filtered.sort((a, b) => {
      if (sortBy === 'unread') {
        const aUnread = a.unread_count || 0;
        const bUnread = b.unread_count || 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
      }

    // Default sort by date
      const aDate = new Date(a.last_message_at || a.created_at).getTime();
      const bDate = new Date(b.last_message_at || b.created_at).getTime();
      return bDate - aDate;
    });
    
    return filtered;
  }, [conversationsData?.conversations, searchQuery, filterType, sortBy]);

  // Get active conversation details
  const activeConversation = useMemo(() => {
    return filteredConversations.find(conv => conv.conversation_id === activeConversationId) || null;
  }, [filteredConversations, activeConversationId]);

  // Get other participant in conversation
  const otherParticipant = useMemo(() => {
    if (!activeConversation || !currentUser) return null;
    return currentUser.user_id === activeConversation.guest_id 
      ? activeConversation.host 
      : activeConversation.guest;
  }, [activeConversation, currentUser]);

  // Scroll to bottom effect
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // WebSocket effects
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join conversation room
    if (activeConversationId) {
      joinConversation(activeConversationId);
    }

    // Listen for real-time events
    const handleMessageReceived = (data: any) => {
      if (data.conversation_id === activeConversationId) {
        // Add message to cache
        queryClient.setQueryData(['messages', activeConversationId], (oldData: any) => {
          if (!oldData) return { messages: [data], total: 1 };
          return {
            ...oldData,
            messages: [...oldData.messages, data]
          };
        });
        scrollToBottom();
      } else {
        // Update unread count for other conversations
        setUnreadMessages(unreadMessages + 1);
      }
      refetchConversations();
    };

    const handleTypingIndicator = (data: any) => {
      if (data.conversation_id === activeConversationId && data.user_id !== currentUser?.user_id) {
        setOtherUserTyping(data.is_typing);
      }
    };

    const handleMessageRead = (data: any) => {
      if (data.conversation_id === activeConversationId) {
        queryClient.setQueryData(['messages', activeConversationId], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            messages: oldData.messages.map((msg: Message) =>
              msg.message_id === data.message_id
                ? { ...msg, is_read: true, read_at: data.read_at }
                : msg
            )
          };
        });
      }
    };

    socket.on('message_received', handleMessageReceived);
    socket.on('typing_indicator', handleTypingIndicator);
    socket.on('message_read', handleMessageRead);

    return () => {
      socket.off('message_received', handleMessageReceived);
      socket.off('typing_indicator', handleTypingIndicator);
      socket.off('message_read', handleMessageRead);
      
      if (activeConversationId) {
        leaveConversation(activeConversationId);
      }
    };
  }, [socket, isConnected, activeConversationId, currentUser, joinConversation, leaveConversation, queryClient, setUnreadMessages, unreadMessages, refetchConversations, scrollToBottom]);

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (messagesData?.messages && activeConversationId && currentUser) {
      const unreadMessages = messagesData.messages.filter(
        msg => !msg.is_read && msg.sender_id !== currentUser.user_id
      );
      
      unreadMessages.forEach(msg => {
        markReadMutation.mutate(msg.message_id);
      });
    }
  }, [messagesData?.messages, activeConversationId, currentUser, markReadMutation]);

  useEffect(() => {
    scrollToBottom();
  }, [messagesData?.messages, scrollToBottom]);

  // Typing indicator handling
  const handleTyping = useCallback((text: string) => {
    setNewMessageText(text);
    
    if (!isTyping && text.length > 0 && activeConversationId) {
      setIsTyping(true);
      sendTypingIndicator(activeConversationId, true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && activeConversationId) {
        setIsTyping(false);
        sendTypingIndicator(activeConversationId, false);
      }
    }, 1000);
  }, [isTyping, activeConversationId, sendTypingIndicator]);

  // Send message handler
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessageText.trim() || !activeConversationId || !currentUser) return;
    
    const payload: CreateMessagePayload = {
      conversation_id: activeConversationId,
      sender_id: currentUser.user_id,
      message_text: newMessageText.trim(),
      message_type: 'text',
      attachments: selectedFiles.length > 0 ? selectedFiles.map(f => f.name) : undefined
    };
    
    sendMessageMutation.mutate(payload);
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(activeConversationId, false);
    }
  }, [newMessageText, activeConversationId, currentUser, selectedFiles, sendMessageMutation, isTyping, sendTypingIndicator]);

  // Handle conversation selection
  const handleConversationSelect = useCallback((conversationId: string) => {
    navigate(`/messages/${conversationId}`);
    setShowMobileConversations(false);
  }, [navigate]);

  // Format timestamp
  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, []);

  // Get user display name
  const getUserDisplayName = useCallback((user?: User) => {
    if (!user) return 'Unknown User';
    return `${user.first_name} ${user.last_name}`;
  }, []);

  // Get user avatar
  const getUserAvatar = useCallback((user?: User) => {
    if (user?.profile_photo_url) {
      return user.profile_photo_url;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName(user))}&background=3b82f6&color=fff`;
  }, [getUserDisplayName]);

  if (!currentUser) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">Please sign in to access your messages.</p>
            <Link
              to="/auth?mode=login"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="h-screen bg-gray-50 flex overflow-hidden">
        {/* Mobile conversation list overlay */}
        <div className={`
          lg:hidden fixed inset-0 z-50 bg-white transform transition-transform duration-300 ease-in-out
          ${showMobileConversations ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="h-full flex flex-col">
            {/* Mobile header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
              <button
                onClick={() => setShowMobileConversations(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Mobile conversation list */}
            <div className="flex-1 overflow-hidden">
              {/* Search and filters */}
              <div className="p-4 space-y-3 border-b border-gray-200">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                
                <div className="flex space-x-2">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="inquiry">Inquiries</option>
                    <option value="booking">Bookings</option>
                    <option value="support">Support</option>
                  </select>
                  
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="date">Latest</option>
                    <option value="unread">Unread</option>
                  </select>
                </div>
              </div>
              
              {/* Conversation list */}
              <div className="overflow-y-auto h-full">
                {conversationsLoading ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading conversations...</p>
                  </div>
                ) : conversationsError ? (
                  <div className="p-4 text-center text-red-600">
                    <p>Error loading conversations</p>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <p>No conversations found</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const otherUser = currentUser.user_id === conversation.guest_id ? conversation.host : conversation.guest;
                    const unreadCount = conversation.unread_count || 0;
                    
                    return (
                      <div
                        key={conversation.conversation_id}
                        onClick={() => handleConversationSelect(conversation.conversation_id)}
                        className={`
                          p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors
                          ${activeConversationId === conversation.conversation_id ? 'bg-blue-50 border-blue-200' : ''}
                        `}
                      >
                        <div className="flex items-start space-x-3">
                          <img
                            src={getUserAvatar(otherUser)}
                            alt={getUserDisplayName(otherUser)}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {getUserDisplayName(otherUser)}
                                {otherUser?.is_verified && (
                                  <svg className="inline w-4 h-4 text-blue-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </p>
                              
                              <div className="flex items-center space-x-2">
                                <p className="text-xs text-gray-500">
                                  {formatTime(conversation.last_message_at || conversation.created_at)}
                                </p>
                                {unreadCount > 0 && (
                                  <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                    {unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {conversation.property && (
                              <p className="text-xs text-gray-500 truncate">
                                {conversation.property.title} • {conversation.property.city}
                              </p>
                            )}
                            
                            {conversation.last_message && (
                              <p className="text-sm text-gray-600 truncate mt-1">
                                {conversation.last_message.message_text}
                              </p>
                            )}
                            
                            <div className="flex items-center mt-1 space-x-2">
                              <span className={`
                                text-xs px-2 py-1 rounded-full
                                ${conversation.conversation_type === 'inquiry' ? 'bg-yellow-100 text-yellow-800' : ''}
                                ${conversation.conversation_type === 'booking' ? 'bg-green-100 text-green-800' : ''}
                                ${conversation.conversation_type === 'support' ? 'bg-red-100 text-red-800' : ''}
                              `}>
                                {conversation.conversation_type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop layout */}
        {/* Conversation list - desktop */}
        <div className="hidden lg:flex lg:w-1/3 xl:w-1/4 bg-white border-r border-gray-200 flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            <p className="text-sm text-gray-500 mt-1">{filteredConversations.length} conversations</p>
          </div>
          
          {/* Search and filters */}
          <div className="p-4 space-y-3 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <div className="flex space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="inquiry">Inquiries</option>
                <option value="booking">Bookings</option>
                <option value="support">Support</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date">Latest</option>
                <option value="unread">Unread</option>
              </select>
            </div>
          </div>
          
          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-3">Loading conversations...</p>
              </div>
            ) : conversationsError ? (
              <div className="p-6 text-center text-red-600">
                <p>Error loading conversations</p>
                <button
                  onClick={() => refetchConversations()}
                  className="mt-2 text-blue-600 hover:text-blue-800"
                >
                  Try again
                </button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="mt-2">No conversations found</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-blue-600 hover:text-blue-800"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const otherUser = currentUser.user_id === conversation.guest_id ? conversation.host : conversation.guest;
                const unreadCount = conversation.unread_count || 0;
                
                return (
                  <div
                    key={conversation.conversation_id}
                    onClick={() => handleConversationSelect(conversation.conversation_id)}
                    className={`
                      p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors
                      ${activeConversationId === conversation.conversation_id ? 'bg-blue-50 border-blue-200' : ''}
                    `}
                  >
                    <div className="flex items-start space-x-3">
                      <img
                        src={getUserAvatar(otherUser)}
                        alt={getUserDisplayName(otherUser)}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {getUserDisplayName(otherUser)}
                            {otherUser?.is_verified && (
                              <svg className="inline w-4 h-4 text-blue-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </p>
                          
                          <div className="flex items-center space-x-2">
                            <p className="text-xs text-gray-500">
                              {formatTime(conversation.last_message_at || conversation.created_at)}
                            </p>
                            {unreadCount > 0 && (
                              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {conversation.property && (
                          <p className="text-xs text-gray-500 truncate">
                            {conversation.property.title} • {conversation.property.city}
                          </p>
                        )}
                        
                        {conversation.last_message && (
                          <p className="text-sm text-gray-600 truncate mt-1">
                            {conversation.last_message.message_text}
                          </p>
                        )}
                        
                        <div className="flex items-center mt-1 space-x-2">
                          <span className={`
                            text-xs px-2 py-1 rounded-full
                            ${conversation.conversation_type === 'inquiry' ? 'bg-yellow-100 text-yellow-800' : ''}
                            ${conversation.conversation_type === 'booking' ? 'bg-green-100 text-green-800' : ''}
                            ${conversation.conversation_type === 'support' ? 'bg-red-100 text-red-800' : ''}
                          `}>
                            {conversation.conversation_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 flex flex-col bg-white">
          {activeConversationId && activeConversation ? (
            <>
              {/* Message header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Mobile back button */}
                  <button
                    onClick={() => setShowMobileConversations(true)}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <img
                    src={getUserAvatar(otherParticipant || undefined)}
                    alt={getUserDisplayName(otherParticipant || undefined)}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {getUserDisplayName(otherParticipant || undefined)}
                      {otherParticipant?.is_verified && (
                        <svg className="inline w-5 h-5 text-blue-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </h2>
                    
                    {activeConversation.property && (
                      <p className="text-sm text-gray-500">
                        {activeConversation.property.title}
                      </p>
                    )}
                    
                    {otherUserTyping && (
                      <p className="text-sm text-blue-600">
                        <span className="inline-flex space-x-1">
                          <span>Typing</span>
                          <span className="flex space-x-1">
                            <span className="w-1 h-1 bg-blue-600 rounded-full animate-pulse"></span>
                            <span className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                            <span className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                          </span>
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                
                {activeConversation.property && (
                  <Link
                    to={`/property/${activeConversation.property_id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Property
                  </Link>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messagesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-3">Loading messages...</p>
                  </div>
                ) : messagesError ? (
                  <div className="text-center py-8 text-red-600">
                    <p>Error loading messages</p>
                    <button
                      onClick={() => refetchMessages()}
                      className="mt-2 text-blue-600 hover:text-blue-800"
                    >
                      Try again
                    </button>
                  </div>
                ) : messagesData?.messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="mt-2">No messages yet</p>
                    <p className="text-sm">Start the conversation below</p>
                  </div>
                ) : (
                  messagesData?.messages.map((message, index) => {
                    const isOwnMessage = message.sender_id === currentUser.user_id;
                    const showAvatar = index === 0 || messagesData.messages[index - 1].sender_id !== message.sender_id;
                    
                    return (
                      <div
                        key={message.message_id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex space-x-2 max-w-xs lg:max-w-md ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                          {!isOwnMessage && showAvatar && (
                            <img
                              src={getUserAvatar(message.sender)}
                              alt={getUserDisplayName(message.sender)}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          )}
                          
                          {!isOwnMessage && !showAvatar && (
                            <div className="w-8 h-8"></div>
                          )}
                          
                          <div className={`
                            px-4 py-2 rounded-lg
                            ${isOwnMessage 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 text-gray-900'
                            }
                          `}>
                            <p className="text-sm">{message.message_text}</p>
                            
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {message.attachments.map((attachment, i) => (
                                  <div key={i} className="text-xs opacity-75">
                                    📎 {attachment}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className={`
                              text-xs mt-1 flex items-center space-x-1
                              ${isOwnMessage ? 'text-blue-200' : 'text-gray-500'}
                            `}>
                              <span>{formatTime(message.created_at)}</span>
                              {isOwnMessage && (
                                <span>
                                  {message.is_read ? (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                
                <div ref={messagesEndRef}/>
              </div>

              {/* Message input */}
              <div className="bg-white border-t border-gray-200 p-4">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <div className="flex-1">
                    <textarea
                      ref={messageInputRef}
                      value={newMessageText}
                      onChange={(e) => handleTyping(e.target.value)}
                      placeholder="Type your message..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}/>
                    
                    {selectedFiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="bg-gray-100 px-2 py-1 rounded text-sm flex items-center space-x-1">
                            <span>📎 {file.name}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Attach file"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                    
                    <button
                      type="submit"
                      disabled={!newMessageText.trim() || sendMessageMutation.isPending}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendMessageMutation.isPending ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            // No conversation selected - welcome screen
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center max-w-md mx-auto p-6">
                {/* Mobile conversations button */}
                <button
                  onClick={() => setShowMobileConversations(true)}
                  className="lg:hidden mb-6 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Conversations
                </button>
                
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Messages</h2>
                <p className="text-gray-600 mb-6">
                  Select a conversation from the sidebar to start messaging, or create a new conversation.
                </p>
                
                <div className="space-y-3 text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Real-time messaging with hosts and guests</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>File attachments and photo sharing</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Message read receipts and typing indicators</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_MessageCenter;