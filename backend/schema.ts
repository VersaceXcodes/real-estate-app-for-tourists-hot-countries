import { z } from 'zod';

// ============================================================================
// USERS SCHEMAS
// ============================================================================

export const userSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone_number: z.string().nullable(),
  profile_photo_url: z.string().url().nullable(),
  user_type: z.enum(['guest', 'host', 'admin']),
  bio: z.string().nullable(),
  languages_spoken: z.array(z.string()).nullable(),
  is_verified: z.boolean(),
  is_superhost: z.boolean(),
  currency: z.string(),
  language: z.string(),
  temperature_unit: z.enum(['celsius', 'fahrenheit']),
  notification_settings: z.record(z.boolean()),
  emergency_contact_name: z.string().nullable(),
  emergency_contact_phone: z.string().nullable(),
  address: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  government_id_number: z.string().nullable(),
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createUserInputSchema = z.object({
  email: z.string().email().min(1).max(255),
  password: z.string().min(8).max(100),
  first_name: z.string().min(1).max(255),
  last_name: z.string().min(1).max(255),
  phone_number: z.string().max(50).nullable().optional(),
  profile_photo_url: z.string().url().max(500).nullable().optional(),
  user_type: z.enum(['guest', 'host', 'admin']).default('guest'),
  bio: z.string().max(1000).nullable().optional(),
  languages_spoken: z.array(z.string()).nullable().optional(),
  currency: z.string().length(3).default('USD'),
  language: z.string().length(2).default('en'),
  temperature_unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  notification_settings: z.record(z.boolean()).default({}),
  emergency_contact_name: z.string().max(255).nullable().optional(),
  emergency_contact_phone: z.string().max(50).nullable().optional(),
  address: z.string().nullable().optional(),
  date_of_birth: z.string().max(20).nullable().optional(),
  government_id_number: z.string().max(100).nullable().optional()
});

export const updateUserInputSchema = z.object({
  user_id: z.string(),
  email: z.string().email().min(1).max(255).optional(),
  first_name: z.string().min(1).max(255).optional(),
  last_name: z.string().min(1).max(255).optional(),
  phone_number: z.string().max(50).nullable().optional(),
  profile_photo_url: z.string().url().max(500).nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  languages_spoken: z.array(z.string()).nullable().optional(),
  currency: z.string().length(3).optional(),
  language: z.string().length(2).optional(),
  temperature_unit: z.enum(['celsius', 'fahrenheit']).optional(),
  notification_settings: z.record(z.boolean()).optional(),
  emergency_contact_name: z.string().max(255).nullable().optional(),
  emergency_contact_phone: z.string().max(50).nullable().optional(),
  address: z.string().nullable().optional(),
  date_of_birth: z.string().max(20).nullable().optional(),
  government_id_number: z.string().max(100).nullable().optional()
});

