import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { isValidDateString, getTodayDateString, getMaxBookingDate } from '@/lib/utils';

// Types for API responses
interface LocationSuggestion {
  location_id: string;
  country: string;
  city: string;
  destination_slug: string;
  is_hot_destination: boolean;
  property_count: number;
  is_featured?: boolean;
  featured_image_url?: string;
  average_temperature?: number;
}

interface SavedSearchResponse {
  saved_searches: {
    search_id: string;
    search_name: string;
    destination?: string;
    check_in_date?: string;
    check_out_date?: string;
    guest_count?: number;
    created_at: string;
  }[];
}

interface LocationsResponse {
  locations: LocationSuggestion[];
  total: number;
}

    // API functions
const fetchDestinationSuggestions = async (query: string): Promise<LocationSuggestion[]> => {
  if (!query || query.length < 2) return [];
  
  const response = await axios.get<LocationsResponse>(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/locations`,
    {
      params: {
        query: query.trim(),
        is_hot_destination: true,
        limit: 8,
        sort_by: 'property_count',
        sort_order: 'desc'
      }
    }
  );
  
  return response.data.locations.map(location => ({
    location_id: location.location_id,
    display_name: `${location.city}, ${location.country}`,
    destination_slug: location.destination_slug,
    property_count: location.property_count,
    is_featured: location.is_featured,
    country: location.country,
    city: location.city,
    is_hot_destination: location.is_hot_destination
  }));
};

const fetchPopularDestinations = async (): Promise<LocationSuggestion[]> => {
  const response = await axios.get<LocationsResponse>(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/locations`,
    {
      params: {
        is_featured: true,
        is_hot_destination: true,
        limit: 6,
        sort_by: 'property_count',
        sort_order: 'desc'
      }
    }
  );
  
  return response.data.locations.map(location => ({
    location_id: location.location_id,
    display_name: `${location.city}, ${location.country}`,
    image_url: location.featured_image_url,
    property_count: location.property_count,
    average_temperature: location.average_temperature,
    country: location.country,
    city: location.city,
    destination_slug: location.destination_slug,
    is_hot_destination: location.is_hot_destination
  }));
};

