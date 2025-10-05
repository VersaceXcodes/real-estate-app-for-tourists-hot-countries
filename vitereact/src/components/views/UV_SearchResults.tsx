import React, { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Types for API responses
interface PropertyPhoto {
  photo_id: string;
  photo_url: string;
  is_cover_photo: boolean;
}

interface SearchProperty {
  property_id: string;
  title: string;
  country: string;
  city: string;
  base_price_per_night: number;
  currency: string;
  average_rating: number;
  review_count: number;
  photos: PropertyPhoto[];
  amenities: string[];
  instant_booking: boolean;
  distance_beach: number;
  distance_airport: number;
  owner_id: string;
  first_name: string;
  last_name: string;
  is_superhost: boolean;
  cover_photo_url?: string;
}

interface SearchResponse {
  properties: SearchProperty[];
  total: number;
  filters: {
    applied: Record<string, any>;
    available_sort_options: string[];
  };
}

interface SavedSearch {
  search_id: string;
  search_name: string;
  destination: string;
  created_at: string;
}

interface UserFavorite {
  property_id: string;
  favorited_at: string;
}

// Filter interfaces
interface SearchFilters {
  destination: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  property_type: string;
  price_min: number;
  price_max: number;
  amenities: string[];
  instant_booking: boolean;
  distance_beach: number;
  distance_airport: number;
  host_language: string;
  sort_by: string;
  sort_order: string;
}

const UV_SearchResults: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Zustand store selectors - CRITICAL: Individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Local state
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  const [showSaveSearchModal, setShowSaveSearchModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  // Parse URL parameters to search filters
  const searchFilters = useMemo((): SearchFilters => {
    const amenitiesParam = searchParams.get('amenities');
    return {
      destination: searchParams.get('destination') || '',
      check_in_date: searchParams.get('check_in_date') || '',
      check_out_date: searchParams.get('check_out_date') || '',
      guest_count: parseInt(searchParams.get('guest_count') || '1'),
      property_type: searchParams.get('property_type') || '',
      price_min: parseFloat(searchParams.get('price_min') || '0'),
      price_max: parseFloat(searchParams.get('price_max') || '0'),
      amenities: amenitiesParam ? amenitiesParam.split(',') : [],
      instant_booking: searchParams.get('instant_booking') === 'true',
      distance_beach: parseFloat(searchParams.get('distance_beach') || '0'),
      distance_airport: parseFloat(searchParams.get('distance_airport') || '0'),
      host_language: searchParams.get('host_language') || '',
      sort_by: searchParams.get('sort_by') || 'created_at',
      sort_order: searchParams.get('sort_order') || 'desc',
    };
  }, [searchParams]);

  // Update URL when filters change
  const updateURL = useCallback((newFilters: Partial<SearchFilters>, newPage: number = 1) => {
    const params = new URLSearchParams();
    
    const filters = { ...searchFilters, ...newFilters };
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && value !== 0 && (Array.isArray(value) ? value.length > 0 : true)) {
        if (Array.isArray(value)) {
          params.set(key, value.join(','));
        } else {
          params.set(key, value.toString());
        }
      }
    });
    
    if (newPage > 1) {
      params.set('page', newPage.toString());
    }
    
    params.set('view_type', viewMode);
    
    setSearchParams(params);
    setCurrentPage(newPage);
  }, [searchFilters, viewMode, setSearchParams]);

  // Property search query
  const { data: searchData, isLoading: isSearching, error: searchError } = useQuery({
    queryKey: ['properties', searchFilters, currentPage],
    queryFn: async (): Promise<SearchResponse> => {
      const params = new URLSearchParams();
      
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value && value !== '' && value !== 0 && (Array.isArray(value) ? value.length > 0 : true)) {
          if (Array.isArray(value)) {
            params.set(key, value.join(','));
          } else {
            params.set(key, value.toString());
          }
        }
      });
      
      params.set('limit', '10');
      params.set('offset', ((currentPage - 1) * 10).toString());
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties?${params.toString()}`
      );
      
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: true,
  });

  // User favorites query
  const { data: userFavorites } = useQuery({
    queryKey: ['userFavorites', currentUser?.user_id],
    queryFn: async (): Promise<UserFavorite[]> => {
      if (!currentUser?.user_id || !authToken) return [];
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}/api/favorites`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data.favorites.map((fav: any) => ({
        property_id: fav.property_id,
        favorited_at: fav.favorited_at || new Date().toISOString(),
      }));
    },
    enabled: isAuthenticated && !!currentUser?.user_id,
    staleTime: 5 * 60 * 1000,
  });

  // Saved searches query
  const { data: savedSearches } = useQuery({
    queryKey: ['savedSearches', currentUser?.user_id],
    queryFn: async (): Promise<SavedSearch[]> => {
      if (!currentUser?.user_id || !authToken) return [];
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/saved-searches?user_id=${currentUser.user_id}&is_active=true`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      return response.data.saved_searches || [];
    },
    enabled: isAuthenticated && !!currentUser?.user_id,
    staleTime: 5 * 60 * 1000,
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ propertyId, isFavorited }: { propertyId: string; isFavorited: boolean }) => {
      if (!currentUser?.user_id || !authToken) throw new Error('Authentication required');
      
      if (isFavorited) {
        await axios.delete(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}/api/favorites/${propertyId}`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}/api/favorites`,
          { property_id: propertyId },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userFavorites'] });
    },
    onError: (error) => {
      console.error('Error toggling favorite:', error);
    },
  });

  // Save search mutation
  const saveSearchMutation = useMutation({
    mutationFn: async (searchName: string) => {
      if (!currentUser?.user_id || !authToken) throw new Error('Authentication required');
      
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/saved-searches`,
        {
          user_id: currentUser.user_id,
          search_name: searchName,
          destination: searchFilters.destination,
          check_in_date: searchFilters.check_in_date || null,
          check_out_date: searchFilters.check_out_date || null,
          guest_count: searchFilters.guest_count || null,
          property_type: searchFilters.property_type || null,
          price_min: searchFilters.price_min || null,
          price_max: searchFilters.price_max || null,
          amenities: searchFilters.amenities.length > 0 ? searchFilters.amenities : null,
          instant_booking: searchFilters.instant_booking || null,
          distance_beach: searchFilters.distance_beach || null,
          distance_airport: searchFilters.distance_airport || null,
          host_language: searchFilters.host_language || null,
          sort_by: searchFilters.sort_by || null,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] });
      setShowSaveSearchModal(false);
      setSaveSearchName('');
    },
    onError: (error) => {
      console.error('Error saving search:', error);
    },
  });

  // Handle favorite toggle
  const handleToggleFavorite = (propertyId: string) => {
    if (!isAuthenticated) {
      navigate('/auth?mode=login&redirect_to=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    
    const isFavorited = userFavorites?.some(fav => fav.property_id === propertyId) || false;
    toggleFavoriteMutation.mutate({ propertyId, isFavorited });
  };

  // Handle save search
  const handleSaveSearch = () => {
    if (!isAuthenticated) {
      navigate('/auth?mode=login&redirect_to=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    
    if (saveSearchName.trim()) {
      saveSearchMutation.mutate(saveSearchName.trim());
    }
  };

  // Available amenities for filter
  const availableAmenities = [
    'wifi', 'pool', 'ac', 'kitchen', 'parking', 'tv', 'washer', 'heating',
    'gym', 'balcony', 'garden', 'beach_access', 'hot_tub', 'fireplace'
  ];

  // Available property types
  const propertyTypes = ['villa', 'apartment', 'house', 'resort', 'hotel'];



  // Calculate pagination
  const totalResults = searchData?.total || 0;
  const totalPages = Math.ceil(totalResults / 10);
  const results = searchData?.properties || [];

  // Check if property is favorited
  const isPropertyFavorited = (propertyId: string) => {
    return userFavorites?.some(fav => fav.property_id === propertyId) || false;
  };

  // Format price with currency
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price);
  };

  // Handle page navigation
  const handlePageChange = (page: number) => {
    updateURL({}, page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Search Interface Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  {searchFilters.destination ? `Properties in ${searchFilters.destination}` : 'Search Results'}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {totalResults} properties found
                  {searchFilters.check_in_date && searchFilters.check_out_date && (
                    <span> • {searchFilters.check_in_date} - {searchFilters.check_out_date}</span>
                  )}
                  {searchFilters.guest_count > 1 && (
                    <span> • {searchFilters.guest_count} guests</span>
                  )}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {isAuthenticated && (
                  <button
                    onClick={() => setShowSaveSearchModal(true)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    disabled={saveSearchMutation.isPending}
                  >
                    Save Search
                  </button>
                )}
                
                <Link
                  to={`/?${new URLSearchParams({
                    destination: searchFilters.destination,
                    check_in_date: searchFilters.check_in_date,
                    check_out_date: searchFilters.check_out_date,
                    guest_count: searchFilters.guest_count.toString(),
                  }).toString()}`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Modify Search
                </Link>
              </div>
            </div>
            
            {/* Applied Filters */}
            {(searchFilters.property_type || searchFilters.amenities.length > 0 || searchFilters.price_min > 0 || searchFilters.instant_booking) && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-sm text-gray-600">Filters:</span>
                
                {searchFilters.property_type && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {searchFilters.property_type}
                    <button
                      onClick={() => updateURL({ property_type: '' })}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                
                {searchFilters.amenities.map(amenity => (
                  <span key={amenity} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {amenity}
                    <button
                      onClick={() => updateURL({ amenities: searchFilters.amenities.filter(a => a !== amenity) })}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                
                {searchFilters.price_min > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Min ${searchFilters.price_min}
                    <button
                      onClick={() => updateURL({ price_min: 0 })}
                      className="ml-1 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                
                {searchFilters.instant_booking && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Instant Book
                    <button
                      onClick={() => updateURL({ instant_booking: false })}
                      className="ml-1 text-orange-600 hover:text-orange-800"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filter Sidebar */}
            <div className="lg:w-80 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                
                {/* Property Type Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Property Type</h3>
                  <div className="space-y-2">
                    {propertyTypes.map(type => (
                      <label key={type} className="flex items-center">
                        <input
                          type="radio"
                          name="property_type"
                          value={type}
                          checked={searchFilters.property_type === type}
                          onChange={(e) => updateURL({ property_type: e.target.value })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">{type}</span>
                      </label>
                    ))}
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="property_type"
                        value=""
                        checked={searchFilters.property_type === ''}
                        onChange={(e) => updateURL({ property_type: e.target.value })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">All Types</span>
                    </label>
                  </div>
                </div>

                {/* Price Range Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Price Range (per night)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Min Price</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={searchFilters.price_min || ''}
                        onChange={(e) => updateURL({ price_min: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Max Price</label>
                      <input
                        type="number"
                        placeholder="Any"
                        value={searchFilters.price_max || ''}
                        onChange={(e) => updateURL({ price_max: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Amenities Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Amenities</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableAmenities.map(amenity => (
                      <label key={amenity} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={searchFilters.amenities.includes(amenity)}
                          onChange={(e) => {
                            const newAmenities = e.target.checked
                              ? [...searchFilters.amenities, amenity]
                              : searchFilters.amenities.filter(a => a !== amenity);
                            updateURL({ amenities: newAmenities });
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">{amenity.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Instant Booking Filter */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={searchFilters.instant_booking}
                      onChange={(e) => updateURL({ instant_booking: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">Instant Book Only</span>
                  </label>
                </div>

                {/* Distance Filters */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Distance</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Max distance from beach (km)</label>
                      <input
                        type="number"
                        placeholder="Any"
                        value={searchFilters.distance_beach || ''}
                        onChange={(e) => updateURL({ distance_beach: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Max distance from airport (km)</label>
                      <input
                        type="number"
                        placeholder="Any"
                        value={searchFilters.distance_airport || ''}
                        onChange={(e) => updateURL({ distance_airport: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Saved Searches */}
              {isAuthenticated && savedSearches && savedSearches.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Searches</h3>
                  <div className="space-y-2">
                    {savedSearches.slice(0, 3).map(search => (
                      <button
                        key={search.search_id}
                        onClick={() => {
                          navigate(`/search?destination=${encodeURIComponent(search.destination)}`);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                      >
                        {search.search_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {/* Results Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                  {/* View Toggle */}
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Grid
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setViewMode('map')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Map
                    </button>
                  </div>
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">Sort by:</label>
                  <select
                    value={`${searchFilters.sort_by}_${searchFilters.sort_order}`}
                    onChange={(e) => {
                      const [sort_by, sort_order] = e.target.value.split('_');
                      updateURL({ sort_by, sort_order });
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="created_at_desc">Newest First</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating_desc">Highest Rated</option>
                    <option value="distance_beach_asc">Closest to Beach</option>
                  </select>
                </div>
              </div>

              {/* Loading State */}
              {isSearching && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Searching properties...</span>
                </div>
              )}

              {/* Error State */}
              {searchError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
                  <p className="text-sm">Error loading properties. Please try again.</p>
                </div>
              )}

              {/* No Results */}
              {!isSearching && !searchError && results.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🏠</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
                  <p className="text-gray-600 mb-4">Try adjusting your search criteria or filters</p>
                  <Link
                    to="/"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Start New Search
                  </Link>
                </div>
              )}

              {/* Results Grid/List */}
              {!isSearching && results.length > 0 && (
                <>
                  {viewMode === 'grid' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {results.map(property => (
                        <div key={property.property_id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border">
                          <div className="relative">
                            <Link to={`/property/${property.property_id}${searchFilters.check_in_date ? `?check_in_date=${searchFilters.check_in_date}&check_out_date=${searchFilters.check_out_date}&guest_count=${searchFilters.guest_count}` : ''}`}>
                              <img
                                src={property.cover_photo_url || property.photos.find(p => p.is_cover_photo)?.photo_url || '/api/placeholder/400/250'}
                                alt={property.title}
                                className="w-full h-48 object-cover rounded-t-lg"
                              />
                            </Link>
                            
                            <button
                              onClick={() => handleToggleFavorite(property.property_id)}
                              className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow"
                              disabled={toggleFavoriteMutation.isPending}
                            >
                              <svg
                                className={`w-5 h-5 transition-colors ${
                                  isPropertyFavorited(property.property_id) ? 'text-red-500 fill-current' : 'text-gray-400'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                />
                              </svg>
                            </button>

                            {property.instant_booking && (
                              <div className="absolute top-3 left-3 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-md">
                                Instant Book
                              </div>
                            )}
                          </div>

                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <Link
                                to={`/property/${property.property_id}${searchFilters.check_in_date ? `?check_in_date=${searchFilters.check_in_date}&check_out_date=${searchFilters.check_out_date}&guest_count=${searchFilters.guest_count}` : ''}`}
                                className="text-gray-900 hover:text-blue-600 transition-colors"
                              >
                                <h3 className="font-medium text-sm line-clamp-2">{property.title}</h3>
                              </Link>
                              
                              {property.is_superhost && (
                                <span className="flex-shrink-0 ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-md">
                                  Superhost
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-gray-600 mb-2">{property.city}, {property.country}</p>

                            {property.average_rating > 0 && (
                              <div className="flex items-center mb-2">
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                  </svg>
                                  <span className="ml-1 text-sm font-medium text-gray-900">{property.average_rating.toFixed(1)}</span>
                                </div>
                                <span className="ml-1 text-sm text-gray-600">({property.review_count} reviews)</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="text-right">
                                <div className="text-lg font-semibold text-gray-900">
                                  {formatPrice(property.base_price_per_night, property.currency)}
                                </div>
                                <div className="text-sm text-gray-600">per night</div>
                              </div>
                            </div>

                            {/* Key amenities */}
                            {property.amenities.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {property.amenities.slice(0, 3).map(amenity => (
                                  <span key={amenity} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md capitalize">
                                    {amenity.replace('_', ' ')}
                                  </span>
                                ))}
                                {property.amenities.length > 3 && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                                    +{property.amenities.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewMode === 'list' && (
                    <div className="space-y-4">
                      {results.map(property => (
                        <div key={property.property_id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border">
                          <div className="flex flex-col sm:flex-row">
                            <div className="relative flex-shrink-0 sm:w-64">
                              <Link to={`/property/${property.property_id}${searchFilters.check_in_date ? `?check_in_date=${searchFilters.check_in_date}&check_out_date=${searchFilters.check_out_date}&guest_count=${searchFilters.guest_count}` : ''}`}>
                                <img
                                  src={property.cover_photo_url || property.photos.find(p => p.is_cover_photo)?.photo_url || '/api/placeholder/400/200'}
                                  alt={property.title}
                                  className="w-full h-48 sm:h-full object-cover rounded-t-lg sm:rounded-l-lg sm:rounded-t-none"
                                />
                              </Link>
                              
                              <button
                                onClick={() => handleToggleFavorite(property.property_id)}
                                className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow"
                                disabled={toggleFavoriteMutation.isPending}
                              >
                                <svg
                                  className={`w-5 h-5 transition-colors ${
                                    isPropertyFavorited(property.property_id) ? 'text-red-500 fill-current' : 'text-gray-400'
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                  />
                                </svg>
                              </button>
                            </div>

                            <div className="flex-1 p-6">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-2">
                                    <Link
                                      to={`/property/${property.property_id}${searchFilters.check_in_date ? `?check_in_date=${searchFilters.check_in_date}&check_out_date=${searchFilters.check_out_date}&guest_count=${searchFilters.guest_count}` : ''}`}
                                      className="text-gray-900 hover:text-blue-600 transition-colors"
                                    >
                                      <h3 className="text-lg font-medium">{property.title}</h3>
                                    </Link>
                                    
                                    <div className="flex items-center gap-2 ml-4">
                                      {property.instant_booking && (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-md">
                                          Instant Book
                                        </span>
                                      )}
                                      {property.is_superhost && (
                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-md">
                                          Superhost
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <p className="text-gray-600 mb-2">{property.city}, {property.country}</p>

                                  {property.average_rating > 0 && (
                                    <div className="flex items-center mb-3">
                                      <div className="flex items-center">
                                        <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 24 24">
                                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                        <span className="ml-1 text-sm font-medium text-gray-900">{property.average_rating.toFixed(1)}</span>
                                      </div>
                                      <span className="ml-1 text-sm text-gray-600">({property.review_count} reviews)</span>
                                    </div>
                                  )}

                                  {/* Distance info */}
                                  {(property.distance_beach > 0 || property.distance_airport > 0) && (
                                    <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                                      {property.distance_beach > 0 && (
                                        <span>🏖️ {property.distance_beach}km to beach</span>
                                      )}
                                      {property.distance_airport > 0 && (
                                        <span>✈️ {property.distance_airport}km to airport</span>
                                      )}
                                    </div>
                                  )}

                                  {/* Amenities */}
                                  {property.amenities.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                      {property.amenities.slice(0, 6).map(amenity => (
                                        <span key={amenity} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md capitalize">
                                          {amenity.replace('_', ' ')}
                                        </span>
                                      ))}
                                      {property.amenities.length > 6 && (
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                                          +{property.amenities.length - 6} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="text-right ml-6">
                                  <div className="text-xl font-semibold text-gray-900">
                                    {formatPrice(property.base_price_per_night, property.currency)}
                                  </div>
                                  <div className="text-sm text-gray-600">per night</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewMode === 'map' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="text-center py-12">
                        <div className="text-gray-400 text-6xl mb-4">🗺️</div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Map View Coming Soon</h3>
                        <p className="text-gray-600">Interactive map with property locations will be available soon.</p>
                      </div>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center mt-8">
                      <nav className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = Math.max(1, currentPage - 2) + i;
                          if (page > totalPages) return null;
                          
                          return (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`px-3 py-2 text-sm font-medium rounded-md ${
                                page === currentPage
                                  ? 'text-blue-600 bg-blue-50 border border-blue-600'
                                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Save Search Modal */}
        {showSaveSearchModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowSaveSearchModal(false)}></div>
              </div>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Save Search</h3>
                  <div>
                    <label htmlFor="search-name" className="block text-sm font-medium text-gray-700 mb-2">
                      Search Name
                    </label>
                    <input
                      type="text"
                      id="search-name"
                      value={saveSearchName}
                      onChange={(e) => setSaveSearchName(e.target.value)}
                      placeholder={`Properties in ${searchFilters.destination || 'your destination'}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSaveSearch}
                    disabled={!saveSearchName.trim() || saveSearchMutation.isPending}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveSearchMutation.isPending ? 'Saving...' : 'Save Search'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveSearchModal(false);
                      setSaveSearchName('');
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_SearchResults;