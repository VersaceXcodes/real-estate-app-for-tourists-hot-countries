import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// Types based on backend schemas
interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  profile_photo_url?: string;
  user_type: 'guest' | 'host' | 'admin';
  bio?: string;
  languages_spoken?: string[];
  is_verified: boolean;
  is_superhost: boolean;
  currency: string;
  language: string;
  temperature_unit: 'celsius' | 'fahrenheit';
  notification_settings?: Record<string, boolean>;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  address?: string;
  date_of_birth?: string;
  government_id_number?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

interface Property {
  property_id: string;
  owner_id: string;
  title: string;
  description: string;
  property_type: string;
  country: string;
  city: string;
  region?: string;
  neighborhood?: string;
  address: string;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  guest_count: number;
  property_size?: number;
  distance_beach?: number;
  distance_airport?: number;
  base_price_per_night: number;
  currency: string;
  cleaning_fee?: number;
  security_deposit?: number;
  extra_guest_fee?: number;
  pet_fee?: number;
  amenities: string[];
  house_rules: string[];
  check_in_time: string;
  check_out_time: string;
  minimum_stay: number;
  maximum_stay?: number;
  instant_booking: boolean;
  host_language: string[];
  cancellation_policy: 'flexible' | 'moderate' | 'strict';
  is_active: boolean;
  is_verified: boolean;
  average_rating?: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

interface Booking {
  booking_id: string;
  property_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  adults: number;
  children: number;
  infants: number;
  nights: number;
  base_price: number;
  cleaning_fee: number;
  service_fee: number;
  taxes_and_fees: number;
  total_price: number;
  currency: string;
  special_requests?: string;
  booking_status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  cancellation_reason?: string;
  cancelled_at?: string;
  check_in_instructions?: string;
  access_code?: string;
  created_at: string;
  updated_at: string;
}

interface Notification {
  notification_id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  priority: 'low' | 'normal' | 'high';
  expires_at?: string;
  created_at: string;
}

interface SystemAlert {
  alert_id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  affected_locations?: string[];
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  created_at: string;
  updated_at: string;
}

interface SavedSearch {
  search_id: string;
  user_id: string;
  search_name: string;
  destination?: string;
  check_in_date?: string;
  check_out_date?: string;
  guest_count?: number;
  property_type?: string;
  price_min?: number;
  price_max?: number;
  amenities?: string[];
  instant_booking?: boolean;
  distance_beach?: number;
  distance_airport?: number;
  host_language?: string;
  sort_by?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface InvestmentAnalytics {
  analytics_id: string;
  property_id: string;
  owner_id: string;
  purchase_price?: number;
  purchase_date?: string;
  current_value?: number;
  annual_rental_income: number;
  annual_expenses: number;
  occupancy_rate: number;
  rental_yield?: number;
  capital_appreciation?: number;
  total_return?: number;
  roi_percentage?: number;
  year: number;
  created_at: string;
  updated_at: string;
}

// Global State Interfaces
interface AuthenticationState {
  current_user: User | null;
  auth_token: string | null;
  authentication_status: {
    is_authenticated: boolean;
    is_loading: boolean;
  };
  error_message: string | null;
}

interface SearchState {
  destination: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  guest_count: number;
  applied_filters: Record<string, any>;
  search_results: Property[];
  search_loading: boolean;
  saved_searches: SavedSearch[];
}

interface BookingState {
  current_booking: Booking | null;
  booking_step: number;
  booking_loading: boolean;
  payment_processing: boolean;
  booking_error: string | null;
}

interface UserPreferences {
  currency: string;
  language: string;
  temperature_unit: 'celsius' | 'fahrenheit';
  notification_settings: Record<string, boolean>;
}

interface NotificationsState {
  unread_messages: number;
  unread_notifications: number;
  system_alerts: SystemAlert[];
}

interface PropertyManagementState {
  owned_properties: Property[];
  property_analytics: Record<string, any>;
  booking_requests: Booking[];
  is_loading: boolean;
}

interface InvestmentState {
  portfolio: InvestmentAnalytics[];
  market_data: any[];
  roi_tracking: Record<string, any>;
  is_loading: boolean;
}

// Main App Store Interface
interface AppStore {
  // Global State
  authentication_state: AuthenticationState;
  search_state: SearchState;
  booking_state: BookingState;
  user_preferences: UserPreferences;
  notifications_state: NotificationsState;
  property_management_state: PropertyManagementState;
  investment_state: InvestmentState;

