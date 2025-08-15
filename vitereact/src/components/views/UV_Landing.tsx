import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// API response interfaces
interface FeaturedDestination {
  location_id: string;
  country: string;
  city: string;
  destination_slug: string;
  average_temperature: number;
  featured_image_url: string;
  property_count: number;
}

interface FeaturedProperty {
  property_id: string;
  title: string;
  base_price_per_night: number;
  currency: string;
  average_rating: number;
  review_count: number;
  country: string;
  city: string;
  amenities: string[];
  cover_photo_url?: string;
}

interface WeatherData {
  location_id: string;
  current: {
    temperature_avg: number;
    weather_condition: string;
    uv_index: number;
    humidity: number;
  };
}

interface AutocompleteSuggestion {
  location_id: string;
  display_name: string;
  country: string;
  city: string;
}

interface SavedSearch {
  search_id: string;
  search_name: string;
  destination: string;
  created_at: string;
}

const UV_Landing: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Individual Zustand selectors (CRITICAL: no object destructuring)
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currency = useAppStore(state => state.user_preferences.currency);
  
  const updateSearchCriteria = useAppStore(state => state.update_search_criteria);

  // Local state for search form
  const [searchForm, setSearchForm] = useState({
    destination: '',
    check_in_date: '',
    check_out_date: '',
    guest_count: 1,
    adults: 1,
    children: 0,
    infants: 0,
    property_type: ''
  });

  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');

  // Initialize search form from URL parameters
  useEffect(() => {
    const destination = searchParams.get('destination') || '';
    const check_in = searchParams.get('check_in') || '';
    const check_out = searchParams.get('check_out') || '';
    const guests = parseInt(searchParams.get('guests') || '1');

    setSearchForm(prev => ({
      ...prev,
      destination,
      check_in_date: check_in,
      check_out_date: check_out,
      guest_count: guests,
      adults: guests >= 1 ? guests : 1
    }));

    setAutocompleteQuery(destination);
  }, [searchParams]);

  // Fetch featured destinations
  const { data: featuredDestinations = [], isLoading: destinationsLoading } = useQuery({
    queryKey: ['featured-destinations'],
    queryFn: async (): Promise<FeaturedDestination[]> => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/locations`,
        {
          params: {
            is_featured: true,
            is_hot_destination: true,
            limit: 8
          }
        }
      );
      return response.data.locations.map((location: any) => ({
        location_id: location.location_id,
        country: location.country,
        city: location.city,
        destination_slug: location.destination_slug,
        average_temperature: location.average_temperature,
        featured_image_url: location.featured_image_url,
        property_count: location.property_count
      }));
    },
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Fetch featured properties
  const { data: featuredProperties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ['featured-properties'],
    queryFn: async (): Promise<FeaturedProperty[]> => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties`,
        {
          params: {
            is_verified: true,
            min_rating: 4.5,
            limit: 12,
            sort_by: 'rating'
          }
        }
      );
      return response.data.properties.map((property: any) => ({
        property_id: property.property_id,
        title: property.title,
        base_price_per_night: property.base_price_per_night,
        currency: property.currency,
        average_rating: property.average_rating,
        review_count: property.review_count,
        country: property.country,
        city: property.city,
        amenities: property.amenities || [],
        cover_photo_url: property.cover_photo_url || property.photos?.[0]?.photo_url
      }));
    },
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Fetch destination autocomplete suggestions
  const { data: autocompleteSuggestions = [] } = useQuery({
    queryKey: ['destination-autocomplete', autocompleteQuery],
    queryFn: async (): Promise<AutocompleteSuggestion[]> => {
      if (!autocompleteQuery || autocompleteQuery.length < 2) return [];
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/locations`,
        {
          params: {
            query: autocompleteQuery,
            is_hot_destination: true,
            limit: 10
          }
        }
      );
      return response.data.locations.map((location: any) => ({
        location_id: location.location_id,
        display_name: `${location.city}, ${location.country}`,
        country: location.country,
        city: location.city
      }));
    },
    enabled: autocompleteQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
    retry: 1
  });

  // Fetch weather data for featured destinations
  const { data: weatherData = [] } = useQuery({
    queryKey: ['weather-data', featuredDestinations.map(d => d.location_id)],
    queryFn: async (): Promise<WeatherData[]> => {
      if (featuredDestinations.length === 0) return [];
      
      const weatherPromises = featuredDestinations.slice(0, 4).map(async (destination) => {
        try {
          const response = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/locations/${destination.location_id}/api/weather`,
            { params: { forecast_days: 1 } }
          );
          return {
            location_id: destination.location_id,
            current: response.data.current
          };
        } catch (error) {
          // Return mock data if weather API fails
          return {
            location_id: destination.location_id,
            current: {
              temperature_avg: destination.average_temperature || 25,
              weather_condition: 'Sunny',
              uv_index: 8,
              humidity: 65
            }
          };
        }
      });
      
      return Promise.all(weatherPromises);
    },
    enabled: featuredDestinations.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: 1
  });

  // Fetch user search history for authenticated users
  const { data: userSearchHistory = [] } = useQuery({
    queryKey: ['user-search-history', currentUser?.user_id],
    queryFn: async (): Promise<SavedSearch[]> => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/saved-searches`,
        {
          params: {
            user_id: currentUser?.user_id,
            is_active: true,
            limit: 5
          },
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      return response.data.saved_searches;
    },
    enabled: isAuthenticated && !!currentUser?.user_id && !!authToken,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Debounced autocomplete handler
  const handleDestinationChange = useCallback((value: string) => {
    setSearchForm(prev => ({ ...prev, destination: value }));
    setAutocompleteQuery(value);
    setShowAutocomplete(value.length >= 2);
  }, []);

  // Guest count calculation
  const totalGuests = searchForm.adults + searchForm.children + searchForm.infants;

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchForm.destination) {
      alert('Please select a destination');
      return;
    }
    
    // Update global search state
    updateSearchCriteria({
      destination: searchForm.destination,
      check_in_date: searchForm.check_in_date,
      check_out_date: searchForm.check_out_date,
      guest_count: totalGuests
    });

    // Navigate to search results
    const searchParams = new URLSearchParams();
    if (searchForm.destination) searchParams.set('destination', searchForm.destination);
    if (searchForm.check_in_date) searchParams.set('check_in_date', searchForm.check_in_date);
    if (searchForm.check_out_date) searchParams.set('check_out_date', searchForm.check_out_date);
    if (totalGuests > 1) searchParams.set('guest_count', totalGuests.toString());
    if (searchForm.property_type) searchParams.set('property_type', searchForm.property_type);

    navigate(`/search?${searchParams.toString()}`);
  };

  // Handle autocomplete selection
  const handleAutocompleteSelect = (suggestion: AutocompleteSuggestion) => {
    setSearchForm(prev => ({ ...prev, destination: suggestion.display_name }));
    setAutocompleteQuery(suggestion.display_name);
    setShowAutocomplete(false);
  };

  // Format currency
  const formatCurrency = (amount: number, curr: string = currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr
    }).format(amount);
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Find Your Perfect
              <span className="block text-yellow-300">Sunny Getaway</span>
            </h1>
            <p className="text-xl sm:text-2xl text-blue-100 max-w-3xl mx-auto">
              Discover amazing vacation rentals and investment opportunities in the world's hottest destinations
            </p>
          </div>

          {/* Search Form */}
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Destination Input */}
                <div className="lg:col-span-1 relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Where
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchForm.destination}
                      onChange={(e) => handleDestinationChange(e.target.value)}
                      onFocus={() => setShowAutocomplete(autocompleteQuery.length >= 2)}
                      placeholder="Search destinations"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    />
                    {showAutocomplete && autocompleteSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 max-h-60 overflow-y-auto">
                        {autocompleteSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.location_id}
                            type="button"
                            onClick={() => handleAutocompleteSelect(suggestion)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 text-gray-900 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium">{suggestion.display_name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Check-in Date */}
                <div className="lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-in
                  </label>
                  <input
                    type="date"
                    value={searchForm.check_in_date}
                    onChange={(e) => setSearchForm(prev => ({ ...prev, check_in_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Check-out Date */}
                <div className="lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-out
                  </label>
                  <input
                    type="date"
                    value={searchForm.check_out_date}
                    onChange={(e) => setSearchForm(prev => ({ ...prev, check_out_date: e.target.value }))}
                    min={searchForm.check_in_date || new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Guests Selector */}
                <div className="lg:col-span-1 relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guests
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGuestDropdown(!showGuestDropdown)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-left flex justify-between items-center"
                  >
                    <span>{totalGuests} guest{totalGuests !== 1 ? 's' : ''}</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showGuestDropdown && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 p-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-900">Adults</span>
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={() => setSearchForm(prev => ({ ...prev, adults: Math.max(1, prev.adults - 1) }))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                            >
                              -
                            </button>
                            <span className="text-gray-900 w-8 text-center">{searchForm.adults}</span>
                            <button
                              type="button"
                              onClick={() => setSearchForm(prev => ({ ...prev, adults: prev.adults + 1 }))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-900">Children</span>
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={() => setSearchForm(prev => ({ ...prev, children: Math.max(0, prev.children - 1) }))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                            >
                              -
                            </button>
                            <span className="text-gray-900 w-8 text-center">{searchForm.children}</span>
                            <button
                              type="button"
                              onClick={() => setSearchForm(prev => ({ ...prev, children: prev.children + 1 }))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-900">Infants</span>
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={() => setSearchForm(prev => ({ ...prev, infants: Math.max(0, prev.infants - 1) }))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                            >
                              -
                            </button>
                            <span className="text-gray-900 w-8 text-center">{searchForm.infants}</span>
                            <button
                              type="button"
                              onClick={() => setSearchForm(prev => ({ ...prev, infants: prev.infants + 1 }))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-400"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Property Type Quick Filters */}
              <div className="mt-6">
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  {['Villa', 'Apartment', 'House', 'Resort'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSearchForm(prev => ({ 
                        ...prev, 
                        property_type: prev.property_type === type.toLowerCase() ? '' : type.toLowerCase() 
                      }))}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        searchForm.property_type === type.toLowerCase()
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Button */}
              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-[1.02] shadow-lg"
                >
                  🔍 Search Amazing Properties
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Featured Destinations Carousel */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              🌴 Hot Destinations
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore our most popular sunny destinations with perfect weather year-round
            </p>
          </div>

          {destinationsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-lg animate-pulse">
                  <div className="h-48 bg-gray-300 rounded-t-2xl"></div>
                  <div className="p-6">
                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                    <div className="h-6 bg-gray-300 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredDestinations.slice(0, 4).map((destination) => {
                const weather = weatherData.find(w => w.location_id === destination.location_id);
                return (
                  <Link
                    key={destination.location_id}
                    to={`/destinations/${destination.destination_slug}`}
                    className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] overflow-hidden"
                  >
                    <div className="relative h-48 overflow-hidden">
                      {destination.featured_image_url ? (
                        <img
                          src={destination.featured_image_url}
                          alt={`${destination.city}, ${destination.country}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <span className="text-white text-4xl">🏝️</span>
                        </div>
                      )}
                      <div className="absolute top-4 right-4 bg-white bg-opacity-90 rounded-full px-3 py-1 flex items-center space-x-1">
                        <span className="text-orange-500">☀️</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {weather?.current.temperature_avg || destination.average_temperature}°C
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {destination.city}
                      </h3>
                      <p className="text-gray-600 mb-2">{destination.country}</p>
                      <p className="text-sm text-blue-600 font-medium">
                        {destination.property_count} properties
                      </p>
                      {weather && (
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                          <span>{weather.current.weather_condition}</span>
                          <span>UV: {weather.current.uv_index}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              ⭐ Featured Properties
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Handpicked luxury accommodations with exceptional ratings and amenities
            </p>
          </div>

          {propertiesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl shadow-sm animate-pulse">
                  <div className="h-64 bg-gray-300 rounded-t-2xl"></div>
                  <div className="p-6">
                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                    <div className="h-6 bg-gray-300 rounded mb-4"></div>
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProperties.slice(0, 6).map((property) => (
                <Link
                  key={property.property_id}
                  to={`/property/${property.property_id}`}
                  className="group bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition-all transform hover:scale-[1.02] overflow-hidden"
                >
                  <div className="relative h-64 overflow-hidden">
                    {property.cover_photo_url ? (
                      <img
                        src={property.cover_photo_url}
                        alt={property.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                        <span className="text-gray-500 text-4xl">🏠</span>
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-full px-3 py-1 flex items-center space-x-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {property.average_rating?.toFixed(1)} ({property.review_count})
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                      {property.title}
                    </h3>
                    <p className="text-gray-600 mb-3">
                      {property.city}, {property.country}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {property.amenities.slice(0, 3).map((amenity, index) => (
                        <span key={index} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                          {amenity}
                        </span>
                      ))}
                      {property.amenities.length > 3 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          +{property.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatCurrency(property.base_price_per_night, property.currency)}
                        </span>
                        <span className="text-gray-600 text-sm"> / night</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              to="/search"
              className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              View All Properties
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Personalized Content for Authenticated Users */}
      {isAuthenticated && currentUser && (
        <section className="py-16 bg-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Welcome back, {currentUser.first_name}! 👋
              </h2>
              <p className="text-xl text-gray-600">
                Continue your journey or discover something new
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Searches */}
              {userSearchHistory.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    🔍 Your Recent Searches
                  </h3>
                  <div className="space-y-4">
                    {userSearchHistory.slice(0, 3).map((search) => (
                      <Link
                        key={search.search_id}
                        to={`/search?destination=${encodeURIComponent(search.destination)}`}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <h4 className="font-semibold text-gray-900">{search.search_name}</h4>
                          <p className="text-gray-600 text-sm">{search.destination}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  ⚡ Quick Actions
                </h3>
                <div className="space-y-4">
                  <Link
                    to="/dashboard"
                    className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <span className="text-2xl mr-4">📊</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">Your Dashboard</h4>
                      <p className="text-gray-600 text-sm">Manage trips and bookings</p>
                    </div>
                  </Link>
                  
                  {currentUser.user_type === 'host' && (
                    <Link
                      to="/host"
                      className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <span className="text-2xl mr-4">🏠</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">Host Dashboard</h4>
                        <p className="text-gray-600 text-sm">Manage your properties</p>
                      </div>
                    </Link>
                  )}
                  
                  <Link
                    to="/messages"
                    className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <span className="text-2xl mr-4">💬</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">Messages</h4>
                      <p className="text-gray-600 text-sm">Chat with hosts and guests</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Call-to-Action Sections */}
      <section className="py-16 bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                💰 Become a Host
              </h2>
              <p className="text-xl text-green-100 mb-8">
                Turn your property into a profitable vacation rental. Join thousands of successful hosts earning passive income in hot destinations.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="text-green-300 mr-3">✓</span>
                  <span>Free listing and professional photography</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-300 mr-3">✓</span>
                  <span>24/7 customer support</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-300 mr-3">✓</span>
                  <span>Flexible hosting options</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-300 mr-3">✓</span>
                  <span>Host protection insurance</span>
                </li>
              </ul>
              <Link
                to="/host"
                className="inline-flex items-center px-8 py-4 bg-white text-green-600 font-semibold rounded-xl hover:bg-green-50 transition-colors"
              >
                Start Hosting Today
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="text-center">
              <div className="bg-white bg-opacity-20 rounded-2xl p-8">
                <div className="text-6xl mb-4">🏡</div>
                <h3 className="text-2xl font-bold mb-4">Average Host Earnings</h3>
                <div className="text-4xl font-bold text-yellow-300 mb-2">$2,850</div>
                <p className="text-green-100">per month in popular destinations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Investment Opportunities */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              📈 Investment Opportunities
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Discover high-yield real estate investments in emerging hot destinations with strong rental demand
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-800 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">🏖️</div>
              <h3 className="text-xl font-bold mb-4">Beachfront Properties</h3>
              <div className="text-3xl font-bold text-blue-400 mb-2">12-15%</div>
              <p className="text-gray-300">Average annual ROI</p>
            </div>
            
            <div className="bg-gray-800 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">🌴</div>
              <h3 className="text-xl font-bold mb-4">Tropical Villas</h3>
              <div className="text-3xl font-bold text-green-400 mb-2">8-12%</div>
              <p className="text-gray-300">Rental yield</p>
            </div>
            
            <div className="bg-gray-800 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">🏙️</div>
              <h3 className="text-xl font-bold mb-4">Urban Apartments</h3>
              <div className="text-3xl font-bold text-purple-400 mb-2">25%</div>
              <p className="text-gray-300">Capital appreciation</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link
              to="/investments"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Explore Investment Opportunities
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-16 bg-yellow-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-6xl mb-6">📧</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Stay in the Loop
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Get the latest travel tips, destination guides, and exclusive property deals delivered to your inbox
          </p>
          
          <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Subscribe
            </button>
          </form>
          
          <p className="text-sm text-gray-500 mt-4">
            No spam, unsubscribe at any time. We respect your privacy.
          </p>
        </div>
      </section>
    </>
  );
};

export default UV_Landing;