export const searchUsersInputSchema = z.object({
  query: z.string().optional(),
  user_type: z.enum(['guest', 'host', 'admin']).optional(),
  is_verified: z.boolean().optional(),
  is_superhost: z.boolean().optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'updated_at', 'first_name', 'last_name']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// PROPERTIES SCHEMAS
// ============================================================================

export const propertySchema = z.object({
  property_id: z.string(),
  owner_id: z.string(),
  title: z.string(),
  description: z.string(),
  property_type: z.string(),
  country: z.string(),
  city: z.string(),
  region: z.string().nullable(),
  neighborhood: z.string().nullable(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  bedrooms: z.number().int(),
  bathrooms: z.number(),
  guest_count: z.number().int(),
  property_size: z.number().nullable(),
  distance_beach: z.number().nullable(),
  distance_airport: z.number().nullable(),
  base_price_per_night: z.number(),
  currency: z.string(),
  cleaning_fee: z.number().nullable(),
  security_deposit: z.number().nullable(),
  extra_guest_fee: z.number().nullable(),
  pet_fee: z.number().nullable(),
  amenities: z.array(z.string()),
  house_rules: z.array(z.string()),
  check_in_time: z.string(),
  check_out_time: z.string(),
  minimum_stay: z.number().int(),
  maximum_stay: z.number().int().nullable(),
  instant_booking: z.boolean(),
  host_language: z.array(z.string()),
  cancellation_policy: z.enum(['flexible', 'moderate', 'strict']),
  is_active: z.boolean(),
  is_verified: z.boolean(),
  average_rating: z.number().nullable(),
  review_count: z.number().int(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createPropertyInputSchema = z.object({
  owner_id: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  property_type: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  region: z.string().max(100).nullable().optional(),
  neighborhood: z.string().max(100).nullable().optional(),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().min(0).max(50),
  guest_count: z.number().int().min(1).max(100),
  property_size: z.number().positive().nullable().optional(),
  distance_beach: z.number().nonnegative().nullable().optional(),
  distance_airport: z.number().nonnegative().nullable().optional(),
  base_price_per_night: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  cleaning_fee: z.number().nonnegative().nullable().optional(),
  security_deposit: z.number().nonnegative().nullable().optional(),
  extra_guest_fee: z.number().nonnegative().nullable().optional(),
  pet_fee: z.number().nonnegative().nullable().optional(),
  amenities: z.array(z.string()).default([]),
  house_rules: z.array(z.string()).default([]),
  check_in_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('15:00'),
  check_out_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('11:00'),
  minimum_stay: z.number().int().min(1).default(1),
  maximum_stay: z.number().int().positive().nullable().optional(),
  instant_booking: z.boolean().default(false),
  host_language: z.array(z.string()).default([]),
  cancellation_policy: z.enum(['flexible', 'moderate', 'strict']).default('moderate')
});

export const updatePropertyInputSchema = z.object({
  property_id: z.string(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).optional(),
  property_type: z.string().min(1).max(100).optional(),
  region: z.string().max(100).nullable().optional(),
  neighborhood: z.string().max(100).nullable().optional(),
  address: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().min(0).max(50).optional(),
  guest_count: z.number().int().min(1).max(100).optional(),
  property_size: z.number().positive().nullable().optional(),
  distance_beach: z.number().nonnegative().nullable().optional(),
  distance_airport: z.number().nonnegative().nullable().optional(),
  base_price_per_night: z.number().positive().optional(),
  cleaning_fee: z.number().nonnegative().nullable().optional(),
  security_deposit: z.number().nonnegative().nullable().optional(),
  extra_guest_fee: z.number().nonnegative().nullable().optional(),
  pet_fee: z.number().nonnegative().nullable().optional(),
  amenities: z.array(z.string()).optional(),
  house_rules: z.array(z.string()).optional(),
  check_in_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  check_out_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  minimum_stay: z.number().int().min(1).optional(),
  maximum_stay: z.number().int().positive().nullable().optional(),
  instant_booking: z.boolean().optional(),
  host_language: z.array(z.string()).optional(),
  cancellation_policy: z.enum(['flexible', 'moderate', 'strict']).optional(),
  is_active: z.boolean().optional()
});

export const searchPropertiesInputSchema = z.object({
  query: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  property_type: z.string().optional(),
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().positive().optional(),
  min_bedrooms: z.number().int().nonnegative().optional(),
  max_bedrooms: z.number().int().positive().optional(),
  min_bathrooms: z.number().nonnegative().optional(),
  max_bathrooms: z.number().positive().optional(),
  min_guest_count: z.number().int().positive().optional(),
  max_guest_count: z.number().int().positive().optional(),
  amenities: z.array(z.string()).optional(),
  instant_booking: z.boolean().optional(),
  is_verified: z.boolean().optional(),
  min_rating: z.number().min(0).max(5).optional(),
  max_distance_beach: z.number().nonnegative().optional(),
  max_distance_airport: z.number().nonnegative().optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['price', 'rating', 'created_at', 'distance_beach']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// PROPERTY PHOTOS SCHEMAS
// ============================================================================

export const propertyPhotoSchema = z.object({
  photo_id: z.string(),
  property_id: z.string(),
  photo_url: z.string().url(),
  photo_order: z.number().int(),
  is_cover_photo: z.boolean(),
  alt_text: z.string().nullable(),
  created_at: z.string()
});

export const createPropertyPhotoInputSchema = z.object({
  property_id: z.string(),
  photo_url: z.string().url().max(500),
  photo_order: z.number().int().min(1).optional(),
  is_cover_photo: z.boolean().default(false),
  alt_text: z.string().max(500).nullable().optional()
});

export const updatePropertyPhotoInputSchema = z.object({
  photo_id: z.string(),
  photo_order: z.number().int().min(1).optional(),
  is_cover_photo: z.boolean().optional(),
  alt_text: z.string().max(500).nullable().optional()
});

// ============================================================================
// BOOKINGS SCHEMAS
// ============================================================================

export const bookingSchema = z.object({
  booking_id: z.string(),
  property_id: z.string(),
  guest_id: z.string(),
  check_in_date: z.string(),
  check_out_date: z.string(),
  guest_count: z.number().int(),
  adults: z.number().int(),
  children: z.number().int(),
  infants: z.number().int(),
  nights: z.number().int(),
  base_price: z.number(),
  cleaning_fee: z.number(),
  service_fee: z.number(),
  taxes_and_fees: z.number(),
  total_price: z.number(),
  currency: z.string(),
  special_requests: z.string().nullable(),
  booking_status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  payment_status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  cancellation_reason: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  check_in_instructions: z.string().nullable(),
  access_code: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createBookingInputSchema = z.object({
  property_id: z.string(),
  guest_id: z.string(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guest_count: z.number().int().min(1).max(100),
  adults: z.number().int().min(1).max(100),
  children: z.number().int().min(0).default(0),
  infants: z.number().int().min(0).default(0),
  special_requests: z.string().max(1000).nullable().optional()
}).refine((data) => {
  const checkIn = new Date(data.check_in_date);
  const checkOut = new Date(data.check_out_date);
  return checkOut > checkIn;
}, {
  message: "Check-out date must be after check-in date",
  path: ["check_out_date"]
});

export const updateBookingInputSchema = z.object({
  booking_id: z.string(),
  booking_status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  payment_status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  cancellation_reason: z.string().nullable().optional(),
  check_in_instructions: z.string().nullable().optional(),
  access_code: z.string().max(50).nullable().optional()
});

export const searchBookingsInputSchema = z.object({
  property_id: z.string().optional(),
  guest_id: z.string().optional(),
  booking_status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  payment_status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  check_in_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  check_in_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'check_in_date', 'total_price']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// PAYMENTS SCHEMAS
// ============================================================================

export const paymentSchema = z.object({
  payment_id: z.string(),
  booking_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  payment_method: z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer']),
  payment_status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  transaction_id: z.string().nullable(),
  payment_date: z.string().nullable(),
  refund_amount: z.number().nullable(),
  refund_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createPaymentInputSchema = z.object({
  booking_id: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  payment_method: z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer']),
  transaction_id: z.string().max(255).nullable().optional()});

export const updatePaymentInputSchema = z.object({
  payment_id: z.string(),
  payment_status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  transaction_id: z.string().max(255).nullable().optional(),
  payment_date: z.string().nullable().optional(),
  refund_amount: z.number().nonnegative().nullable().optional(),
  refund_date: z.string().nullable().optional()
});

// ============================================================================
// REVIEWS SCHEMAS
// ============================================================================

export const reviewSchema = z.object({
  review_id: z.string(),
  booking_id: z.string(),
  property_id: z.string(),
  reviewer_id: z.string(),
  overall_rating: z.number().int(),
  cleanliness_rating: z.number().int(),
  accuracy_rating: z.number().int(),
  communication_rating: z.number().int(),
  location_rating: z.number().int(),
  checkin_rating: z.number().int(),
  value_rating: z.number().int(),
  review_text: z.string().nullable(),
  review_photos: z.array(z.string().url()).nullable(),
  is_anonymous: z.boolean(),
  host_response: z.string().nullable(),
  host_response_date: z.string().nullable(),
  is_visible: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createReviewInputSchema = z.object({
  booking_id: z.string(),
  property_id: z.string(),
  overall_rating: z.number().int().min(1).max(5),
  cleanliness_rating: z.number().int().min(1).max(5),
  accuracy_rating: z.number().int().min(1).max(5),
  communication_rating: z.number().int().min(1).max(5),
  location_rating: z.number().int().min(1).max(5),
  checkin_rating: z.number().int().min(1).max(5),
  value_rating: z.number().int().min(1).max(5),
  review_text: z.string().max(2000).nullable(),
  review_photos: z.array(z.string().url()).max(10).nullable(),
  is_anonymous: z.boolean().default(false)
});

export const updateReviewInputSchema = z.object({
  review_id: z.string(),
  host_response: z.string().max(2000).nullable().optional(),
  is_visible: z.boolean().optional()
});

export const searchReviewsInputSchema = z.object({
  property_id: z.string().optional(),
  reviewer_id: z.string().optional(),
  min_rating: z.number().int().min(1).max(5).optional(),
  max_rating: z.number().int().min(1).max(5).optional(),
  is_visible: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'overall_rating']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// CONVERSATIONS SCHEMAS
// ============================================================================

export const conversationSchema = z.object({
  conversation_id: z.string(),
  property_id: z.string().nullable(),
  booking_id: z.string().nullable(),
  guest_id: z.string(),
  host_id: z.string(),
  conversation_type: z.enum(['inquiry', 'booking', 'support']),
  subject: z.string().nullable(),
  is_active: z.boolean(),
  last_message_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createConversationInputSchema = z.object({
  property_id: z.string().nullable().optional(),
  booking_id: z.string().nullable().optional(),
  guest_id: z.string(),
  host_id: z.string(),
  conversation_type: z.enum(['inquiry', 'booking', 'support']).default('inquiry'),
  subject: z.string().max(500).nullable().optional()
});

export const updateConversationInputSchema = z.object({
  conversation_id: z.string(),
  subject: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional()
});

// ============================================================================
// MESSAGES SCHEMAS
// ============================================================================

export const messageSchema = z.object({
  message_id: z.string(),
  conversation_id: z.string(),
  sender_id: z.string(),
  message_text: z.string(),
  attachments: z.array(z.string().url()).nullable(),
  is_read: z.boolean(),
  read_at: z.string().nullable(),
  message_type: z.enum(['text', 'image', 'document']),
  is_automated: z.boolean(),
  created_at: z.string()
});

export const createMessageInputSchema = z.object({
  conversation_id: z.string(),
  sender_id: z.string(),
  message_text: z.string().min(1).max(5000),
  attachments: z.array(z.string().url()).max(10).nullable().optional(),
  message_type: z.enum(['text', 'image', 'document']).default('text'),
  is_automated: z.boolean().default(false)
});

export const updateMessageInputSchema = z.object({
  message_id: z.string(),
  is_read: z.boolean().optional(),
  read_at: z.string().nullable().optional()
});

// ============================================================================
// LOCATIONS SCHEMAS
// ============================================================================

export const locationSchema = z.object({
  location_id: z.string(),
  country: z.string(),
  city: z.string(),
  region: z.string().nullable(),
  destination_slug: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  climate_type: z.string(),
  average_temperature: z.number().nullable(),
  is_hot_destination: z.boolean(),
  timezone: z.string(),
  currency: z.string(),
  languages: z.array(z.string()),
  description: z.string().nullable(),
  best_visit_months: z.array(z.string()).nullable(),
  featured_image_url: z.string().url().nullable(),
  is_featured: z.boolean(),
  property_count: z.number().int(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createLocationInputSchema = z.object({
  country: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  region: z.string().max(100).nullable(),
  destination_slug: z.string().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  climate_type: z.string().min(1).max(50),
  average_temperature: z.number().nullable(),
  is_hot_destination: z.boolean().default(true),
  timezone: z.string().min(1).max(50),
  currency: z.string().length(3),
  languages: z.array(z.string()).default([]),
  description: z.string().nullable(),
  best_visit_months: z.array(z.string()).nullable(),
  featured_image_url: z.string().url().max(500).nullable(),
  is_featured: z.boolean().default(false)
});

export const searchLocationsInputSchema = z.object({
  query: z.string().optional(),
  country: z.string().optional(),
  climate_type: z.string().optional(),
  is_hot_destination: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['property_count', 'city', 'created_at']).default('property_count'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// NOTIFICATIONS SCHEMAS
// ============================================================================

export const notificationSchema = z.object({
  notification_id: z.string(),
  user_id: z.string(),
  notification_type: z.string(),
  title: z.string(),
  message: z.string(),
  data: z.record(z.any()).nullable(),
  is_read: z.boolean(),
  read_at: z.string().nullable(),
  priority: z.enum(['low', 'normal', 'high']),
  expires_at: z.string().nullable(),
  created_at: z.string()
});

export const createNotificationInputSchema = z.object({
  user_id: z.string(),
  notification_type: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  data: z.record(z.any()).nullable(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  expires_at: z.string().nullable()
});

export const updateNotificationInputSchema = z.object({
  notification_id: z.string(),
  is_read: z.boolean().optional(),
  read_at: z.string().nullable().optional()
});

export const searchNotificationsInputSchema = z.object({
  user_id: z.string().optional(),
  notification_type: z.string().optional(),
  is_read: z.boolean().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'priority']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// SAVED SEARCHES SCHEMAS
// ============================================================================

export const savedSearchSchema = z.object({
  search_id: z.string(),
  user_id: z.string(),
  search_name: z.string(),
  destination: z.string().nullable(),
  check_in_date: z.string().nullable(),
  check_out_date: z.string().nullable(),
  guest_count: z.number().int().nullable(),
  property_type: z.string().nullable(),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  amenities: z.array(z.string()).nullable(),
  instant_booking: z.boolean().nullable(),
  distance_beach: z.number().nullable(),
  distance_airport: z.number().nullable(),
  host_language: z.string().nullable(),
  sort_by: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createSavedSearchInputSchema = z.object({
  user_id: z.string(),
  search_name: z.string().min(1).max(255),
  destination: z.string().max(255).nullable(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  guest_count: z.number().int().positive().nullable(),
  property_type: z.string().max(100).nullable(),
  price_min: z.number().nonnegative().nullable(),
  price_max: z.number().positive().nullable(),
  amenities: z.array(z.string()).nullable(),
  instant_booking: z.boolean().nullable(),
  distance_beach: z.number().nonnegative().nullable(),
  distance_airport: z.number().nonnegative().nullable(),
  host_language: z.string().max(50).nullable(),
  sort_by: z.string().max(50).nullable(),
  is_active: z.boolean().default(true)
});

// ============================================================================
// INVESTMENT ANALYTICS SCHEMAS
// ============================================================================

export const investmentAnalyticsSchema = z.object({
  analytics_id: z.string(),
  property_id: z.string(),
  owner_id: z.string(),
  purchase_price: z.number().nullable(),
  purchase_date: z.string().nullable(),
  current_value: z.number().nullable(),
  annual_rental_income: z.number(),
  annual_expenses: z.number(),
  occupancy_rate: z.number(),
  rental_yield: z.number().nullable(),
  capital_appreciation: z.number().nullable(),
  total_return: z.number().nullable(),
  roi_percentage: z.number().nullable(),
  year: z.number().int(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createInvestmentAnalyticsInputSchema = z.object({
  property_id: z.string(),
  owner_id: z.string(),
  purchase_price: z.number().positive().nullable(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  current_value: z.number().positive().nullable(),
  annual_rental_income: z.number().nonnegative().default(0),
  annual_expenses: z.number().nonnegative().default(0),
  occupancy_rate: z.number().min(0).max(100).default(0),
  year: z.number().int().min(2000).max(2100)
});

// ============================================================================
// SYSTEM ALERTS SCHEMAS
// ============================================================================

export const systemAlertSchema = z.object({
  alert_id: z.string(),
  alert_type: z.string(),
  title: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  affected_locations: z.array(z.string()).nullable(),
  is_active: z.boolean(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const createSystemAlertInputSchema = z.object({
  alert_type: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).default('info'),
  affected_locations: z.array(z.string()).nullable(),
  is_active: z.boolean().default(true),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable()
});

export const searchSystemAlertsInputSchema = z.object({
  alert_type: z.string().optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'severity', 'starts_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUsersInput = z.infer<typeof searchUsersInputSchema>;

export type Property = z.infer<typeof propertySchema>;
export type CreatePropertyInput = z.infer<typeof createPropertyInputSchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertyInputSchema>;
export type SearchPropertiesInput = z.infer<typeof searchPropertiesInputSchema>;

export type PropertyPhoto = z.infer<typeof propertyPhotoSchema>;
export type CreatePropertyPhotoInput = z.infer<typeof createPropertyPhotoInputSchema>;
export type UpdatePropertyPhotoInput = z.infer<typeof updatePropertyPhotoInputSchema>;

export type Booking = z.infer<typeof bookingSchema>;
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;
export type SearchBookingsInput = z.infer<typeof searchBookingsInputSchema>;

export type Payment = z.infer<typeof paymentSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentInputSchema>;

export type Review = z.infer<typeof reviewSchema>;
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;
export type SearchReviewsInput = z.infer<typeof searchReviewsInputSchema>;

export type Conversation = z.infer<typeof conversationSchema>;
export type CreateConversationInput = z.infer<typeof createConversationInputSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationInputSchema>;

export type Message = z.infer<typeof messageSchema>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>;

export type Location = z.infer<typeof locationSchema>;
export type CreateLocationInput = z.infer<typeof createLocationInputSchema>;
export type SearchLocationsInput = z.infer<typeof searchLocationsInputSchema>;

export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationInputSchema>;
export type SearchNotificationsInput = z.infer<typeof searchNotificationsInputSchema>;

export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchInputSchema>;

export type InvestmentAnalytics = z.infer<typeof investmentAnalyticsSchema>;
export type CreateInvestmentAnalyticsInput = z.infer<typeof createInvestmentAnalyticsInputSchema>;

export type SystemAlert = z.infer<typeof systemAlertSchema>;
export type CreateSystemAlertInput = z.infer<typeof createSystemAlertInputSchema>;
export type SearchSystemAlertsInput = z.infer<typeof searchSystemAlertsInputSchema>;