  // WebSocket
  socket: Socket | null;
  is_connected: boolean;

  // Authentication Actions
  login_user: (email: string, password: string) => Promise<void>;
  register_user: (userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    user_type?: 'guest' | 'host' | 'admin';
    currency?: string;
    language?: string;
    temperature_unit?: 'celsius' | 'fahrenheit';
  }) => Promise<void>;
  logout_user: () => void;
  initialize_auth: () => Promise<void>;
  clear_auth_error: () => void;
  update_user_profile: (userData: Partial<User>) => void;

  // User Preferences Actions
  update_currency: (currency: string) => void;
  update_language: (language: string) => void;
  update_temperature_unit: (unit: 'celsius' | 'fahrenheit') => void;
  update_notification_settings: (settings: Record<string, boolean>) => void;

  // Search State Actions
  update_search_criteria: (criteria: Partial<SearchState>) => void;
  set_search_results: (results: Property[]) => void;
  add_saved_search: (search: SavedSearch) => void;
  remove_saved_search: (search_id: string) => void;
  clear_search_results: () => void;

  // Booking State Actions
  set_current_booking: (booking: Booking | null) => void;
  update_booking_step: (step: number) => void;
  set_booking_loading: (loading: boolean) => void;
  set_payment_processing: (processing: boolean) => void;
  set_booking_error: (error: string | null) => void;
  clear_booking_state: () => void;

  // Notifications Actions
  set_unread_messages: (count: number) => void;
  set_unread_notifications: (count: number) => void;
  add_notification: (notification: Notification) => void;
  mark_notification_read: (notification_id: string) => void;
  set_system_alerts: (alerts: SystemAlert[]) => void;
  add_system_alert: (alert: SystemAlert) => void;

  // Property Management Actions (for hosts)
  set_owned_properties: (properties: Property[]) => void;
  add_owned_property: (property: Property) => void;
  update_owned_property: (property_id: string, updates: Partial<Property>) => void;
  remove_owned_property: (property_id: string) => void;
  set_property_analytics: (analytics: Record<string, any>) => void;
  set_booking_requests: (requests: Booking[]) => void;
  set_property_management_loading: (loading: boolean) => void;

  // Investment State Actions (for investors)
  set_investment_portfolio: (portfolio: InvestmentAnalytics[]) => void;
  add_investment: (investment: InvestmentAnalytics) => void;
  update_investment: (analytics_id: string, updates: Partial<InvestmentAnalytics>) => void;
  set_market_data: (data: any[]) => void;
  set_roi_tracking: (tracking: Record<string, any>) => void;
  set_investment_loading: (loading: boolean) => void;

  // WebSocket Actions
  initialize_socket: () => void;
  disconnect_socket: () => void;
  join_conversation: (conversation_id: string) => void;
  leave_conversation: (conversation_id: string) => void;
  send_typing_indicator: (conversation_id: string, is_typing: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial State
      authentication_state: {
        current_user: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: true,
        },
        error_message: null,
      },

      search_state: {
        destination: null,
        check_in_date: null,
        check_out_date: null,
        guest_count: 1,
        applied_filters: {},
        search_results: [],
        search_loading: false,
        saved_searches: [],
      },

      booking_state: {
        current_booking: null,
        booking_step: 1,
        booking_loading: false,
        payment_processing: false,
        booking_error: null,
      },

