import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { getTodayDateString, getMaxBookingDate } from '@/lib/utils';

// Interfaces for API responses
interface PropertyPhoto {
  photo_id: string;
  photo_url: string;
  photo_order: number;
  is_cover_photo: boolean;
  alt_text?: string;
}

interface PropertyReview {
  review_id: string;
  reviewer_id: string;
  overall_rating: number;
  cleanliness_rating: number;
  accuracy_rating: number;
  communication_rating: number;
  location_rating: number;
  checkin_rating: number;
  value_rating: number;
  review_text?: string;
  review_photos?: string[];
  is_anonymous: boolean;
  host_response?: string;
  host_response_date?: string;
  created_at: string;
  reviewer: {
    user_id: string;
    first_name: string;
    last_name: string;
    profile_photo_url?: string;
  };
}

interface HostInformation {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_photo_url?: string;
  bio?: string;
  languages_spoken?: string[];
  is_verified: boolean;
  is_superhost: boolean;
  member_since: string;
}



interface PropertyDetailResponse {
  property_id: string;
  owner_id: string;
  title: string;
  description: string;
  property_type: string;
  country: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  guest_count: number;
  base_price_per_night: number;
  currency: string;
  cleaning_fee?: number;
  security_deposit?: number;
  amenities: string[];
  house_rules: string[];
  check_in_time: string;
  check_out_time: string;
  minimum_stay: number;
  maximum_stay?: number;
  instant_booking: boolean;
  cancellation_policy: string;
  average_rating?: number;
  review_count: number;
  photos: PropertyPhoto[];
  owner: HostInformation;
  availability?: any;
  pricing?: any;
}

interface WeatherData {
  current: {
    temperature_avg: number;
    weather_condition: string;
    uv_index: number;
  };
  forecast: Array<{
    date: string;
    temperature_min: number;
    temperature_max: number;
    weather_condition: string;
  }>;
}

interface Attraction {
  attraction_id: string;
  name: string;
  category: string;
  distance: number;
  rating: number;
}

