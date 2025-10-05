import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Weather data interfaces
interface CurrentWeather {
  temperature_avg: number;
  humidity: number;
  wind_speed: number;
  uv_index: number;
  weather_condition: string;
  sunshine_hours: number;
}

interface WeatherForecast {
  date: string;
  temperature_min: number;
  temperature_max: number;
  temperature_avg: number;
  weather_condition: string;
  rainfall: number;
}

interface WeatherResponse {
  current: CurrentWeather;
  forecast: WeatherForecast[];
  best_visit_months: string[];
}

const GV_WeatherWidget: React.FC = () => {
  const location = useLocation();
  const params = useParams();
  const queryClient = useQueryClient();
  
  // CRITICAL: Individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const searchDestination = useAppStore(state => state.search_state.destination);
  const temperatureUnit = useAppStore(state => state.user_preferences.temperature_unit);
  const updateTemperatureUnit = useAppStore(state => state.update_temperature_unit);

  // Local state for widget
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine location context based on current route
  const contextualLocationId = useMemo(() => {
    // Property detail page - would get location from property data
    if (location.pathname.includes('/property/')) {
      return params.property_id ? `property_${params.property_id}` : null;
    }

// Destination guide page
    if (location.pathname.includes('/destinations/') && params.destination_slug) {
      return `dest_${params.destination_slug}`;
    }

// Search results or landing page with search destination
    if (searchDestination) {
      return `search_${searchDestination.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    
    return null;
  }, [location.pathname, params, searchDestination]);

  // Update selected location when context changes
  useEffect(() => {
    setSelectedLocationId(contextualLocationId);
  }, [contextualLocationId]);

  // Fetch weather data
  const {
    data: weatherData,
    isLoading,
    error,
    refetch
  } = useQuery<WeatherResponse>({
    queryKey: ['weather', selectedLocationId],
    queryFn: async () => {
      if (!selectedLocationId) throw new Error('No location selected');
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/locations/${selectedLocationId}/api/weather`,
        {
          params: {
            forecast_days: 5,
            include_historical: false
          }
        }
      );
      
      return {
        current: response.data.current,
        forecast: response.data.forecast.slice(0, 5),
        best_visit_months: response.data.best_visit_months || []
      };
    },
    enabled: !!selectedLocationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Update temperature unit preference
  const temperatureUnitMutation = useMutation({
    mutationFn: async (newUnit: 'celsius' | 'fahrenheit') => {
      if (!isAuthenticated || !currentUser?.user_id) {
        throw new Error('Authentication required');
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}`,
        { temperature_unit: newUnit },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    },
    onSuccess: (_, newUnit) => {
      updateTemperatureUnit(newUnit);
      queryClient.invalidateQueries({ queryKey: ['weather'] });
    },
    onError: (error) => {
      console.error('Failed to update temperature unit:', error);
    }
  });

  // Temperature conversion
  const convertTemperature = (temp: number, unit: 'celsius' | 'fahrenheit') => {
    if (unit === 'fahrenheit') {
      return Math.round((temp * 9/5) + 32);
    }
    return Math.round(temp);
  };

  // Weather condition icon mapping
  const getWeatherIcon = (condition: string) => {
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
      return '☀️';
    } else if (conditionLower.includes('cloud')) {
      return '⛅';
    } else if (conditionLower.includes('rain')) {
      return '🌧️';
    } else if (conditionLower.includes('storm')) {
      return '⛈️';
    }
    return '🌤️';
  };

  // UV index color and warning
  const getUVInfo = (uvIndex: number) => {
    if (uvIndex <= 2) {
      return { color: 'text-green-600', level: 'Low', warning: 'Minimal protection needed' };
    } else if (uvIndex <= 5) {
      return { color: 'text-yellow-600', level: 'Moderate', warning: 'Seek shade during midday' };
    } else if (uvIndex <= 7) {
      return { color: 'text-orange-600', level: 'High', warning: 'Protection essential' };
    } else if (uvIndex <= 10) {
      return { color: 'text-red-600', level: 'Very High', warning: 'Extra protection required' };
    }
    return { color: 'text-purple-600', level: 'Extreme', warning: 'Avoid sun exposure' };
  };

  // Handle temperature unit toggle
  const handleTemperatureToggle = () => {
    const newUnit = temperatureUnit === 'celsius' ? 'fahrenheit' : 'celsius';
    
    if (isAuthenticated) {
      temperatureUnitMutation.mutate(newUnit);
    } else {
      updateTemperatureUnit(newUnit);
    }
  };

  // Don't render if no location context
  if (!selectedLocationId) {
    return null;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Widget Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center">
              <span className="mr-2">🌤️</span>
              Weather Forecast
            </h3>
            <button
              onClick={handleTemperatureToggle}
              disabled={temperatureUnitMutation.isPending}
              className="text-xs bg-blue-400 hover:bg-blue-300 px-2 py-1 rounded-full transition-colors disabled:opacity-50"
              aria-label={`Switch to ${temperatureUnit === 'celsius' ? 'Fahrenheit' : 'Celsius'}`}
            >
              °{temperatureUnit === 'celsius' ? 'C' : 'F'}
            </button>
          </div>
        </div>

        {/* Weather Content */}
        <div className="p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading weather...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-4">
              <p className="text-sm text-red-600 mb-2">Unable to load weather data</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {weatherData && (
            <>
              {/* Current Weather */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-3xl mr-2">{getWeatherIcon(weatherData.current.weather_condition)}</span>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {convertTemperature(weatherData.current.temperature_avg, temperatureUnit)}°{temperatureUnit === 'celsius' ? 'C' : 'F'}
                    </div>
                    <div className="text-sm text-gray-600 capitalize">
                      {weatherData.current.weather_condition}
                    </div>
                  </div>
                </div>

                {/* Weather Details */}
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <div className="text-center">
                    <div className="font-medium">Humidity</div>
                    <div>{Math.round(weatherData.current.humidity)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Wind</div>
                    <div>{Math.round(weatherData.current.wind_speed)} km/h</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Sun Hours</div>
                    <div>{Math.round(weatherData.current.sunshine_hours)}h</div>
                  </div>
                </div>
              </div>

              {/* UV Index Warning */}
              {weatherData.current.uv_index > 5 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-4">
                  <div className="flex items-center text-xs">
                    <span className="mr-1">☀️</span>
                    <span className={`font-medium ${getUVInfo(weatherData.current.uv_index).color}`}>
                      UV {getUVInfo(weatherData.current.uv_index).level}
                    </span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1">
                    {getUVInfo(weatherData.current.uv_index).warning}
                  </p>
                </div>
              )}

              {/* 5-Day Forecast Toggle */}
              <div className="border-t pt-3">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900"
                  aria-expanded={isExpanded}
                >
                  <span>5-Day Forecast</span>
                  <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {weatherData.forecast.map((day, index) => (
                      <div key={day.date} className="flex items-center justify-between text-xs">
                        <div className="flex items-center flex-1">
                          <span className="mr-2">{getWeatherIcon(day.weather_condition)}</span>
                          <span className="text-gray-600">
                            {index === 0 ? 'Today' : new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {day.rainfall > 0 && (
                            <span className="text-blue-600">
                              💧 {Math.round(day.rainfall)}mm
                            </span>
                          )}
                          <span className="font-medium">
                            {convertTemperature(day.temperature_max, temperatureUnit)}°
                          </span>
                          <span className="text-gray-500">
                            {convertTemperature(day.temperature_min, temperatureUnit)}°
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Best Time to Visit */}
              {weatherData.best_visit_months.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Best Time to Visit</h4>
                  <div className="flex flex-wrap gap-1">
                    {weatherData.best_visit_months.map((month) => (
                      <span
                        key={month}
                        className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full"
                      >
                        {month}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to Detailed Weather */}
              {location.pathname.includes('/destinations/') && (
                <div className="mt-4 pt-3 border-t">
                  <Link
                    to={`${location.pathname}?section=weather`}
                    className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center"
                  >
                    View detailed weather →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default GV_WeatherWidget;