      user_preferences: {
        currency: 'USD',
        language: 'en',
        temperature_unit: 'celsius',
        notification_settings: {
          email: true,
          sms: false,
          push: true,
        },
      },

      notifications_state: {
        unread_messages: 0,
        unread_notifications: 0,
        system_alerts: [],
      },

      property_management_state: {
        owned_properties: [],
        property_analytics: {},
        booking_requests: [],
        is_loading: false,
      },

      investment_state: {
        portfolio: [],
        market_data: [],
        roi_tracking: {},
        is_loading: false,
      },

      socket: null,
      is_connected: false,

      // Authentication Actions
      login_user: async (email: string, password: string) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/login`,
            { email, password },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { user, token } = response.data;

          set((_) => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
            user_preferences: {
              currency: user.currency || 'USD',
              language: user.language || 'en',
              temperature_unit: user.temperature_unit || 'celsius',
              notification_settings: user.notification_settings || {
                email: true,
                sms: false,
                push: true,
              },
            },
          }));

          // Initialize WebSocket connection after successful login
          get().initialize_socket();
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Login failed';
          
          set((_) => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: errorMessage,
            },
          }));
          throw new Error(errorMessage);
        }
      },

      register_user: async (userData) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: true,
            },
            error_message: null,
          },
        }));

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/register`,
            {
              email: userData.email,
              password: userData.password,
              first_name: userData.first_name,
              last_name: userData.last_name,
              phone_number: userData.phone_number,
              user_type: userData.user_type || 'guest',
              currency: userData.currency || 'USD',
              language: userData.language || 'en',
              temperature_unit: userData.temperature_unit || 'celsius',
            },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const { user, token } = response.data;

