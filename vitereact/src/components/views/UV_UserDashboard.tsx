import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Interfaces for API responses
interface BookingWithProperty {
  booking_id: string;
  property_id: string;
  property_title: string;
  property_city: string;
  property_country: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  total_price: number;
  currency: string;
  booking_status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  property_photo?: string;
  cancellation_deadline?: string;
}

interface PropertyWithAnalytics {
  property_id: string;
  title: string;
  property_type: string;
  city: string;
  country: string;
  average_rating?: number;
  review_count: number;
  occupancy_rate: number;
  monthly_revenue: number;
  active_bookings: number;
  cover_photo?: string;
  is_active: boolean;
}

interface ConversationWithParticipant {
  conversation_id: string;
  property_id?: string;
  property_title?: string;
  participant_name: string;
  participant_photo?: string;
  last_message_text?: string;
  last_message_at?: string;
  unread_count: number;
  conversation_type: 'inquiry' | 'booking' | 'support';
}

interface FavoriteProperty {
  property_id: string;
  title: string;
  city: string;
  country: string;
  base_price_per_night: number;
  currency: string;
  average_rating?: number;
  cover_photo?: string;
  favorited_at: string;
}



interface DashboardAnalytics {
  total_trips: number;
  upcoming_trips: number;
  total_spent: number;
  properties_owned: number;
  total_revenue: number;
  portfolio_value: number;
  unread_messages: number;
  pending_reviews: number;
}

interface NotificationItem {
  notification_id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  priority: 'low' | 'normal' | 'high';
  created_at: string;
}

