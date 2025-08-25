import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Types based on backend schemas
interface Location {
  location_id: string;
  country: string;
  city: string;
  region?: string;
  destination_slug: string;
  latitude: number;
  longitude: number;
  climate_type: string;
  average_temperature?: number;
  is_hot_destination: boolean;
  timezone: string;
  currency: string;
  languages: string[];
  description?: string;
  best_visit_months?: string[];
  featured_image_url?: string;
  is_featured: boolean;
  property_count: number;
  created_at: string;
  updated_at: string;
}

interface WeatherData {
  current: {
    temperature_avg: number;
    humidity: number;
    wind_speed: number;
    uv_index: number;
    weather_condition: string;
    sunshine_hours: number;
  } | null;
  forecast: Array<{
    date: string;
    temperature_min: number;
    temperature_max: number;
    temperature_avg: number;
    weather_condition: string;
    rainfall: number;
  }>;
  best_visit_months: string[];
}

interface Attraction {
  attraction_id: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  phone_number: string;
  website_url: string;
  opening_hours: Record<string, any>;
  admission_fee: number;
  rating: number;
  image_urls: string[];
  is_featured: boolean;
}

interface Property {
  property_id: string;
  title: string;
  property_type: string;
  base_price_per_night: number;
  currency: string;
  average_rating?: number;
  review_count: number;
  distance_beach?: number;
}