          set((_) => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
            user_preferences: {
              currency: user.currency || 'USD',
              language: user.language || 'en',
              temperature_unit: user.temperature_unit || 'celsius',
              notification_settings: user.notification_settings || {
                email: true,
                sms: false,
                push: true,
              },
            },
          }));

          // Initialize WebSocket connection after successful registration
          get().initialize_socket();
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
          
          set((_) => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: errorMessage,
            },
          }));
          throw new Error(errorMessage);
        }
      },

      logout_user: () => {
        const { socket } = get();
        
        // Disconnect WebSocket
        if (socket) {
          socket.disconnect();
        }

        set((_) => ({
          authentication_state: {
            current_user: null,
            auth_token: null,
            authentication_status: {
              is_authenticated: false,
              is_loading: false,
            },
            error_message: null,
          },
          socket: null,
          is_connected: false,
          // Clear user-specific data
          property_management_state: {
            owned_properties: [],
            property_analytics: {},
            booking_requests: [],
            is_loading: false,
          },
          investment_state: {
            portfolio: [],
            market_data: [],
            roi_tracking: {},
            is_loading: false,
          },
          notifications_state: {
            unread_messages: 0,
            unread_notifications: 0,
            system_alerts: [],
          },
        }));
      },

      initialize_auth: async () => {
        const { authentication_state } = get();
        const token = authentication_state.auth_token;
        
        if (!token) {
          set((state) => ({
            authentication_state: {
              ...state.authentication_state,
              authentication_status: {
                ...state.authentication_state.authentication_status,
                is_loading: false,
              },
            },
          }));
          return;
        }

        try {
          const response = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/me`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const user = response.data;
          
          set((_) => ({
            authentication_state: {
              current_user: user,
              auth_token: token,
              authentication_status: {
                is_authenticated: true,
                is_loading: false,
              },
              error_message: null,
            },
            user_preferences: {
              currency: user.currency || 'USD',
              language: user.language || 'en',
              temperature_unit: user.temperature_unit || 'celsius',
              notification_settings: user.notification_settings || {
                email: true,
                sms: false,
                push: true,
              },
            },
          }));

          // Initialize WebSocket connection
          get().initialize_socket();
        } catch (error) {
          // Token is invalid, clear auth state
          set((_) => ({
            authentication_state: {
              current_user: null,
              auth_token: null,
              authentication_status: {
                is_authenticated: false,
                is_loading: false,
              },
              error_message: null,
            },
          }));
        }
      },

      clear_auth_error: () => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            error_message: null,
          },
        }));
      },

      update_user_profile: (userData: Partial<User>) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            current_user: state.authentication_state.current_user
              ? { ...state.authentication_state.current_user, ...userData }
              : null,
          },
        }));
      },

      // User Preferences Actions
      update_currency: (currency: string) => {
        set((state) => ({
          user_preferences: {
            ...state.user_preferences,
            currency,
          },
        }));
      },

      update_language: (language: string) => {
        set((state) => ({
          user_preferences: {
            ...state.user_preferences,
            language,
          },
        }));
      },

      update_temperature_unit: (unit: 'celsius' | 'fahrenheit') => {
        set((state) => ({
          user_preferences: {
            ...state.user_preferences,
            temperature_unit: unit,
          },
        }));
      },

      update_notification_settings: (settings: Record<string, boolean>) => {
        set((state) => ({
          user_preferences: {
            ...state.user_preferences,
            notification_settings: { ...state.user_preferences.notification_settings, ...settings },
          },
        }));
      },

      // Search State Actions
      update_search_criteria: (criteria: Partial<SearchState>) => {
        set((state) => ({
          search_state: {
            ...state.search_state,
            ...criteria,
          },
        }));
      },

      set_search_results: (results: Property[]) => {
        set((state) => ({
          search_state: {
            ...state.search_state,
            search_results: results,
            search_loading: false,
          },
        }));
      },

      add_saved_search: (search: SavedSearch) => {
        set((state) => ({
          search_state: {
            ...state.search_state,
            saved_searches: [...state.search_state.saved_searches, search],
          },
        }));
      },

      remove_saved_search: (search_id: string) => {
        set((state) => ({
          search_state: {
            ...state.search_state,
            saved_searches: state.search_state.saved_searches.filter(
              search => search.search_id !== search_id
            ),
          },
        }));
      },

      clear_search_results: () => {
        set((state) => ({
          search_state: {
            ...state.search_state,
            search_results: [],
            search_loading: false,
          },
        }));
      },

      // Booking State Actions
      set_current_booking: (booking: Booking | null) => {
        set((state) => ({
          booking_state: {
            ...state.booking_state,
            current_booking: booking,
          },
        }));
      },

      update_booking_step: (step: number) => {
        set((state) => ({
          booking_state: {
            ...state.booking_state,
            booking_step: step,
          },
        }));
      },

      set_booking_loading: (loading: boolean) => {
        set((state) => ({
          booking_state: {
            ...state.booking_state,
            booking_loading: loading,
          },
        }));
      },

      set_payment_processing: (processing: boolean) => {
        set((state) => ({
          booking_state: {
            ...state.booking_state,
            payment_processing: processing,
          },
        }));
      },

      set_booking_error: (error: string | null) => {
        set((state) => ({
          booking_state: {
            ...state.booking_state,
            booking_error: error,
          },
        }));
      },

      clear_booking_state: () => {
        set((_) => ({
          booking_state: {
            current_booking: null,
            booking_step: 1,
            booking_loading: false,
            payment_processing: false,
            booking_error: null,
          },
        }));
      },

      // Notifications Actions
      set_unread_messages: (count: number) => {
        set((state) => ({
          notifications_state: {
            ...state.notifications_state,
            unread_messages: count,
          },
        }));
      },

      set_unread_notifications: (count: number) => {
        set((state) => ({
          notifications_state: {
            ...state.notifications_state,
            unread_notifications: count,
          },
        }));
      },

      add_notification: (_: Notification) => {
        set((state) => ({
          notifications_state: {
            ...state.notifications_state,
            unread_notifications: state.notifications_state.unread_notifications + 1,
          },
        }));
      },

      mark_notification_read: (_: string) => {
        set((state) => ({
          notifications_state: {
            ...state.notifications_state,
            unread_notifications: Math.max(0, state.notifications_state.unread_notifications - 1),
          },
        }));
      },

      set_system_alerts: (alerts: SystemAlert[]) => {
        set((state) => ({
          notifications_state: {
            ...state.notifications_state,
            system_alerts: alerts,
          },
        }));
      },

      add_system_alert: (alert: SystemAlert) => {
        set((state) => ({
          notifications_state: {
            ...state.notifications_state,
            system_alerts: [...state.notifications_state.system_alerts, alert],
          },
        }));
      },

      // Property Management Actions
      set_owned_properties: (properties: Property[]) => {
        set((state) => ({
          property_management_state: {
            ...state.property_management_state,
            owned_properties: properties,
            is_loading: false,
          },
        }));
      },

      add_owned_property: (property: Property) => {
        set((state) => ({
          property_management_state: {
            ...state.property_management_state,
            owned_properties: [...state.property_management_state.owned_properties, property],
          },
        }));
      },

      update_owned_property: (property_id: string, updates: Partial<Property>) => {
        set((state) => ({
          property_management_state: {
            ...state.property_management_state,
            owned_properties: state.property_management_state.owned_properties.map(
              property => property.property_id === property_id 
                ? { ...property, ...updates }
                : property
            ),
          },
        }));
      },

      remove_owned_property: (property_id: string) => {
        set((state) => ({
          property_management_state: {
            ...state.property_management_state,
            owned_properties: state.property_management_state.owned_properties.filter(
              property => property.property_id !== property_id
            ),
          },
        }));
      },

      set_property_analytics: (analytics: Record<string, any>) => {
        set((state) => ({
          property_management_state: {
            ...state.property_management_state,
            property_analytics: analytics,
          },
        }));
      },

      set_booking_requests: (requests: Booking[]) => {
        set((state) => ({
          property_management_state: {
            ...state.property_management_state,
            booking_requests: requests,
          },
        }));
      },

      set_property_management_loading: (loading: boolean) => {
        set((state) => ({
          property_management_state: {
            ...state.property_management_state,
            is_loading: loading,
          },
        }));
      },

      // Investment State Actions
      set_investment_portfolio: (portfolio: InvestmentAnalytics[]) => {
        set((state) => ({
          investment_state: {
            ...state.investment_state,
            portfolio,
            is_loading: false,
          },
        }));
      },

      add_investment: (investment: InvestmentAnalytics) => {
        set((state) => ({
          investment_state: {
            ...state.investment_state,
            portfolio: [...state.investment_state.portfolio, investment],
          },
        }));
      },

      update_investment: (analytics_id: string, updates: Partial<InvestmentAnalytics>) => {
        set((state) => ({
          investment_state: {
            ...state.investment_state,
            portfolio: state.investment_state.portfolio.map(
              investment => investment.analytics_id === analytics_id 
                ? { ...investment, ...updates }
                : investment
            ),
          },
        }));
      },

      set_market_data: (data: any[]) => {
        set((state) => ({
          investment_state: {
            ...state.investment_state,
            market_data: data,
          },
        }));
      },

      set_roi_tracking: (tracking: Record<string, any>) => {
        set((state) => ({
          investment_state: {
            ...state.investment_state,
            roi_tracking: tracking,
          },
        }));
      },

      set_investment_loading: (loading: boolean) => {
        set((state) => ({
          investment_state: {
            ...state.investment_state,
            is_loading: loading,
          },
        }));
      },

      // WebSocket Actions
      initialize_socket: () => {
        const { authentication_state, socket } = get();
        
        if (socket || !authentication_state.auth_token) return;

        const newSocket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', {
          autoConnect: true,
        });

        newSocket.on('connect', () => {
          console.log('WebSocket connected');
          set((_) => ({ is_connected: true }));
          
          // Authenticate the socket connection
          newSocket.emit('authenticate', authentication_state.auth_token);
        });

        newSocket.on('disconnect', () => {
          console.log('WebSocket disconnected');
          set((_) => ({ is_connected: false }));
        });

        newSocket.on('authenticated', (data) => {
          console.log('Socket authenticated:', data);
        });

        newSocket.on('authentication_failed', (data) => {
          console.error('Socket authentication failed:', data);
        });

        // Real-time message events
        newSocket.on('message_sent', (data) => {
          console.log('Message sent:', data);
        });

        newSocket.on('message_received', (data) => {
          console.log('Message received:', data);
          set((state) => ({
            notifications_state: {
              ...state.notifications_state,
              unread_messages: state.notifications_state.unread_messages + 1,
            },
          }));
        });

        newSocket.on('message_read', (data) => {
          console.log('Message read:', data);
        });

        // Booking events
        newSocket.on('booking_created', (data) => {
          console.log('Booking created:', data);
        });

        newSocket.on('booking_confirmed', (data) => {
          console.log('Booking confirmed:', data);
        });

        newSocket.on('booking_cancelled', (data) => {
          console.log('Booking cancelled:', data);
        });

        // Notification events
        newSocket.on('notification_received', (data) => {
          console.log('Notification received:', data);
          get().add_notification(data);
        });

        // Property events
        newSocket.on('property_availability_updated', (data) => {
          console.log('Property availability updated:', data);
        });

        newSocket.on('property_pricing_updated', (data) => {
          console.log('Property pricing updated:', data);
        });

        // System alerts
        newSocket.on('system_alert_created', (data) => {
          console.log('System alert:', data);
          get().add_system_alert(data);
        });

        set((_) => ({ socket: newSocket }));
      },

      disconnect_socket: () => {
        const { socket } = get();
        
        if (socket) {
          socket.disconnect();
          set((_) => ({ socket: null, is_connected: false }));
        }
      },

      join_conversation: (conversation_id: string) => {
        const { socket } = get();
        
        if (socket) {
          socket.emit('join_conversation', conversation_id);
        }
      },

      leave_conversation: (conversation_id: string) => {
        const { socket } = get();
        
        if (socket) {
          socket.emit('leave_conversation', conversation_id);
        }
      },

      send_typing_indicator: (conversation_id: string, is_typing: boolean) => {
        const { socket } = get();
        
        if (socket) {
          const event = is_typing ? 'typing_start' : 'typing_stop';
          socket.emit(event, { conversation_id });
        }
      },
    }),
    {
      name: 'sunvillas-app-storage',
      partialize: (state) => ({
        authentication_state: {
          current_user: state.authentication_state.current_user,
          auth_token: state.authentication_state.auth_token,
          authentication_status: {
            is_authenticated: state.authentication_state.authentication_status.is_authenticated,
            is_loading: false, // Never persist loading state
          },
          error_message: null, // Never persist errors
        },
        user_preferences: state.user_preferences,
        search_state: {
          ...state.search_state,
          search_results: [], // Don't persist search results
          search_loading: false, // Don't persist loading state
        },
        booking_state: {
          current_booking: state.booking_state.current_booking,
          booking_step: state.booking_state.booking_step,
          booking_loading: false, // Don't persist loading state
          payment_processing: false, // Don't persist processing state
          booking_error: null, // Don't persist errors
        },
      }),
    }
  )
);

// Export types for use in components
export type {
  User,
  Property,
  Booking,
  Notification,
  SystemAlert,
  SavedSearch,
  InvestmentAnalytics,
  AuthenticationState,
  SearchState,
  BookingState,
  UserPreferences,
  NotificationsState,
  PropertyManagementState,
  InvestmentState,
  AppStore,
};