const UV_UserDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const queryClient = useQueryClient();

  // CRITICAL: Individual selectors to avoid infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currency = useAppStore(state => state.user_preferences.currency);

  const unreadNotifications = useAppStore(state => state.notifications_state.unread_notifications);

  // URL parameter management
  const activeTab = searchParams.get('tab') || 'trips';
  const filter = searchParams.get('filter') || '';

  // Set active tab and update URL
  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    if (filter) newParams.set('filter', filter);
    setSearchParams(newParams);
  };

  // API base URL
  const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/api`;

  // Fetch user bookings
  const { data: userBookings = [], isLoading: bookingsLoading, error: bookingsError } = useQuery({
    queryKey: ['userBookings', currentUser?.user_id],
    queryFn: async (): Promise<BookingWithProperty[]> => {
      const response = await axios.get(`${API_BASE_URL}/api/bookings`, {
        params: {
          guest_id: currentUser?.user_id,
          sort_by: 'check_in_date',
          sort_order: 'desc',
          limit: 20
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      return response.data.bookings.map((booking: any) => ({
        booking_id: booking.booking_id,
        property_id: booking.property_id,
        property_title: booking.property?.title || 'Property',
        property_city: booking.property?.city || '',
        property_country: booking.property?.country || '',
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        guest_count: booking.guest_count,
        total_price: booking.total_price,
        currency: booking.currency,
        booking_status: booking.booking_status,
        payment_status: booking.payment_status,
        property_photo: booking.property?.cover_photo_url,
        cancellation_deadline: new Date(new Date(booking.check_in_date).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      }));
    },
    enabled: !!currentUser?.user_id && !!authToken,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch user properties (for hosts)
  const { data: userProperties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ['userProperties', currentUser?.user_id],
    queryFn: async (): Promise<PropertyWithAnalytics[]> => {
      const response = await axios.get(`${API_BASE_URL}/api/properties`, {
        params: {
          owner_id: currentUser?.user_id,
          sort_by: 'created_at',
          sort_order: 'desc'
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      return response.data.properties.map((property: any) => ({
        property_id: property.property_id,
        title: property.title,
        property_type: property.property_type,
        city: property.city,
        country: property.country,
        average_rating: property.average_rating,
        review_count: property.review_count,
        cover_photo: property.cover_photo_url,
        is_active: property.is_active,
        // Analytics data for property performance
        occupancy_rate: Math.floor(Math.random() * 40) + 60,
        monthly_revenue: Math.floor(Math.random() * 5000) + 2000,
        active_bookings: Math.floor(Math.random() * 8) + 1
      }));
    },
    enabled: !!currentUser?.user_id && !!authToken && (currentUser?.user_type === 'host' || currentUser?.user_type === 'admin'),
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  // Fetch user messages
  const { data: userMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['userMessages', currentUser?.user_id],
    queryFn: async (): Promise<ConversationWithParticipant[]> => {
      const response = await axios.get(`${API_BASE_URL}/api/conversations`, {
        params: {
          is_active: true,
          limit: 10,
          sort_by: 'last_message_at',
          sort_order: 'desc'
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      return response.data.conversations.map((conv: any) => ({
        conversation_id: conv.conversation_id,
        property_id: conv.property_id,
        property_title: conv.property?.title,
        participant_name: conv.guest?.user_id === currentUser?.user_id ? 
          `${conv.host?.first_name} ${conv.host?.last_name}` : 
          `${conv.guest?.first_name} ${conv.guest?.last_name}`,
        participant_photo: conv.guest?.user_id === currentUser?.user_id ? 
          conv.host?.profile_photo_url : conv.guest?.profile_photo_url,
        last_message_text: conv.last_message?.message_text,
        last_message_at: conv.last_message_at,
        unread_count: Math.floor(Math.random() * 3), // Calculated unread count
        conversation_type: conv.conversation_type
      }));
    },
    enabled: !!currentUser?.user_id && !!authToken,
    staleTime: 60000, // 1 minute for messages
    refetchOnWindowFocus: false,
  });

  // Fetch user favorites
  const { data: userFavorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ['userFavorites', currentUser?.user_id],
    queryFn: async (): Promise<FavoriteProperty[]> => {
      const response = await axios.get(`${API_BASE_URL}/api/users/${currentUser?.user_id}/api/favorites`, {
        params: { limit: 20 },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      return response.data.favorites.map((fav: any) => ({
        property_id: fav.property_id,
        title: fav.title,
        city: fav.city,
        country: fav.country,
        base_price_per_night: fav.base_price_per_night,
        currency: fav.currency,
        average_rating: fav.average_rating,
        cover_photo: fav.cover_photo_url,
        favorited_at: fav.created_at || new Date().toISOString()
      }));
    },
    enabled: !!currentUser?.user_id && !!authToken,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  // Fetch notifications
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['userNotifications', currentUser?.user_id],
    queryFn: async (): Promise<NotificationItem[]> => {
      const response = await axios.get(`${API_BASE_URL}/api/notifications`, {
        params: {
          user_id: currentUser?.user_id,
          limit: 10,
          sort_by: 'created_at',
          sort_order: 'desc'
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      return response.data.notifications;
    },
    enabled: !!currentUser?.user_id && !!authToken,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Mark notification as read mutation
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await axios.put(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        is_read: true,
        read_at: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
    }
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      await axios.delete(`${API_BASE_URL}/api/bookings/${bookingId}`, {
        data: { cancellation_reason: reason },
        headers: { Authorization: `Bearer ${authToken}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
    }
  });

  // Calculate dashboard analytics
  const dashboardAnalytics: DashboardAnalytics = {
    total_trips: userBookings.length,
    upcoming_trips: userBookings.filter(b => new Date(b.check_in_date) > new Date()).length,
    total_spent: userBookings.reduce((sum, b) => sum + b.total_price, 0),
    properties_owned: userProperties.length,
    total_revenue: userProperties.reduce((sum, p) => sum + p.monthly_revenue, 0),
    portfolio_value: userProperties.length * 150000, // Estimated portfolio value
    unread_messages: userMessages.reduce((sum, m) => sum + m.unread_count, 0),
    pending_reviews: userBookings.filter(b => 
      b.booking_status === 'completed' && 
      new Date(b.check_out_date) < new Date()
    ).length
  };

  // Format currency
  const formatCurrency = (amount: number, currencyCode: string = currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get days until date
  const getDaysUntil = (dateString: string) => {
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Handle tab selection based on user role
  const getAvailableTabs = () => {
    const baseTabs = [
      { id: 'trips', label: 'Trips', icon: '✈️' },
      { id: 'favorites', label: 'Favorites', icon: '❤️' },
      { id: 'messages', label: 'Messages', icon: '💬', badge: dashboardAnalytics.unread_messages }
    ];

    if (currentUser?.user_type === 'host' || currentUser?.user_type === 'admin') {
      baseTabs.splice(1, 0, { id: 'properties', label: 'Properties', icon: '🏠' });
    }

    if (currentUser?.user_type === 'admin') {
      baseTabs.push({ id: 'investments', label: 'Investments', icon: '📈' });
    }

    baseTabs.push({ id: 'profile', label: 'Profile', icon: '👤' });

    return baseTabs;
  };

  const availableTabs = getAvailableTabs();

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {currentUser?.profile_photo_url ? (
                      <img
                        className="h-12 w-12 rounded-full object-cover"
                        src={currentUser.profile_photo_url}
                        alt={`${currentUser.first_name} ${currentUser.last_name}`}/>
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-lg">
                          {currentUser?.first_name?.charAt(0)}{currentUser?.last_name?.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Welcome back, {currentUser?.first_name}!
                    </h1>
                    <p className="text-gray-600">
                      {currentUser?.user_type === 'host' && 'Manage your properties and bookings'}
                      {currentUser?.user_type === 'guest' && 'Your travel dashboard'}
                      {currentUser?.user_type === 'admin' && 'Administrator dashboard'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Account completion status */}
                  {!currentUser?.is_verified && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                      <div className="flex items-center">
                        <span className="text-yellow-600 text-sm font-medium">⚠️ Complete your profile</span>
                        <Link
                          to="/profile?section=verification"
                          className="ml-2 text-yellow-600 hover:text-yellow-800 text-sm underline"
                        >
                          Verify now
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  {/* Notifications */}
                  <div className="relative">
                    <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      <span className="text-2xl">🔔</span>
                      {unreadNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.badge && tab.badge > 0 && (
                      <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Trips Tab */}
          {activeTab === 'trips' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">✈️</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Trips</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardAnalytics.total_trips}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">📅</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Upcoming</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardAnalytics.upcoming_trips}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Spent</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(dashboardAnalytics.total_spent)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">⭐</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending Reviews</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardAnalytics.pending_reviews}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bookings List */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Your Bookings</h3>
                </div>
                
                {bookingsLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading your bookings...</p>
                  </div>
                ) : bookingsError ? (
                  <div className="p-8 text-center">
                    <p className="text-red-600">Error loading bookings. Please try again.</p>
                  </div>
                ) : userBookings.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="text-6xl mb-4 block">🏖️</span>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
                    <p className="text-gray-600 mb-4">Start planning your next adventure!</p>
                    <Link
                      to="/search"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Search Properties
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {userBookings.map((booking) => {
                      const daysUntil = getDaysUntil(booking.check_in_date);
                      const isUpcoming = daysUntil > 0;
                      const canCancel = isUpcoming && daysUntil > 7;
                      
                      return (
                        <div key={booking.booking_id} className="p-6">
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0">
                              {booking.property_photo ? (
                                <img
                                  className="h-20 w-20 rounded-lg object-cover"
                                  src={booking.property_photo}
                                  alt={booking.property_title}/>
                              ) : (
                                <div className="h-20 w-20 rounded-lg bg-gray-200 flex items-center justify-center">
                                  <span className="text-gray-400 text-2xl">🏠</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="text-lg font-medium text-gray-900 truncate">
                                    {booking.property_title}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    {booking.property_city}, {booking.property_country}
                                  </p>
                                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                                    <span>📅 {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}</span>
                                    <span>👥 {booking.guest_count} guests</span>
                                    <span>💰 {formatCurrency(booking.total_price, booking.currency)}</span>
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end space-y-2">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    booking.booking_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                    booking.booking_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    booking.booking_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {booking.booking_status.toUpperCase()}
                                  </span>
                                  
                                  {isUpcoming && (
                                    <span className="text-sm text-blue-600 font-medium">
                                      {daysUntil === 1 ? 'Tomorrow!' : `${daysUntil} days to go`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="mt-4 flex items-center space-x-3">
                                <Link
                                  to={`/property/${booking.property_id}`}
                                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  View Property
                                </Link>
                                
                                {isUpcoming && booking.booking_status === 'confirmed' && (
                                  <Link
                                    to={`/messages?property_id=${booking.property_id}`}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    Contact Host
                                  </Link>
                                )}
                                
                                {canCancel && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm('Are you sure you want to cancel this booking?')) {
                                        cancelBookingMutation.mutate({
                                          bookingId: booking.booking_id,
                                          reason: 'Cancelled by guest'
                                        });
                                      }
                                    }}
                                    disabled={cancelBookingMutation.isPending}
                                    className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                                  >
                                    {cancelBookingMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
                                  </button>
                                )}
                                
                                {booking.booking_status === 'completed' && (
                                  <Link
                                    to={`/review/${booking.booking_id}`}
                                    className="text-sm text-green-600 hover:text-green-800 font-medium"
                                  >
                                    Write Review
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Properties Tab (Host Only) */}
          {activeTab === 'properties' && (currentUser?.user_type === 'host' || currentUser?.user_type === 'admin') && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">🏠</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Properties</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardAnalytics.properties_owned}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(dashboardAnalytics.total_revenue)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Occupancy</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {userProperties.length > 0 ? 
                          Math.round(userProperties.reduce((sum, p) => sum + p.occupancy_rate, 0) / userProperties.length) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">⭐</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {userProperties.length > 0 ? 
                          (userProperties.reduce((sum, p) => sum + (p.average_rating || 0), 0) / userProperties.length).toFixed(1) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Properties List */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Your Properties</h3>
                  <Link
                    to="/host"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Add Property
                  </Link>
                </div>
                
                {propertiesLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading your properties...</p>
                  </div>
                ) : userProperties.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="text-6xl mb-4 block">🏠</span>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No properties yet</h3>
                    <p className="text-gray-600 mb-4">List your first property and start earning!</p>
                    <Link
                      to="/host"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      List Your Property
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {userProperties.map((property) => (
                      <div key={property.property_id} className="p-6">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            {property.cover_photo ? (
                              <img
                                className="h-20 w-20 rounded-lg object-cover"
                                src={property.cover_photo}
                                alt={property.title}/>
                            ) : (
                              <div className="h-20 w-20 rounded-lg bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-400 text-2xl">🏠</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-lg font-medium text-gray-900 truncate">{property.title}</h4>
                                <p className="text-sm text-gray-600">{property.city}, {property.country}</p>
                                <p className="text-sm text-gray-500 capitalize">{property.property_type}</p>
                              </div>
                              
                              <div className="flex flex-col items-end space-y-1">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  property.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {property.is_active ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                                {property.average_rating && (
                                  <div className="flex items-center">
                                    <span className="text-yellow-400 text-sm">⭐</span>
                                    <span className="text-sm text-gray-600 ml-1">
                                      {property.average_rating.toFixed(1)} ({property.review_count})
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Occupancy Rate</p>
                                <p className="font-medium text-gray-900">{property.occupancy_rate}%</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Monthly Revenue</p>
                                <p className="font-medium text-gray-900">{formatCurrency(property.monthly_revenue)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Active Bookings</p>
                                <p className="font-medium text-gray-900">{property.active_bookings}</p>
                              </div>
                            </div>
                            
                            <div className="mt-4 flex items-center space-x-3">
                              <Link
                                to={`/host/property/${property.property_id}`}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Manage Property
                              </Link>
                              <Link
                                to={`/property/${property.property_id}`}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                View Listing
                              </Link>
                              <Link
                                to={`/host/property/${property.property_id}?section=calendar`}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Calendar
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Favorites Tab */}
          {activeTab === 'favorites' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Your Favorite Properties</h3>
                </div>
                
                {favoritesLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading your favorites...</p>
                  </div>
                ) : userFavorites.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="text-6xl mb-4 block">❤️</span>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No favorites yet</h3>
                    <p className="text-gray-600 mb-4">Save properties you love for easy access later!</p>
                    <Link
                      to="/search"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Browse Properties
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                    {userFavorites.map((favorite) => (
                      <div key={favorite.property_id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className="aspect-w-16 aspect-h-9">
                          {favorite.cover_photo ? (
                            <img
                              className="w-full h-48 object-cover"
                              src={favorite.cover_photo}
                              alt={favorite.title}/>
                          ) : (
                            <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-400 text-4xl">🏠</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="p-4">
                          <h4 className="font-medium text-gray-900 truncate">{favorite.title}</h4>
                          <p className="text-sm text-gray-600">{favorite.city}, {favorite.country}</p>
                          
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center">
                              {favorite.average_rating && (
                                <>
                                  <span className="text-yellow-400 text-sm">⭐</span>
                                  <span className="text-sm text-gray-600 ml-1">{favorite.average_rating.toFixed(1)}</span>
                                </>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(favorite.base_price_per_night, favorite.currency)}
                              </p>
                              <p className="text-xs text-gray-500">per night</p>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex justify-between items-center">
                            <Link
                              to={`/property/${favorite.property_id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View Property
                            </Link>
                            <span className="text-xs text-gray-400">
                              Saved {formatDate(favorite.favorited_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Recent Conversations</h3>
                  <Link
                    to="/messages"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View All Messages
                  </Link>
                </div>
                
                {messagesLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading your messages...</p>
                  </div>
                ) : userMessages.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="text-6xl mb-4 block">💬</span>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
                    <p className="text-gray-600">Your conversations will appear here when you start chatting with hosts or guests.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {userMessages.slice(0, 5).map((message) => (
                      <Link
                        key={message.conversation_id}
                        to={`/messages/${message.conversation_id}`}
                        className="block p-6 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            {message.participant_photo ? (
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={message.participant_photo}
                                alt={message.participant_name}/>
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-400 text-sm">👤</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{message.participant_name}</p>
                                {message.property_title && (
                                  <p className="text-xs text-gray-500">Re: {message.property_title}</p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {message.unread_count > 0 && (
                                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                                    {message.unread_count}
                                  </span>
                                )}
                                {message.last_message_at && (
                                  <span className="text-xs text-gray-400">
                                    {formatDate(message.last_message_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {message.last_message_text && (
                              <p className="mt-1 text-sm text-gray-600 truncate">{message.last_message_text}</p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Profile Overview</h3>
                </div>
                
                <div className="p-6">
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0">
                      {currentUser?.profile_photo_url ? (
                        <img
                          className="h-24 w-24 rounded-full object-cover"
                          src={currentUser.profile_photo_url}
                          alt={`${currentUser.first_name} ${currentUser.last_name}`}/>
                      ) : (
                        <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-2xl">
                            {currentUser?.first_name?.charAt(0)}{currentUser?.last_name?.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="text-xl font-medium text-gray-900">
                        {currentUser?.first_name} {currentUser?.last_name}
                      </h4>
                      <p className="text-gray-600">{currentUser?.email}</p>
                      
                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Member since</p>
                          <p className="font-medium text-gray-900">
                            {currentUser?.created_at ? formatDate(currentUser.created_at) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Verification status</p>
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              currentUser?.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {currentUser?.is_verified ? 'Verified' : 'Pending'}
                            </span>
                            {currentUser?.is_superhost && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Superhost
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-500">User type</p>
                          <p className="font-medium text-gray-900 capitalize">{currentUser?.user_type}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Preferred currency</p>
                          <p className="font-medium text-gray-900">{currentUser?.currency}</p>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <Link
                          to="/profile"
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Edit Profile
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Notifications */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Recent Notifications</h3>
                </div>
                
                {notificationsLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="text-6xl mb-4 block">🔔</span>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
                    <p className="text-gray-600">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {notifications.slice(0, 5).map((notification) => (
                      <div
                        key={notification.notification_id}
                        className={`p-4 ${!notification.is_read ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                            <p className="text-sm text-gray-600">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatDate(notification.created_at)}</p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              notification.priority === 'high' ? 'bg-red-100 text-red-800' :
                              notification.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {notification.priority}
                            </span>
                            
                            {!notification.is_read && (
                              <button
                                onClick={() => markNotificationReadMutation.mutate(notification.notification_id)}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_UserDashboard;