const UV_LocalGuides: React.FC = () => {
  const { destination_slug } = useParams<{ destination_slug?: string }>();

  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get section from URL params or default to 'overview'
  const activeSection = searchParams.get('section') || 'overview';
  
  // Individual Zustand selectors to avoid infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const userCurrency = useAppStore(state => state.user_preferences.currency);

  const temperatureUnit = useAppStore(state => state.user_preferences.temperature_unit);

  // Section navigation function
  const updateSelectedSection = (section: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('section', section);
    setSearchParams(newSearchParams);
  };

  // API base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Fetch destinations list (when no specific destination)
  const { data: destinationsList, isLoading: destinationsLoading, error: destinationsError } = useQuery({
    queryKey: ['destinations-list'],
    queryFn: async () => {
      const response = await axios.get(`${apiBaseUrl}/api/locations`, {
        params: {
          is_hot_destination: true,
          is_featured: true,
          limit: 20,
          sort_by: 'property_count',
          sort_order: 'desc'
        }
      });
      return response.data.locations as Location[];
    },
    enabled: !destination_slug,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Fetch specific destination data
  const { data: destinationData, isLoading: destinationLoading, error: destinationError } = useQuery({
    queryKey: ['destination-data', destination_slug],
    queryFn: async () => {
      if (!destination_slug) return null;
      const response = await axios.get(`${apiBaseUrl}/api/locations`, {
        params: {
          destination_slug: destination_slug,
          limit: 1
        }
      });
      return response.data.locations[0] || null as Location | null;
    },
    enabled: !!destination_slug,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Fetch weather data for specific destination
  const { data: weatherData, isLoading: weatherLoading } = useQuery({
    queryKey: ['weather-data', destinationData?.location_id],
    queryFn: async () => {
      if (!destinationData?.location_id) return null;
      const response = await axios.get(`${apiBaseUrl}/api/locations/${destinationData.location_id}/weather`, {
        params: {
          forecast_days: 7,
          include_historical: true
        },
        headers: currentUser ? { Authorization: `Bearer ${useAppStore.getState().authentication_state.auth_token}` } : {}
      });
      return response.data as WeatherData;
    },
    enabled: !!destinationData?.location_id && (activeSection === 'weather' || activeSection === 'overview'),
    staleTime: 10 * 60 * 1000,
    retry: 1
  });

  // Fetch local attractions
  const { data: attractions, isLoading: attractionsLoading } = useQuery({
    queryKey: ['attractions-data', destinationData?.location_id],
    queryFn: async () => {
      if (!destinationData?.location_id) return [];
      const response = await axios.get(`${apiBaseUrl}/api/locations/${destinationData.location_id}/attractions`, {
        params: {
          is_featured: true,
          limit: 20
        },
        headers: currentUser ? { Authorization: `Bearer ${useAppStore.getState().authentication_state.auth_token}` } : {}
      });
      return response.data.attractions as Attraction[];
    },
    enabled: !!destinationData?.location_id && activeSection === 'attractions',
    staleTime: 30 * 60 * 1000,
    retry: 1
  });

  // Fetch nearby properties
  const { data: nearbyProperties, isLoading: propertiesLoading } = useQuery({
    queryKey: ['nearby-properties', destinationData?.city, destinationData?.country],
    queryFn: async () => {
      if (!destinationData?.city || !destinationData?.country) return [];
      const response = await axios.get(`${apiBaseUrl}/api/properties`, {
        params: {
          city: destinationData.city,
          country: destinationData.country,
          is_verified: true,
          sort_by: 'rating',
          sort_order: 'desc',
          limit: 12
        },
        headers: currentUser ? { Authorization: `Bearer ${useAppStore.getState().authentication_state.auth_token}` } : {}
      });
      return response.data.properties as Property[];
    },
    enabled: !!destinationData?.city && !!destinationData?.country && activeSection === 'practical',
    staleTime: 15 * 60 * 1000,
    retry: 1
  });

  // Temperature conversion helper
  const convertTemperature = (celsius: number): string => {
    if (temperatureUnit === 'fahrenheit') {
      return `${Math.round((celsius * 9/5) + 32)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  };

  // Price conversion helper
  const formatPrice = (amount: number, currency: string): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: userCurrency || currency,
      }).format(amount);
    } catch {
      return `${currency} ${amount}`;
    }
  };

  // Section navigation items
  const sectionItems = [
    { key: 'overview', label: 'Overview', icon: '🏖️' },
    { key: 'weather', label: 'Weather', icon: '🌤️' },
    { key: 'attractions', label: 'Attractions', icon: '🎯' },
    { key: 'dining', label: 'Dining', icon: '🍽️' },
    { key: 'transport', label: 'Transport', icon: '🚗' },
    { key: 'practical', label: 'Practical', icon: '💡' }
  ];

  // Loading spinner component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-600">Loading...</span>
    </div>
  );

  // Error component
  const ErrorMessage = ({ message }: { message: string }) => (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 mx-4 sm:mx-6 lg:mx-8 my-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <span className="text-red-400 text-xl">⚠️</span>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Error Loading Content</h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4">
              <nav className="flex items-center space-x-2 text-sm text-gray-500" aria-label="Breadcrumb">
                <Link to="/" className="hover:text-gray-700 transition-colors">Home</Link>
                <span>/</span>
                <Link to="/destinations" className="hover:text-gray-700 transition-colors">Destinations</Link>
                {destinationData && (
                  <>
                    <span>/</span>
                    <span className="text-gray-900 font-medium">{destinationData.city}, {destinationData.country}</span>
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {!destination_slug ? (
          /* Destinations List View */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Hot Climate Destinations</h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Discover the world's most beautiful warm-weather destinations. Perfect for your next vacation or investment opportunity.
              </p>
            </div>

            {destinationsLoading && <LoadingSpinner />}
            
            {destinationsError && (
              <ErrorMessage message="Failed to load destinations. Please try again later." />
            )}

            {destinationsList && destinationsList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {destinationsList.map((destination) => (
                  <Link
                    key={destination.location_id}
                    to={`/destinations/${destination.destination_slug}`}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
                  >
                    <div className="aspect-w-16 aspect-h-9 bg-gray-200">
                      {destination.featured_image_url ? (
                        <img 
                          src={destination.featured_image_url} 
                          alt={`${destination.city}, ${destination.country}`}
                          className="w-full h-48 object-cover"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <span className="text-white text-6xl">🏖️</span>
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {destination.city}, {destination.country}
                      </h3>
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {destination.description || `Explore the beautiful destination of ${destination.city} with its ${destination.climate_type} climate.`}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-500">
                          <span className="mr-1">🌡️</span>
                          {destination.average_temperature && convertTemperature(destination.average_temperature)}
                        </div>
                        <div className="flex items-center text-gray-500">
                          <span className="mr-1">🏠</span>
                          {destination.property_count} properties
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {destinationsList && destinationsList.length === 0 && !destinationsLoading && (
              <div className="text-center py-12">
                <span className="text-6xl">🏖️</span>
                <h3 className="text-lg font-medium text-gray-900 mt-4">No destinations found</h3>
                <p className="text-gray-500 mt-2">Check back later for new hot climate destinations.</p>
              </div>
            )}
          </div>
        ) : (
          /* Specific Destination Guide View */
          <div className="max-w-7xl mx-auto">
            {destinationLoading && <LoadingSpinner />}
            
            {destinationError && (
              <ErrorMessage message="Failed to load destination information. Please check the URL and try again." />
            )}

            {destinationData && (
              <>
                {/* Destination Header */}
                <div className="relative">
                  <div className="aspect-w-16 aspect-h-6 bg-gradient-to-r from-blue-500 to-blue-700">
                    {destinationData.featured_image_url ? (
                      <img 
                        src={destinationData.featured_image_url} 
                        alt={`${destinationData.city}, ${destinationData.country}`}
                        className="w-full h-64 sm:h-80 object-cover"
                      />
                    ) : (
                      <div className="w-full h-64 sm:h-80 bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                        <span className="text-white text-8xl">🏖️</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-30"></div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-6 sm:p-8">
                    <div className="max-w-7xl mx-auto">
                      <h1 className="text-3xl sm:text-5xl font-bold text-white mb-2">
                        {destinationData.city}, {destinationData.country}
                      </h1>
                      <div className="flex flex-wrap items-center gap-4 text-white/90">
                        <div className="flex items-center">
                          <span className="mr-2">🌡️</span>
                          {destinationData.average_temperature && convertTemperature(destinationData.average_temperature)} avg
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2">💰</span>
                          {destinationData.currency}
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2">🗣️</span>
                          {destinationData.languages.join(', ')}
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2">🏠</span>
                          {destinationData.property_count} properties
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Navigation */}
                <div className="bg-white border-b sticky top-0 z-10">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex space-x-8 overflow-x-auto">
                      {sectionItems.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => updateSelectedSection(item.key)}
                          className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                            activeSection === item.key
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="mr-2">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>

                {/* Section Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  {activeSection === 'overview' && (
                    <div className="space-y-8">
                      <div className="prose prose-lg max-w-none">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">About {destinationData.city}</h2>
                        <p className="text-gray-600 leading-relaxed">
                          {destinationData.description || 
                            `Welcome to ${destinationData.city}, ${destinationData.country}. This beautiful ${destinationData.climate_type} destination offers the perfect getaway for travelers seeking warm weather and stunning scenery.`
                          }
                        </p>
                      </div>

                      {/* Best Time to Visit */}
                      {destinationData.best_visit_months && destinationData.best_visit_months.length > 0 && (
                        <div className="bg-blue-50 rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-blue-900 mb-3">🗓️ Best Time to Visit</h3>
                          <p className="text-blue-800">
                            The ideal months to visit {destinationData.city} are: <strong>{destinationData.best_visit_months.join(', ')}</strong>
                          </p>
                        </div>
                      )}

                      {/* Current Weather */}
                      {weatherData?.current && (
                        <div className="bg-white rounded-lg shadow p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">🌤️ Current Weather</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">
                                {convertTemperature(weatherData.current.temperature_avg)}
                              </div>
                              <div className="text-sm text-gray-500">Temperature</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{weatherData.current.humidity}%</div>
                              <div className="text-sm text-gray-500">Humidity</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{weatherData.current.wind_speed} km/h</div>
                              <div className="text-sm text-gray-500">Wind Speed</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{weatherData.current.uv_index}</div>
                              <div className="text-sm text-gray-500">UV Index</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Link
                          to={`/search?destination=${destinationData.city}, ${destinationData.country}`}
                          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-center group"
                        >
                          <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">🏠</span>
                          <h4 className="font-semibold text-gray-900 mb-2">Find Properties</h4>
                          <p className="text-sm text-gray-600">Browse {destinationData.property_count} available properties</p>
                        </Link>
                        <button
                          onClick={() => updateSelectedSection('attractions')}
                          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-center group"
                        >
                          <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">🎯</span>
                          <h4 className="font-semibold text-gray-900 mb-2">Explore Attractions</h4>
                          <p className="text-sm text-gray-600">Discover local attractions and activities</p>
                        </button>
                        <button
                          onClick={() => updateSelectedSection('weather')}
                          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-center group"
                        >
                          <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">🌤️</span>
                          <h4 className="font-semibold text-gray-900 mb-2">Weather Forecast</h4>
                          <p className="text-sm text-gray-600">Check 7-day weather forecast</p>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeSection === 'weather' && (
                    <div className="space-y-8">
                      <h2 className="text-2xl font-bold text-gray-900">Weather & Climate</h2>
                      
                      {weatherLoading && <LoadingSpinner />}
                      
                      {weatherData && (
                        <>
                          {/* Current Weather */}
                          {weatherData.current && (
                            <div className="bg-white rounded-lg shadow p-6">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Conditions</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                <div className="bg-blue-50 rounded-lg p-4 text-center">
                                  <div className="text-2xl font-bold text-blue-900">
                                    {convertTemperature(weatherData.current.temperature_avg)}
                                  </div>
                                  <div className="text-sm text-blue-700">Temperature</div>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4 text-center">
                                  <div className="text-2xl font-bold text-green-900">{weatherData.current.humidity}%</div>
                                  <div className="text-sm text-green-700">Humidity</div>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-4 text-center">
                                  <div className="text-2xl font-bold text-purple-900">{weatherData.current.wind_speed}</div>
                                  <div className="text-sm text-purple-700">Wind (km/h)</div>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-4 text-center">
                                  <div className="text-2xl font-bold text-orange-900">{weatherData.current.uv_index}</div>
                                  <div className="text-sm text-orange-700">UV Index</div>
                                </div>
                                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                                  <div className="text-2xl font-bold text-yellow-900">{weatherData.current.sunshine_hours}h</div>
                                  <div className="text-sm text-yellow-700">Sunshine</div>
                                </div>
                                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                                  <div className="text-lg font-bold text-indigo-900">{weatherData.current.weather_condition}</div>
                                  <div className="text-sm text-indigo-700">Condition</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 7-Day Forecast */}
                          {weatherData.forecast && weatherData.forecast.length > 0 && (
                            <div className="bg-white rounded-lg shadow p-6">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">7-Day Forecast</h3>
                              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                                {weatherData.forecast.map((day, index) => (
                                  <div key={day.date} className="text-center border rounded-lg p-4">
                                    <div className="text-sm font-medium text-gray-900 mb-2">
                                      {index === 0 ? 'Today' : new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                    </div>
                                    <div className="text-xs text-gray-500 mb-2">
                                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="text-lg font-bold text-gray-900 mb-1">
                                      {convertTemperature(day.temperature_max)}
                                    </div>
                                    <div className="text-sm text-gray-600 mb-2">
                                      {convertTemperature(day.temperature_min)}
                                    </div>
                                    <div className="text-xs text-gray-500">{day.weather_condition}</div>
                                    {day.rainfall > 0 && (
                                      <div className="text-xs text-blue-600 mt-1">💧 {day.rainfall}mm</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Best Visit Months */}
                          {weatherData.best_visit_months && weatherData.best_visit_months.length > 0 && (
                            <div className="bg-green-50 rounded-lg p-6">
                              <h3 className="text-lg font-semibold text-green-900 mb-3">📅 Optimal Travel Months</h3>
                              <div className="flex flex-wrap gap-2">
                                {weatherData.best_visit_months.map((month) => (
                                  <span key={month} className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                    {month}
                                  </span>
                                ))}
                              </div>
                              <p className="text-green-800 mt-3 text-sm">
                                These months typically offer the best weather conditions for visiting {destinationData.city}.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeSection === 'attractions' && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900">Tourist Attractions</h2>
                        <span className="text-sm text-gray-600">
                          {attractions?.length || 0} attractions found
                        </span>
                      </div>
                      
                      {attractionsLoading && <LoadingSpinner />}
                      
                      {attractions && attractions.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {attractions.map((attraction) => (
                            <div key={attraction.attraction_id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow">
                              <div className="aspect-w-16 aspect-h-9 bg-gray-200">
                                {attraction.image_urls && attraction.image_urls.length > 0 ? (
                                  <img 
                                    src={attraction.image_urls[0]} 
                                    alt={attraction.name}
                                    className="w-full h-48 object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-48 bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                                    <span className="text-gray-600 text-4xl">🎯</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-6">
                                <div className="flex items-start justify-between mb-2">
                                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{attraction.name}</h3>
                                  {attraction.is_featured && (
                                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                                      Featured
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center mb-2">
                                  <div className="flex items-center">
                                    <span className="text-yellow-400 mr-1">⭐</span>
                                    <span className="text-sm font-medium text-gray-900">{attraction.rating.toFixed(1)}</span>
                                  </div>
                                  <span className="mx-2 text-gray-300">•</span>
                                  <span className="text-sm text-gray-600 capitalize">{attraction.category}</span>
                                </div>
                                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{attraction.description}</p>
                                <div className="space-y-2">
                                  <div className="flex items-center text-sm text-gray-600">
                                    <span className="mr-2">📍</span>
                                    <span className="line-clamp-1">{attraction.address}</span>
                                  </div>
                                  {attraction.admission_fee > 0 && (
                                    <div className="flex items-center text-sm text-gray-600">
                                      <span className="mr-2">💰</span>
                                      <span>{formatPrice(attraction.admission_fee, destinationData.currency)} admission</span>
                                    </div>
                                  )}
                                  {attraction.website_url && (
                                    <a
                                      href={attraction.website_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                      <span className="mr-2">🌐</span>
                                      Visit Website
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {attractions && attractions.length === 0 && !attractionsLoading && (
                        <div className="text-center py-12">
                          <span className="text-6xl">🎯</span>
                          <h3 className="text-lg font-medium text-gray-900 mt-4">No attractions found</h3>
                          <p className="text-gray-500 mt-2">Check back later for attraction information.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeSection === 'dining' && (
                    <div className="space-y-8">
                      <h2 className="text-2xl font-bold text-gray-900">Dining & Entertainment</h2>
                      
                      {/* Placeholder content for dining section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-lg shadow p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">🍽️ Local Cuisine</h3>
                          <p className="text-gray-600 mb-4">
                            Experience the authentic flavors of {destinationData.city} with its diverse culinary scene.
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🥘</span>
                              <span>Traditional local dishes</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🍷</span>
                              <span>Local wines and beverages</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🌶️</span>
                              <span>Spice levels and dietary options</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">🌃 Nightlife</h3>
                          <p className="text-gray-600 mb-4">
                            Discover the vibrant nightlife and entertainment options in {destinationData.city}.
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🍸</span>
                              <span>Bars and lounges</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">💃</span>
                              <span>Dancing and live music</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🎭</span>
                              <span>Cultural performances</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-yellow-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-yellow-900 mb-3">💡 Dining Tips</h3>
                        <ul className="space-y-2 text-yellow-800">
                          <li>• Tipping customs: Check local tipping practices</li>
                          <li>• Meal times: Restaurants may have different operating hours</li>
                          <li>• Reservations: Popular restaurants may require advance booking</li>
                          <li>• Dietary restrictions: Inform restaurants of any allergies or dietary needs</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeSection === 'transport' && (
                    <div className="space-y-8">
                      <h2 className="text-2xl font-bold text-gray-900">Transportation Guide</h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-white rounded-lg shadow p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">✈️ Airport Transfers</h3>
                          <div className="space-y-3">
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🚖</span>
                              <span>Taxi services available</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🚌</span>
                              <span>Airport shuttle buses</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🚗</span>
                              <span>Car rental counters</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">🚌 Public Transport</h3>
                          <div className="space-y-3">
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🎫</span>
                              <span>Local transport passes</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🗺️</span>
                              <span>Route maps and schedules</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">💳</span>
                              <span>Payment methods accepted</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">🚲 Alternative Transport</h3>
                          <div className="space-y-3">
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🚲</span>
                              <span>Bicycle rental stations</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🛴</span>
                              <span>Scooter sharing services</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="mr-3">🚶</span>
                              <span>Walking routes and paths</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-blue-900 mb-3">🚗 Getting Around Tips</h3>
                        <ul className="space-y-2 text-blue-800">
                          <li>• Download local transport apps for real-time information</li>
                          <li>• Consider traffic patterns during rush hours</li>
                          <li>• International driving license may be required for car rentals</li>
                          <li>• Many attractions are within walking distance of each other</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeSection === 'practical' && (
                    <div className="space-y-8">
                      <h2 className="text-2xl font-bold text-gray-900">Practical Information</h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div className="bg-red-50 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-red-900 mb-4">🚨 Emergency Contacts</h3>
                            <div className="space-y-2">
                              <div className="flex items-center text-sm">
                                <span className="mr-3">🚔</span>
                                <span>Police: Check local emergency number</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="mr-3">🚑</span>
                                <span>Medical Emergency: Check local emergency number</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="mr-3">🚒</span>
                                <span>Fire Department: Check local emergency number</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">🏥 Healthcare</h3>
                            <div className="space-y-2">
                              <div className="flex items-center text-sm">
                                <span className="mr-3">🏥</span>
                                <span>Local hospitals and clinics</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="mr-3">💊</span>
                                <span>Pharmacy locations</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="mr-3">🩺</span>
                                <span>Travel insurance recommended</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Banking & Money</h3>
                            <div className="space-y-2">
                              <div className="flex items-center text-sm">
                                <span className="mr-3">💳</span>
                                <span>ATM locations widely available</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="mr-3">💵</span>
                                <span>Local currency: {destinationData.currency}</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="mr-3">🏧</span>
                                <span>Credit cards generally accepted</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">📶 Connectivity</h3>
                            <div className="space-y-2">
                              <div className="flex items-center text-sm">
                                <span className="mr-3">📱</span>
                                <span>Mobile network coverage good</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="mr-3">📶</span>
                                <span>WiFi available in most accommodations</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <span className="mr-3">☕</span>
                                <span>Free WiFi in cafes and restaurants</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Nearby Properties */}
                      {propertiesLoading && <LoadingSpinner />}
                      
                      {nearbyProperties && nearbyProperties.length > 0 && (
                        <div className="bg-white rounded-lg shadow p-6">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">🏠 Accommodation Options</h3>
                            <Link
                              to={`/search?destination=${destinationData.city}, ${destinationData.country}`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                            >
                              View All Properties →
                            </Link>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {nearbyProperties.slice(0, 6).map((property) => (
                              <Link
                                key={property.property_id}
                                to={`/property/${property.property_id}`}
                                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                              >
                                <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">{property.title}</h4>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-gray-600 capitalize">{property.property_type}</span>
                                  {property.average_rating && (
                                    <div className="flex items-center">
                                      <span className="text-yellow-400 mr-1">⭐</span>
                                      <span className="text-sm font-medium">{property.average_rating.toFixed(1)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-semibold text-gray-900">
                                    {formatPrice(property.base_price_per_night, property.currency)}
                                    <span className="text-sm font-normal text-gray-600">/night</span>
                                  </span>
                                  {property.distance_beach && (
                                    <span className="text-xs text-blue-600">
                                      🏖️ {property.distance_beach}km to beach
                                    </span>
                                  )}
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bg-green-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-green-900 mb-3">📝 Travel Tips</h3>
                        <ul className="space-y-2 text-green-800">
                          <li>• Keep copies of important documents in separate locations</li>
                          <li>• Learn basic phrases in the local language</li>
                          <li>• Research local customs and etiquette</li>
                          <li>• Check visa requirements before traveling</li>
                          <li>• Register with your embassy if staying long-term</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default UV_LocalGuides;