const fetchRecentSearches = async (authToken: string, userId: string) => {
  const response = await axios.get<SavedSearchResponse>(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/saved-searches`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
      params: {
        user_id: userId,
        is_active: true,
        limit: 5,
        sort_by: 'created_at',
        sort_order: 'desc'
      }
    }
  );
  
  return response.data.saved_searches.map(search => ({
    search_id: search.search_id,
    display_name: search.search_name || `${search.destination} • ${search.guest_count} guests`,
    destination: search.destination,
    check_in_date: search.check_in_date,
    check_out_date: search.check_out_date,
    guest_count: search.guest_count
  }));
};

const GV_SearchBar: React.FC = () => {
  const navigate = useNavigate();
  
  // Zustand store - individual selectors to prevent infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const globalSearchState = useAppStore(state => state.search_state);

  const updateSearchCriteria = useAppStore(state => state.update_search_criteria);
  
  // Local state
  const [destination, setDestination] = useState(globalSearchState.destination || '');
  const [checkInDate, setCheckInDate] = useState(globalSearchState.check_in_date || '');
  const [checkOutDate, setCheckOutDate] = useState(globalSearchState.check_out_date || '');
  const [guestCount, setGuestCount] = useState(globalSearchState.guest_count || 1);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [showPopularDestinations, setShowPopularDestinations] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateValidationErrors, setDateValidationErrors] = useState<{
    check_in: string | null;
    check_out: string | null;
    date_range: string | null;
  }>({
    check_in: null,
    check_out: null,
    date_range: null
  });

  // Debounced search query for autocomplete
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // API queries
  const { data: destinationSuggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ['destination-suggestions', debouncedQuery],
    queryFn: () => fetchDestinationSuggestions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  const { data: popularDestinations = [] } = useQuery({
    queryKey: ['popular-destinations'],
    queryFn: fetchPopularDestinations,
    staleTime: 300000,
    refetchOnWindowFocus: false
  });

  const { data: recentSearches = [] } = useQuery({
    queryKey: ['recent-searches', currentUser?.user_id],
    queryFn: () => fetchRecentSearches(authToken!, currentUser!.user_id),
    enabled: isAuthenticated && !!authToken && !!currentUser,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // Save search mutation
  const saveSearchMutation = useMutation({
    mutationFn: async (searchData: {
      user_id: string;
      search_name: string;
      destination: string;
      check_in_date: string;
      check_out_date: string;
      guest_count: number;
    }) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/saved-searches`,
        searchData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    }
  });

  // Validation
  const validateDates = useCallback(() => {
    const errors: { check_in: string | null; check_out: string | null; date_range: string | null } = { check_in: null, check_out: null, date_range: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (checkInDate) {
      const checkIn = new Date(checkInDate);
      if (checkIn < today) {
        errors.check_in = 'Check-in date cannot be in the past';
      }
    }
    
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      
      if (checkOut <= checkIn) {
        errors.date_range = 'Check-out date must be after check-in date';
      }
      
      const daysDiff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        errors.date_range = 'Maximum stay is 365 days';
      }
    }
    
    setDateValidationErrors(errors);
    return !errors.check_in && !errors.check_out && !errors.date_range;
  }, [checkInDate, checkOutDate]);

  useEffect(() => {
    validateDates();
  }, [validateDates]);

  // Guest count calculation
  useEffect(() => {
    setGuestCount(adults + children);
  }, [adults, children]);

  // Handle destination input
  const handleDestinationChange = (value: string) => {
    setDestination(value);
    setSearchQuery(value);
    setShowDestinationSuggestions(value.length >= 2);
    
    // Clear errors when input changes
    if (dateValidationErrors.check_in || dateValidationErrors.check_out || dateValidationErrors.date_range) {
      setDateValidationErrors({ check_in: null, check_out: null, date_range: null });
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    setDestination(`${suggestion.city}, ${suggestion.country}`);
    setShowDestinationSuggestions(false);
    setSearchQuery('');
  };

  // Handle popular destination selection
  const handlePopularDestinationSelect = (destination: LocationSuggestion) => {
    setDestination(`${destination.city}, ${destination.country}`);
    setShowPopularDestinations(false);
  };

  // Handle recent search selection
  const handleRecentSearchSelect = (search: any) => {
    setDestination(search.destination || '');
    setCheckInDate(search.check_in_date || '');
    setCheckOutDate(search.check_out_date || '');
    setGuestCount(search.guest_count || 1);
    setAdults(Math.max(1, (search.guest_count || 1) - children));
    setShowRecentSearches(false);
  };

  // Handle search execution
  const handleSearch = () => {
    if (!validateDates()) {
      return;
    }

    // Update global search state
    updateSearchCriteria({
      destination: destination || null,
      check_in_date: checkInDate || null,
      check_out_date: checkOutDate || null,
      guest_count: guestCount,
      search_loading: true
    });

    // Build search URL parameters
    const searchParams = new URLSearchParams();
    if (destination) searchParams.set('destination', destination);
    if (checkInDate) searchParams.set('check_in_date', checkInDate);
    if (checkOutDate) searchParams.set('check_out_date', checkOutDate);
    if (guestCount > 1) searchParams.set('guest_count', guestCount.toString());

    // Navigate to search results
    navigate(`/search?${searchParams.toString()}`);
  };

  // Handle save search
  const handleSaveSearch = () => {
    if (!isAuthenticated || !currentUser || !destination) return;

    const searchName = `${destination} • ${guestCount} guests`;
    saveSearchMutation.mutate({
      user_id: currentUser.user_id,
      search_name: searchName,
      destination,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      guest_count: guestCount
    });
  };





  return (
    <>
      <div className="relative bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            {/* Desktop Search Bar */}
            <div className="hidden md:block">
              <div className="flex items-center space-x-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                {/* Destination Input */}
                <div className="flex-1 relative">
                  <label htmlFor="destination-desktop" className="block text-xs font-medium text-gray-700 mb-1">
                    Where to?
                  </label>
                  <div className="relative">
                    <input
                      id="destination-desktop"
                      type="text"
                      value={destination}
                      onChange={(e) => handleDestinationChange(e.target.value)}
                      onFocus={() => {
                        if (destination.length >= 2) setShowDestinationSuggestions(true);
                        if (isAuthenticated && recentSearches.length > 0) setShowRecentSearches(true);
                        if (popularDestinations.length > 0) setShowPopularDestinations(true);
                      }}
                      placeholder="Search destinations..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Destination search"
                    />
                    {suggestionsLoading && (
                      <div className="absolute right-3 top-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Destination Suggestions Dropdown */}
                  {(showDestinationSuggestions || showRecentSearches || showPopularDestinations) && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto">
                      {/* Recent Searches */}
                      {showRecentSearches && isAuthenticated && recentSearches.length > 0 && (
                        <div className="p-2 border-b border-gray-100">
                          <div className="text-xs font-medium text-gray-500 mb-2">Recent searches</div>
                          {recentSearches.map((search) => (
                            <button
                              key={search.search_id}
                              onClick={() => handleRecentSearchSelect(search)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm flex items-center justify-between"
                            >
                              <span>{search.display_name}</span>
                              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Destination Suggestions */}
                      {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                        <div className="p-2 border-b border-gray-100">
                          <div className="text-xs font-medium text-gray-500 mb-2">Suggestions</div>
                          {destinationSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.location_id}
                              onClick={() => handleSuggestionSelect(suggestion)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm flex items-center justify-between"
                            >
                              <div>
                                <div className="font-medium">{suggestion.city}, {suggestion.country}</div>
                                <div className="text-xs text-gray-500">{suggestion.property_count} properties</div>
                              </div>
                              {suggestion.is_hot_destination && (
                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Hot destination</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Popular Destinations */}
                      {showPopularDestinations && popularDestinations.length > 0 && (
                        <div className="p-2">
                          <div className="text-xs font-medium text-gray-500 mb-2">Popular destinations</div>
                          {popularDestinations.map((destination) => (
                            <button
                              key={destination.location_id}
                              onClick={() => handlePopularDestinationSelect(destination)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm flex items-center justify-between"
                            >
                              <div>
                                <div className="font-medium">{destination.city}, {destination.country}</div>
                                <div className="text-xs text-gray-500">
                                  {destination.property_count} properties
                                  {destination.average_temperature && (
                                    <span className="ml-2">• {Math.round(destination.average_temperature)}°C avg</span>
                                  )}
                                </div>
                              </div>
                              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Check-in Date */}
                <div className="flex-shrink-0">
                  <label htmlFor="checkin-desktop" className="block text-xs font-medium text-gray-700 mb-1">
                    Check-in
                  </label>
                  <input
                    id="checkin-desktop"
                    type="date"
                    value={checkInDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value || isValidDateString(value)) {
                        setCheckInDate(value);
                        if (dateValidationErrors.check_in) {
                          setDateValidationErrors(prev => ({ ...prev, check_in: null }));
                        }
                      }
                    }}
                    min={getTodayDateString()}
                    max={getMaxBookingDate()}
                    className={`px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      dateValidationErrors.check_in ? 'border-red-300' : 'border-gray-300'
                    }`}
                    aria-label="Check-in date"
                  />
                </div>

                {/* Check-out Date */}
                <div className="flex-shrink-0">
                  <label htmlFor="checkout-desktop" className="block text-xs font-medium text-gray-700 mb-1">
                    Check-out
                  </label>
                  <input
                    id="checkout-desktop"
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value || isValidDateString(value)) {
                        setCheckOutDate(value);
                        if (dateValidationErrors.check_out || dateValidationErrors.date_range) {
                          setDateValidationErrors(prev => ({ ...prev, check_out: null, date_range: null }));
                        }
                      }
                    }}
                    min={checkInDate || getTodayDateString()}
                    max={getMaxBookingDate()}
                    className={`px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      dateValidationErrors.check_out || dateValidationErrors.date_range ? 'border-red-300' : 'border-gray-300'
                    }`}
                    aria-label="Check-out date"
                  />
                </div>

                {/* Guests */}
                <div className="flex-shrink-0 relative">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Guests
                  </label>
                  <button
                    onClick={() => setShowGuestDropdown(!showGuestDropdown)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-24 text-left"
                    aria-label={`${guestCount} guests`}
                  >
                    {guestCount} guest{guestCount !== 1 ? 's' : ''}
                  </button>
                  
                  {showGuestDropdown && (
                    <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 min-w-72">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">Adults</div>
                            <div className="text-xs text-gray-500">Ages 13+</div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => setAdults(Math.max(1, adults - 1))}
                              disabled={adults <= 1}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
                              aria-label="Decrease adults"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="w-8 text-center text-sm">{adults}</span>
                            <button
                              onClick={() => setAdults(Math.min(16, adults + 1))}
                              disabled={adults >= 16}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
                              aria-label="Increase adults"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">Children</div>
                            <div className="text-xs text-gray-500">Ages 2-12</div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => setChildren(Math.max(0, children - 1))}
                              disabled={children <= 0}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
                              aria-label="Decrease children"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="w-8 text-center text-sm">{children}</span>
                            <button
                              onClick={() => setChildren(Math.min(8, children + 1))}
                              disabled={children >= 8}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
                              aria-label="Increase children"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">Infants</div>
                            <div className="text-xs text-gray-500">Under 2</div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => setInfants(Math.max(0, infants - 1))}
                              disabled={infants <= 0}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
                              aria-label="Decrease infants"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="w-8 text-center text-sm">{infants}</span>
                            <button
                              onClick={() => setInfants(Math.min(5, infants + 1))}
                              disabled={infants >= 5}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
                              aria-label="Increase infants"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Search Button */}
                <div className="flex-shrink-0 flex items-end">
                  <button
                    onClick={handleSearch}
                    disabled={!destination || !!dateValidationErrors.check_in || !!dateValidationErrors.check_out || !!dateValidationErrors.date_range}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center space-x-2"
                    aria-label="Search properties"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Search</span>
                  </button>
                </div>

                {/* Save Search Button */}
                {isAuthenticated && destination && (
                  <div className="flex-shrink-0 flex items-end">
                    <button
                      onClick={handleSaveSearch}
                      disabled={saveSearchMutation.isPending}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center space-x-2"
                      aria-label="Save search"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span>Save</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Search Bar - Simplified */}
            <div className="md:hidden">
              <button
                onClick={() => navigate('/search')}
                className="w-full flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200 text-left"
                aria-label="Open search"
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Where to?</div>
                  <div className="text-xs text-gray-500">Search destinations • Add dates • Add guests</div>
                </div>
              </button>
            </div>

            {/* Validation Errors */}
            {(dateValidationErrors.check_in || dateValidationErrors.check_out || dateValidationErrors.date_range) && (
              <div className="mt-2 text-sm text-red-600" role="alert" aria-live="polite">
                {dateValidationErrors.check_in || dateValidationErrors.check_out || dateValidationErrors.date_range}
              </div>
            )}
          </div>
        </div>

        {/* Click outside handlers */}
        {(showDestinationSuggestions || showGuestDropdown || showRecentSearches || showPopularDestinations) && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setShowDestinationSuggestions(false);
              setShowGuestDropdown(false);
              setShowRecentSearches(false);
              setShowPopularDestinations(false);
            }}/>
        )}
      </div>
    </>
  );
};

export default GV_SearchBar;