const UV_PropertyDetail: React.FC = () => {
  const { property_id } = useParams<{ property_id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global state access with individual selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currency = useAppStore(state => state.user_preferences.currency);
  const temperatureUnit = useAppStore(state => state.user_preferences.temperature_unit);

  const setCurrentBooking = useAppStore(state => state.set_current_booking);

  // Local state management
  const [selectedDates, setSelectedDates] = useState({
    check_in_date: searchParams.get('check_in_date') || '',
    check_out_date: searchParams.get('check_out_date') || ''
  });
  const [guestCount, setGuestCount] = useState({
    adults: parseInt(searchParams.get('guest_count') || '2'),
    children: 0,
    infants: 0,
    total: parseInt(searchParams.get('guest_count') || '2')
  });
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [reviewsPage] = useState(0);

  // Fetch property details
  const { data: propertyData, isLoading: propertyLoading, error: propertyError } = useQuery({
    queryKey: ['property', property_id, selectedDates.check_in_date, selectedDates.check_out_date, guestCount.total],
    queryFn: async (): Promise<PropertyDetailResponse> => {
      if (!property_id) throw new Error('Property ID is required');
      
      const params = new URLSearchParams();
      if (selectedDates.check_in_date) params.append('check_in_date', selectedDates.check_in_date);
      if (selectedDates.check_out_date) params.append('check_out_date', selectedDates.check_out_date);
      if (guestCount.total) params.append('guest_count', guestCount.total.toString());

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties/${property_id}?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch property reviews
  const { data: reviewsData } = useQuery({
    queryKey: ['property-reviews', property_id, reviewsPage],
    queryFn: async () => {
      if (!property_id) throw new Error('Property ID is required');
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/reviews?property_id=${property_id}&limit=10&offset=${reviewsPage * 10}&sort_by=created_at&sort_order=desc`
      );
      return response.data;
    },
    enabled: !!property_id,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Check favorite status for authenticated users
  const { data: favoriteData } = useQuery({
    queryKey: ['user-favorites', currentUser?.user_id, property_id],
    queryFn: async () => {
      if (!currentUser?.user_id || !authToken) return { favorites: [] };
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}/favorites`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    enabled: !!currentUser?.user_id && !!authToken,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch weather data
  const { data: weatherData } = useQuery({
    queryKey: ['location-weather', propertyData?.latitude, propertyData?.longitude],
    queryFn: async (): Promise<WeatherData> => {
      if (!propertyData?.latitude || !propertyData?.longitude) throw new Error('Location data required');
      
      // Weather data for property location
      return {
        current: {
          temperature_avg: 28.5,
          weather_condition: 'Sunny',
          uv_index: 8.2
        },
        forecast: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          temperature_min: 22 + Math.random() * 3,
          temperature_max: 30 + Math.random() * 5,
          weather_condition: ['Sunny', 'Partly Cloudy', 'Clear'][Math.floor(Math.random() * 3)]
        }))
      };
    },
    enabled: !!propertyData?.latitude && !!propertyData?.longitude,
    staleTime: 1800000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch nearby attractions
  const { data: attractionsData } = useQuery({
    queryKey: ['location-attractions', propertyData?.latitude, propertyData?.longitude],
    queryFn: async (): Promise<{ attractions: Attraction[] }> => {
      if (!propertyData?.latitude || !propertyData?.longitude) throw new Error('Location data required');
      
      // Attractions data for property location
      return {
        attractions: [
          { attraction_id: '1', name: 'Beach Access', category: 'beach', distance: 0.2, rating: 4.8 },
          { attraction_id: '2', name: 'Local Market', category: 'shopping', distance: 1.5, rating: 4.5 },
          { attraction_id: '3', name: 'Historic Center', category: 'culture', distance: 2.1, rating: 4.7 },
          { attraction_id: '4', name: 'Waterfront Restaurant', category: 'dining', distance: 0.8, rating: 4.6 }
        ]
      };
    },
    enabled: !!propertyData?.latitude && !!propertyData?.longitude,
    staleTime: 1800000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.user_id || !authToken || !property_id) {
        throw new Error('Authentication required');
      }

      const isFavorited = favoriteData?.favorites?.some((fav: any) => fav.property_id === property_id);
      
      if (isFavorited) {
        await axios.delete(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}/favorites/${property_id}`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}/favorites`,
          { property_id },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-favorites', currentUser?.user_id] });
    }
  });

  // Calculate pricing
  const pricingBreakdown = useMemo(() => {
    if (!propertyData || !selectedDates.check_in_date || !selectedDates.check_out_date) {
      return {
        nights: 0,
        base_price: 0,
        cleaning_fee: 0,
        service_fee: 0,
        taxes_and_fees: 0,
        total_price: 0,
        currency: propertyData?.currency || 'USD'
      };
    }

    const checkIn = new Date(selectedDates.check_in_date);
    const checkOut = new Date(selectedDates.check_out_date);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) return {
      nights: 0,
      base_price: 0,
      cleaning_fee: 0,
      service_fee: 0,
      taxes_and_fees: 0,
      total_price: 0,
      currency: propertyData.currency
    };

    const basePrice = propertyData.base_price_per_night * nights;
    const cleaningFee = propertyData.cleaning_fee || 0;
    const serviceFee = basePrice * 0.1; // 10% service fee
    const taxesAndFees = basePrice * 0.06; // 6% taxes
    const totalPrice = basePrice + cleaningFee + serviceFee + taxesAndFees;

    return {
      nights,
      base_price: basePrice,
      cleaning_fee: cleaningFee,
      service_fee: serviceFee,
      taxes_and_fees: taxesAndFees,
      total_price: totalPrice,
      currency: propertyData.currency
    };
  }, [propertyData, selectedDates.check_in_date, selectedDates.check_out_date]);

  // Check if property is favorited
  const isFavorited = favoriteData?.favorites?.some((fav: any) => fav.property_id === property_id) || false;

  // Handle booking initiation
  const handleBooking = () => {
    if (!isAuthenticated) {
      navigate('/auth?mode=login&redirect_to=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }

    if (!selectedDates.check_in_date || !selectedDates.check_out_date) {
      alert('Please select check-in and check-out dates');
      return;
    }

    // Update global booking state
    setCurrentBooking({
      booking_id: '',
      property_id: property_id!,
      guest_id: currentUser!.user_id,
      check_in_date: selectedDates.check_in_date,
      check_out_date: selectedDates.check_out_date,
      guest_count: guestCount.total,
      adults: guestCount.adults,
      children: guestCount.children,
      infants: guestCount.infants,
      nights: pricingBreakdown.nights,
      base_price: pricingBreakdown.base_price,
      cleaning_fee: pricingBreakdown.cleaning_fee,
      service_fee: pricingBreakdown.service_fee,
      taxes_and_fees: pricingBreakdown.taxes_and_fees,
      total_price: pricingBreakdown.total_price,
      currency: pricingBreakdown.currency,
      special_requests: '',
      booking_status: 'pending',
      payment_status: 'pending',
      cancellation_reason: undefined,
      cancelled_at: undefined,
      check_in_instructions: undefined,
      access_code: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Navigate to booking flow
    navigate(`/book/${property_id}?check_in_date=${selectedDates.check_in_date}&check_out_date=${selectedDates.check_out_date}&guest_count=${guestCount.total}`);
  };

  // Handle contact host
  const handleContactHost = () => {
    if (!isAuthenticated) {
      navigate('/auth?mode=login');
      return;
    }
    navigate('/messages');
  };

  // Update guest count
  const updateGuestCount = (type: 'adults' | 'children' | 'infants', value: number) => {
    setGuestCount(prev => {
      const updated = { ...prev, [type]: Math.max(0, value) };
      if (type === 'adults' && updated.adults === 0) updated.adults = 1; // At least 1 adult required
      updated.total = updated.adults + updated.children + updated.infants;
      return updated;
    });
  };

  // Loading and error states
  if (propertyLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading property details...</p>
          </div>
        </div>
      </>
    );
  }

  if (propertyError || !propertyData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Property Not Found</h2>
            <p className="text-gray-600 mb-6">The property you're looking for doesn't exist or has been removed.</p>
            <Link 
              to="/search" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Properties
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Photo Gallery Modal */}
        {showAllPhotos && (
          <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
            <div className="relative w-full h-full max-w-6xl max-h-full flex flex-col">
              <div className="flex justify-between items-center p-4 text-white">
                <h3 className="text-lg font-semibold">{selectedPhotoIndex + 1} / {propertyData.photos.length}</h3>
                <button
                  onClick={() => setShowAllPhotos(false)}
                  className="text-white hover:text-gray-300 text-2xl font-bold"
                  aria-label="Close gallery"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center p-4">
                <img
                  src={propertyData.photos[selectedPhotoIndex]?.photo_url}
                  alt={propertyData.photos[selectedPhotoIndex]?.alt_text || propertyData.title}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex justify-center space-x-4 p-4">
                <button
                  onClick={() => setSelectedPhotoIndex(Math.max(0, selectedPhotoIndex - 1))}
                  disabled={selectedPhotoIndex === 0}
                  className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setSelectedPhotoIndex(Math.min(propertyData.photos.length - 1, selectedPhotoIndex + 1))}
                  disabled={selectedPhotoIndex === propertyData.photos.length - 1}
                  className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{propertyData.title}</h1>
                <div className="flex items-center space-x-4 mb-4">
                  {propertyData.average_rating && (
                    <div className="flex items-center">
                      <span className="text-yellow-400 text-lg">★</span>
                      <span className="font-semibold ml-1">{propertyData.average_rating.toFixed(1)}</span>
                      <span className="text-gray-500 ml-1">({propertyData.review_count} reviews)</span>
                    </div>
                  )}
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-700">{propertyData.city}, {propertyData.country}</span>
                </div>
                <p className="text-gray-600">{propertyData.address}</p>
              </div>
              
              <div className="flex items-center space-x-3 mt-4 lg:mt-0">
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: propertyData.title,
                        url: window.location.href
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert('Link copied to clipboard!');
                    }
                  }}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium">Share</span>
                </button>
                
                {isAuthenticated && (
                  <button
                    onClick={() => toggleFavoriteMutation.mutate()}
                    disabled={toggleFavoriteMutation.isPending}
                    className={`flex items-center px-4 py-2 border rounded-lg transition-colors ${
                      isFavorited 
                        ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-lg mr-2 ${isFavorited ? 'text-red-500' : 'text-gray-400'}`}>
                      {isFavorited ? '❤️' : '🤍'}
                    </span>
                    <span className="text-sm font-medium">
                      {isFavorited ? 'Saved' : 'Save'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Image Gallery */}
          <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 rounded-xl overflow-hidden">
              {propertyData.photos.length > 0 && (
                <>
                  <div className="lg:col-span-2 lg:row-span-2">
                    <img
                      src={propertyData.photos[0].photo_url}
                      alt={propertyData.photos[0].alt_text || propertyData.title}
                      className="w-full h-64 lg:h-full object-cover cursor-pointer hover:brightness-95 transition-all"
                      onClick={() => {
                        setSelectedPhotoIndex(0);
                        setShowAllPhotos(true);
                      }}
                    />
                  </div>
                  {propertyData.photos.slice(1, 5).map((photo, index) => (
                    <div key={photo.photo_id} className="relative">
                      <img
                        src={photo.photo_url}
                        alt={photo.alt_text || propertyData.title}
                        className="w-full h-32 lg:h-full object-cover cursor-pointer hover:brightness-95 transition-all"
                        onClick={() => {
                          setSelectedPhotoIndex(index + 1);
                          setShowAllPhotos(true);
                        }}
                      />
                      {index === 3 && propertyData.photos.length > 5 && (
                        <div 
                          className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center cursor-pointer"
                          onClick={() => setShowAllPhotos(true)}
                        >
                          <span className="text-white font-semibold">
                            +{propertyData.photos.length - 5} more
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
            
            {propertyData.photos.length > 0 && (
              <button
                onClick={() => setShowAllPhotos(true)}
                className="mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Show all {propertyData.photos.length} photos
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Property Overview */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {propertyData.property_type} hosted by {propertyData.owner.first_name}
                  </h2>
                  <div className="w-12 h-12 rounded-full overflow-hidden">
                    <img
                      src={propertyData.owner.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(propertyData.owner.first_name + ' ' + propertyData.owner.last_name)}&background=3B82F6&color=ffffff`}
                      alt={`${propertyData.owner.first_name} ${propertyData.owner.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 text-gray-600 mb-6">
                  <span>{propertyData.guest_count} guests</span>
                  <span>•</span>
                  <span>{propertyData.bedrooms} bedroom{propertyData.bedrooms !== 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>{propertyData.bathrooms} bathroom{propertyData.bathrooms !== 1 ? 's' : ''}</span>
                </div>

                {/* Host badges */}
                <div className="flex items-center space-x-3 mb-6">
                  {propertyData.owner.is_superhost && (
                    <div className="flex items-center px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm font-medium">
                      <span className="mr-1">⭐</span>
                      Superhost
                    </div>
                  )}
                  {propertyData.owner.is_verified && (
                    <div className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      <span className="mr-1">✓</span>
                      Verified Host
                    </div>
                  )}
                  {propertyData.instant_booking && (
                    <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      <span className="mr-1">⚡</span>
                      Instant Book
                    </div>
                  )}
                </div>

                {/* Check-in details */}
                <div className="border-t border-b border-gray-200 py-6 my-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">Check-in:</span>
                      <span className="text-gray-600 ml-2">{propertyData.check_in_time}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Check-out:</span>
                      <span className="text-gray-600 ml-2">{propertyData.check_out_time}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Minimum stay:</span>
                      <span className="text-gray-600 ml-2">{propertyData.minimum_stay} night{propertyData.minimum_stay !== 1 ? 's' : ''}</span>
                    </div>
                    {propertyData.maximum_stay && (
                      <div>
                        <span className="font-medium text-gray-900">Maximum stay:</span>
                        <span className="text-gray-600 ml-2">{propertyData.maximum_stay} nights</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">About this place</h3>
                <div className="prose prose-gray max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {propertyData.description}
                  </p>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">What this place offers</h3>
                <div className="grid grid-cols-2 gap-4">
                  {(showAllAmenities ? propertyData.amenities : propertyData.amenities.slice(0, 10)).map((amenity, index) => (
                    <div key={index} className="flex items-center text-gray-700">
                      <span className="mr-3">🏠</span>
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
                
                {propertyData.amenities.length > 10 && (
                  <button
                    onClick={() => setShowAllAmenities(!showAllAmenities)}
                    className="mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {showAllAmenities ? 'Show less' : `Show all ${propertyData.amenities.length} amenities`}
                  </button>
                )}
              </div>

              {/* House Rules */}
              {propertyData.house_rules.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">House rules</h3>
                  <ul className="space-y-2">
                    {propertyData.house_rules.map((rule, index) => (
                      <li key={index} className="flex items-start text-gray-700">
                        <span className="mr-3 mt-1">•</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Location & Weather */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Location</h3>
                <div className="bg-gray-100 rounded-lg p-6 mb-4">
                  <div className="flex items-center justify-center h-48 text-gray-500">
                    <div className="text-center">
                      <span className="text-4xl mb-2 block">📍</span>
                      <p>Interactive map would be here</p>
                      <p className="text-sm">{propertyData.city}, {propertyData.country}</p>
                    </div>
                  </div>
                </div>
                
                {/* Weather Information */}
                {weatherData && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Current Weather</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-800">
                          {temperatureUnit === 'celsius' 
                            ? `${Math.round(weatherData.current.temperature_avg)}°C`
                            : `${Math.round(weatherData.current.temperature_avg * 9/5 + 32)}°F`
                          }
                        </p>
                        <p className="text-blue-600 text-sm">{weatherData.current.weather_condition}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-800 text-sm">UV Index: {weatherData.current.uv_index}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Nearby Attractions */}
                {attractionsData && attractionsData.attractions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Nearby attractions</h4>
                    <div className="space-y-2">
                      {attractionsData.attractions.map((attraction) => (
                        <div key={attraction.attraction_id} className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-900">{attraction.name}</span>
                            <span className="text-gray-500 text-sm ml-2">({attraction.category})</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">{attraction.distance} km away</div>
                            <div className="text-sm text-yellow-600">★ {attraction.rating}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reviews */}
              {reviewsData && reviewsData.reviews.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">
                      ★ {reviewsData.average_rating?.toFixed(1)} · {reviewsData.total} review{reviewsData.total !== 1 ? 's' : ''}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(showAllReviews ? reviewsData.reviews : reviewsData.reviews.slice(0, 6)).map((review: PropertyReview) => (
                      <div key={review.review_id} className="border-b border-gray-200 pb-6">
                        <div className="flex items-center mb-3">
                          <img
                            src={review.reviewer.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.reviewer.first_name + ' ' + review.reviewer.last_name)}&background=3B82F6&color=ffffff`}
                            alt={`${review.reviewer.first_name} ${review.reviewer.last_name}`}
                            className="w-10 h-10 rounded-full mr-3"
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              {review.is_anonymous ? 'Anonymous' : `${review.reviewer.first_name} ${review.reviewer.last_name}`}
                            </p>
                            <div className="flex items-center">
                              <span className="text-yellow-400">★</span>
                              <span className="text-sm text-gray-600 ml-1">{review.overall_rating}</span>
                              <span className="text-gray-400 mx-1">•</span>
                              <span className="text-sm text-gray-600">
                                {new Date(review.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {review.review_text && (
                          <p className="text-gray-700 mb-3">{review.review_text}</p>
                        )}
                        
                        {review.host_response && (
                          <div className="bg-gray-50 rounded-lg p-3 mt-3">
                            <p className="font-medium text-gray-900 text-sm mb-1">Response from host:</p>
                            <p className="text-gray-700 text-sm">{review.host_response}</p>
                            {review.host_response_date && (
                              <p className="text-gray-500 text-xs mt-1">
                                {new Date(review.host_response_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {reviewsData.reviews.length > 6 && (
                    <button
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="mt-6 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {showAllReviews ? 'Show less' : `Show all ${reviewsData.total} reviews`}
                    </button>
                  )}
                </div>
              )}

              {/* Host Information */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Meet your host</h3>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <img
                      src={propertyData.owner.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(propertyData.owner.first_name + ' ' + propertyData.owner.last_name)}&background=3B82F6&color=ffffff`}
                      alt={`${propertyData.owner.first_name} ${propertyData.owner.last_name}`}
                      className="w-16 h-16 rounded-full"
                    />
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {propertyData.owner.first_name} {propertyData.owner.last_name}
                      </h4>
                      <p className="text-gray-600 text-sm mb-2">
                        Host since {new Date(propertyData.owner.member_since).getFullYear()}
                      </p>
                      
                      <div className="flex items-center space-x-3 mb-3">
                        {propertyData.owner.is_superhost && (
                          <span className="text-pink-600 text-sm font-medium">⭐ Superhost</span>
                        )}
                        {propertyData.owner.is_verified && (
                          <span className="text-blue-600 text-sm font-medium">✓ Identity verified</span>
                        )}
                      </div>
                      
                      {propertyData.owner.bio && (
                        <p className="text-gray-700 text-sm mb-4">{propertyData.owner.bio}</p>
                      )}
                      
                      {propertyData.owner.languages_spoken && propertyData.owner.languages_spoken.length > 0 && (
                        <p className="text-gray-600 text-sm">
                          <span className="font-medium">Languages:</span> {propertyData.owner.languages_spoken.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleContactHost}
                    className="mt-4 w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Contact Host
                  </button>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Cancellation policy</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">
                    <span className="font-medium capitalize">{propertyData.cancellation_policy}</span> cancellation policy
                  </p>
                  <p className="text-yellow-700 text-sm mt-1">
                    {propertyData.cancellation_policy === 'flexible' && 
                      'Free cancellation for 48 hours. After that, cancel up to 24 hours before check-in for a partial refund.'
                    }
                    {propertyData.cancellation_policy === 'moderate' && 
                      'Free cancellation for 48 hours. After that, cancel up to 5 days before check-in for a partial refund.'
                    }
                    {propertyData.cancellation_policy === 'strict' && 
                      'Free cancellation for 48 hours. After that, cancel up to 14 days before check-in for a partial refund.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Booking Widget - Sticky Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <div className="border border-gray-200 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-2xl font-bold text-gray-900">
                        {currency === propertyData.currency 
                          ? `${propertyData.currency === 'USD' ? '$' : '€'}${propertyData.base_price_per_night}`
                          : `${propertyData.base_price_per_night} ${propertyData.currency}`
                        }
                      </span>
                      <span className="text-gray-600"> / night</span>
                    </div>
                    {propertyData.average_rating && (
                      <div className="flex items-center text-sm">
                        <span className="text-yellow-400">★</span>
                        <span className="font-medium ml-1">{propertyData.average_rating.toFixed(1)}</span>
                        <span className="text-gray-500 ml-1">({propertyData.review_count})</span>
                      </div>
                    )}
                  </div>

                  {/* Date Selection */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">CHECK-IN</label>
                      <input
                        type="date"
                        value={selectedDates.check_in_date}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedDates(prev => ({ 
                            ...prev, 
                            check_in_date: value,
                            // Clear check-out if it's before the new check-in date
                            check_out_date: prev.check_out_date && value && prev.check_out_date <= value ? '' : prev.check_out_date
                          }));
                        }}
                        min={getTodayDateString()}
                        max={getMaxBookingDate()}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">CHECK-OUT</label>
                      <input
                        type="date"
                        value={selectedDates.check_out_date}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedDates(prev => ({ ...prev, check_out_date: value }));
                        }}
                        min={selectedDates.check_in_date || getTodayDateString()}
                        max={getMaxBookingDate()}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Guest Selection */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">GUESTS</label>
                    <div className="border border-gray-300 rounded-lg p-3">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-900">Adults</span>
                            <p className="text-xs text-gray-500">Ages 13 or above</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateGuestCount('adults', guestCount.adults - 1)}
                              disabled={guestCount.adults <= 1}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              −
                            </button>
                            <span className="w-8 text-center">{guestCount.adults}</span>
                            <button
                              onClick={() => updateGuestCount('adults', guestCount.adults + 1)}
                              disabled={guestCount.total >= propertyData.guest_count}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-900">Children</span>
                            <p className="text-xs text-gray-500">Ages 2-12</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateGuestCount('children', guestCount.children - 1)}
                              disabled={guestCount.children <= 0}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              −
                            </button>
                            <span className="w-8 text-center">{guestCount.children}</span>
                            <button
                              onClick={() => updateGuestCount('children', guestCount.children + 1)}
                              disabled={guestCount.total >= propertyData.guest_count}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-900">Infants</span>
                            <p className="text-xs text-gray-500">Under 2</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateGuestCount('infants', guestCount.infants - 1)}
                              disabled={guestCount.infants <= 0}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              −
                            </button>
                            <span className="w-8 text-center">{guestCount.infants}</span>
                            <button
                              onClick={() => updateGuestCount('infants', guestCount.infants + 1)}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-400"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {guestCount.total > propertyData.guest_count && (
                        <p className="text-red-600 text-xs mt-2">
                          This property can accommodate up to {propertyData.guest_count} guests.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  {pricingBreakdown.nights > 0 && (
                    <div className="mb-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>
                          {currency === propertyData.currency 
                            ? `${propertyData.currency === 'USD' ? '$' : '€'}${propertyData.base_price_per_night}`
                            : `${propertyData.base_price_per_night} ${propertyData.currency}`
                          } × {pricingBreakdown.nights} night{pricingBreakdown.nights !== 1 ? 's' : ''}
                        </span>
                        <span>
                          {currency === propertyData.currency 
                            ? `${propertyData.currency === 'USD' ? '$' : '€'}${pricingBreakdown.base_price.toFixed(2)}`
                            : `${pricingBreakdown.base_price.toFixed(2)} ${propertyData.currency}`
                          }
                        </span>
                      </div>
                      
                      {pricingBreakdown.cleaning_fee > 0 && (
                        <div className="flex justify-between">
                          <span>Cleaning fee</span>
                          <span>
                            {currency === propertyData.currency 
                              ? `${propertyData.currency === 'USD' ? '$' : '€'}${pricingBreakdown.cleaning_fee.toFixed(2)}`
                              : `${pricingBreakdown.cleaning_fee.toFixed(2)} ${propertyData.currency}`
                            }
                          </span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span>Service fee</span>
                        <span>
                          {currency === propertyData.currency 
                            ? `${propertyData.currency === 'USD' ? '$' : '€'}${pricingBreakdown.service_fee.toFixed(2)}`
                            : `${pricingBreakdown.service_fee.toFixed(2)} ${propertyData.currency}`
                          }
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Taxes and fees</span>
                        <span>
                          {currency === propertyData.currency 
                            ? `${propertyData.currency === 'USD' ? '$' : '€'}${pricingBreakdown.taxes_and_fees.toFixed(2)}`
                            : `${pricingBreakdown.taxes_and_fees.toFixed(2)} ${propertyData.currency}`
                          }
                        </span>
                      </div>
                      
                      <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                        <span>Total</span>
                        <span>
                          {currency === propertyData.currency 
                            ? `${propertyData.currency === 'USD' ? '$' : '€'}${pricingBreakdown.total_price.toFixed(2)}`
                            : `${pricingBreakdown.total_price.toFixed(2)} ${propertyData.currency}`
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Booking Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={handleBooking}
                      disabled={guestCount.total > propertyData.guest_count || !selectedDates.check_in_date || !selectedDates.check_out_date}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {propertyData.instant_booking ? 'Reserve' : 'Request to Book'}
                    </button>
                    
                    <button
                      onClick={handleContactHost}
                      className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Contact Host
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    You won't be charged yet
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PropertyDetail;