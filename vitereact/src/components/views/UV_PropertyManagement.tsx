import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Types for API responses
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

interface PropertyPhoto {
  photo_id: string;
  property_id: string;
  photo_url: string;
  photo_order: number;
  is_cover_photo: boolean;
  alt_text?: string;
  created_at: string;
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
  created_at: string;
  updated_at: string;
}

interface CreatePropertyPayload {
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
  currency?: string;
  cleaning_fee?: number;
  security_deposit?: number;
  extra_guest_fee?: number;
  pet_fee?: number;
  amenities?: string[];
  house_rules?: string[];
  check_in_time?: string;
  check_out_time?: string;
  minimum_stay?: number;
  maximum_stay?: number;
  instant_booking?: boolean;
  host_language?: string[];
  cancellation_policy?: 'flexible' | 'moderate' | 'strict';
  is_active?: boolean;
}

interface UpdatePropertyPayload {
  property_id: string;
  title?: string;
  description?: string;
  property_type?: string;
  region?: string;
  neighborhood?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  guest_count?: number;
  property_size?: number;
  distance_beach?: number;
  distance_airport?: number;
  base_price_per_night?: number;
  cleaning_fee?: number;
  security_deposit?: number;
  extra_guest_fee?: number;
  pet_fee?: number;
  amenities?: string[];
  house_rules?: string[];
  check_in_time?: string;
  check_out_time?: string;
  minimum_stay?: number;
  maximum_stay?: number;
  instant_booking?: boolean;
  host_language?: string[];
  cancellation_policy?: 'flexible' | 'moderate' | 'strict';
  is_active?: boolean;
}

const UV_PropertyManagement: React.FC = () => {
  const { property_id: slugPropertyId } = useParams<{ property_id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Get URL parameters
  const urlPropertyId = searchParams.get('property_id');
  const section = searchParams.get('section') || 'overview';
  const selectedPropertyId = slugPropertyId || urlPropertyId;

  // Zustand store selectors (individual selectors to prevent infinite loops)
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const ownedProperties = useAppStore(state => state.property_management_state.owned_properties);
  const propertyManagementLoading = useAppStore(state => state.property_management_state.is_loading);
  const setOwnedProperties = useAppStore(state => state.set_owned_properties);
  const addOwnedProperty = useAppStore(state => state.add_owned_property);
  const updateOwnedProperty = useAppStore(state => state.update_owned_property);


  // Local state for forms
  const [createMode, setCreateMode] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [propertyFormData, setPropertyFormData] = useState<Partial<CreatePropertyPayload>>({
    owner_id: currentUser?.user_id || '',
    currency: 'USD',
    check_in_time: '15:00',
    check_out_time: '11:00',
    minimum_stay: 1,
    instant_booking: false,
    amenities: [],
    house_rules: [],
    host_language: [],
    cancellation_policy: 'moderate'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // API function to fetch user properties
  const fetchUserProperties = async (): Promise<{ properties: Property[] }> => {
    if (!currentUser?.user_id || !authToken) {
      throw new Error('User not authenticated');
    }

    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties`,
      {
        params: { owner_id: currentUser.user_id },
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    return response.data;
  };

  // API function to fetch property bookings
  const fetchPropertyBookings = async (propertyId: string): Promise<{ bookings: Booking[] }> => {
    if (!authToken) {
      throw new Error('User not authenticated');
    }

    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings`,
      {
        params: { property_id: propertyId },
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    return response.data;
  };

  // API function to fetch property photos
  const fetchPropertyPhotos = async (propertyId: string): Promise<PropertyPhoto[]> => {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties/${propertyId}/api/photos`
    );
    return response.data;
  };

  // React Query: Fetch user properties
  const { data: propertiesData, isLoading: propertiesLoading, error: propertiesError } = useQuery({
    queryKey: ['userProperties', currentUser?.user_id],
    queryFn: fetchUserProperties,
    enabled: !!currentUser?.user_id && !!authToken,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // React Query: Fetch property bookings
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['propertyBookings', selectedPropertyId],
    queryFn: () => fetchPropertyBookings(selectedPropertyId!),
    enabled: !!selectedPropertyId && !!authToken,
    staleTime: 2 * 60 * 1000,
    retry: 1
  });

  // React Query: Fetch property photos
  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: ['propertyPhotos', selectedPropertyId],
    queryFn: () => fetchPropertyPhotos(selectedPropertyId!),
    enabled: !!selectedPropertyId,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Mutation: Create property
  const createPropertyMutation = useMutation({
    mutationFn: async (propertyData: CreatePropertyPayload): Promise<Property> => {
      if (!authToken) {
        throw new Error('User not authenticated');
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties`,
        propertyData,
        {
          headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: (newProperty) => {
      addOwnedProperty(newProperty);
      queryClient.invalidateQueries({ queryKey: ['userProperties'] });
      setCreateMode(false);
      setWizardStep(1);
      setPropertyFormData({
        owner_id: currentUser?.user_id || '',
        currency: 'USD',
        check_in_time: '15:00',
        check_out_time: '11:00',
        minimum_stay: 1,
        instant_booking: false,
        amenities: [],
        house_rules: [],
        host_language: [],
        cancellation_policy: 'moderate'
      });
    },
    onError: (error: any) => {
      console.error('Create property error:', error);
      setFormErrors({ general: error.response?.data?.message || 'Failed to create property' });
    }
  });

  // Mutation: Update property
  const updatePropertyMutation = useMutation({
    mutationFn: async (propertyData: UpdatePropertyPayload): Promise<Property> => {
      if (!authToken) {
        throw new Error('User not authenticated');
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties/${propertyData.property_id}`,
        propertyData,
        {
          headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: (updatedProperty) => {
      updateOwnedProperty(updatedProperty.property_id, updatedProperty);
      queryClient.invalidateQueries({ queryKey: ['userProperties'] });
    },
    onError: (error: any) => {
      console.error('Update property error:', error);
      setFormErrors({ general: error.response?.data?.message || 'Failed to update property' });
    }
  });

  // Update store when properties data changes
  useEffect(() => {
    if (propertiesData?.properties) {
      setOwnedProperties(propertiesData.properties);
    }
  }, [propertiesData, setOwnedProperties]);

  // Get current property
  const currentProperty = selectedPropertyId 
    ? ownedProperties.find(p => p.property_id === selectedPropertyId)
    : null;

  // Initialize form data when editing existing property
  useEffect(() => {
    if (currentProperty && !createMode) {
      setPropertyFormData({
        owner_id: currentProperty.owner_id,
        title: currentProperty.title,
        description: currentProperty.description,
        property_type: currentProperty.property_type,
        country: currentProperty.country,
        city: currentProperty.city,
        region: currentProperty.region,
        neighborhood: currentProperty.neighborhood,
        address: currentProperty.address,
        latitude: currentProperty.latitude,
        longitude: currentProperty.longitude,
        bedrooms: currentProperty.bedrooms,
        bathrooms: currentProperty.bathrooms,
        guest_count: currentProperty.guest_count,
        property_size: currentProperty.property_size,
        distance_beach: currentProperty.distance_beach,
        distance_airport: currentProperty.distance_airport,
        base_price_per_night: currentProperty.base_price_per_night,
        currency: currentProperty.currency,
        cleaning_fee: currentProperty.cleaning_fee,
        security_deposit: currentProperty.security_deposit,
        extra_guest_fee: currentProperty.extra_guest_fee,
        pet_fee: currentProperty.pet_fee,
        amenities: currentProperty.amenities,
        house_rules: currentProperty.house_rules,
        check_in_time: currentProperty.check_in_time,
        check_out_time: currentProperty.check_out_time,
        minimum_stay: currentProperty.minimum_stay,
        maximum_stay: currentProperty.maximum_stay,
        instant_booking: currentProperty.instant_booking,
        host_language: currentProperty.host_language,
        cancellation_policy: currentProperty.cancellation_policy
      });
    }
  }, [currentProperty, createMode]);

  // Form validation
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!propertyFormData.title?.trim()) errors.title = 'Property title is required';
      if (!propertyFormData.description?.trim()) errors.description = 'Property description is required';
      if (!propertyFormData.property_type?.trim()) errors.property_type = 'Property type is required';
      if (!propertyFormData.country?.trim()) errors.country = 'Country is required';
      if (!propertyFormData.city?.trim()) errors.city = 'City is required';
      if (!propertyFormData.address?.trim()) errors.address = 'Address is required';
      if (!propertyFormData.bedrooms || propertyFormData.bedrooms < 0) errors.bedrooms = 'Valid bedroom count is required';
      if (!propertyFormData.bathrooms || propertyFormData.bathrooms < 0) errors.bathrooms = 'Valid bathroom count is required';
      if (!propertyFormData.guest_count || propertyFormData.guest_count < 1) errors.guest_count = 'Guest count must be at least 1';
    }

    if (step === 4) {
      if (!propertyFormData.base_price_per_night || propertyFormData.base_price_per_night <= 0) {
        errors.base_price_per_night = 'Base price per night is required';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(wizardStep)) return;

    if (wizardStep < 6) {
      setWizardStep(wizardStep + 1);
      return;
    }

    // Final submission
    if (createMode) {
      if (!propertyFormData.latitude) propertyFormData.latitude = 0;
      if (!propertyFormData.longitude) propertyFormData.longitude = 0;
      
      createPropertyMutation.mutate(propertyFormData as CreatePropertyPayload);
    } else if (selectedPropertyId) {
      updatePropertyMutation.mutate({
        property_id: selectedPropertyId,
        ...propertyFormData
      } as UpdatePropertyPayload);
    }
  };

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setPropertyFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle amenity toggle
  const toggleAmenity = (amenity: string) => {
    const currentAmenities = propertyFormData.amenities || [];
    const updatedAmenities = currentAmenities.includes(amenity)
      ? currentAmenities.filter(a => a !== amenity)
      : [...currentAmenities, amenity];
    
    handleInputChange('amenities', updatedAmenities);
  };

  // Common amenities list
  const commonAmenities = [
    'WiFi', 'Air conditioning', 'Kitchen', 'Pool', 'Parking', 'Hot tub',
    'Gym', 'Balcony', 'Garden', 'Beach access', 'TV', 'Washer',
    'Dryer', 'Dishwasher', 'Microwave', 'Coffee maker', 'Hair dryer',
    'Iron', 'Safe', 'First aid kit', 'Fire extinguisher', 'Smoke alarm'
  ];

  // Navigation helper
  const navigateToSection = (newSection: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('section', newSection);
    setSearchParams(params);
  };

  const isLoading = propertiesLoading || propertyManagementLoading;

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 text-sm font-medium mr-4">
                  ← Back to Dashboard
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
              </div>
              {!createMode && !selectedPropertyId && (
                <button
                  onClick={() => setCreateMode(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Add New Property
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading properties...</span>
            </div>
          )}

          {/* Error State */}
          {propertiesError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              <p>Failed to load properties: {(propertiesError as any)?.message || 'Unknown error'}</p>
            </div>
          )}

          {/* Create Property Mode */}
          {createMode && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Create New Property</h2>
                  <button
                    onClick={() => {
                      setCreateMode(false);
                      setWizardStep(1);
                      setFormErrors({});
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>

                {/* Progress indicator */}
                <div className="mt-4">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5, 6].map((step, index) => (
                      <React.Fragment key={step}>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                          step <= wizardStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {step}
                        </div>
                        {index < 5 && (
                          <div className={`flex-1 h-1 mx-2 ${
                            step < wizardStep ? 'bg-blue-600' : 'bg-gray-200'
                          }`}/>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>Basics</span>
                    <span>Photos</span>
                    <span>Amenities</span>
                    <span>Pricing</span>
                    <span>Availability</span>
                    <span>Rules</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6">
                {formErrors.general && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
                    <p>{formErrors.general}</p>
                  </div>
                )}

                {/* Step 1: Property Basics */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Property Basics</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Property Title *
                        </label>
                        <input
                          type="text"
                          value={propertyFormData.title || ''}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.title ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="e.g., Luxury Beachfront Villa in Santorini"
                        />
                        {formErrors.title && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Property Type *
                        </label>
                        <select
                          value={propertyFormData.property_type || ''}
                          onChange={(e) => handleInputChange('property_type', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.property_type ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select property type</option>
                          <option value="villa">Villa</option>
                          <option value="apartment">Apartment</option>
                          <option value="house">House</option>
                          <option value="condo">Condo</option>
                          <option value="resort">Resort</option>
                        </select>
                        {formErrors.property_type && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.property_type}</p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description *
                        </label>
                        <textarea
                          value={propertyFormData.description || ''}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          rows={4}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.description ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Describe your property in detail..."
                        />
                        {formErrors.description && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Country *
                        </label>
                        <input
                          type="text"
                          value={propertyFormData.country || ''}
                          onChange={(e) => handleInputChange('country', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.country ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="e.g., Greece"
                        />
                        {formErrors.country && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.country}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          value={propertyFormData.city || ''}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.city ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="e.g., Santorini"
                        />
                        {formErrors.city && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.city}</p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address *
                        </label>
                        <input
                          type="text"
                          value={propertyFormData.address || ''}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.address ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Full address"
                        />
                        {formErrors.address && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.address}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bedrooms *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={propertyFormData.bedrooms || ''}
                          onChange={(e) => handleInputChange('bedrooms', parseInt(e.target.value) || 0)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.bedrooms ? 'border-red-500' : 'border-gray-300'
                          }`}/>
                        {formErrors.bedrooms && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.bedrooms}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bathrooms *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={propertyFormData.bathrooms || ''}
                          onChange={(e) => handleInputChange('bathrooms', parseFloat(e.target.value) || 0)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.bathrooms ? 'border-red-500' : 'border-gray-300'
                          }`}/>
                        {formErrors.bathrooms && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.bathrooms}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Maximum Guests *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={propertyFormData.guest_count || ''}
                          onChange={(e) => handleInputChange('guest_count', parseInt(e.target.value) || 1)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formErrors.guest_count ? 'border-red-500' : 'border-gray-300'
                          }`}/>
                        {formErrors.guest_count && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.guest_count}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Property Size (sq m)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={propertyFormData.property_size || ''}
                          onChange={(e) => handleInputChange('property_size', parseFloat(e.target.value) || undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Photos */}
                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Property Photos</h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <p className="text-gray-600 mb-2">Photo upload will be implemented after property creation</p>
                      <p className="text-sm text-gray-500">You can add photos later in the property management section</p>
                    </div>
                  </div>
                )}

                {/* Step 3: Amenities */}
                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Property Amenities</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {commonAmenities.map((amenity) => (
                        <div key={amenity} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`amenity-${amenity}`}
                            checked={propertyFormData.amenities?.includes(amenity) || false}
                            onChange={() => toggleAmenity(amenity)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor={`amenity-${amenity}`}
                            className="ml-2 text-sm text-gray-700 cursor-pointer"
                          >
                            {amenity}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 4: Pricing */}
                {wizardStep === 4 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Pricing Strategy</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Base Price per Night *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="1"
                            value={propertyFormData.base_price_per_night || ''}
                            onChange={(e) => handleInputChange('base_price_per_night', parseFloat(e.target.value) || 0)}
                            className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              formErrors.base_price_per_night ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="100"
                          />
                        </div>
                        {formErrors.base_price_per_night && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.base_price_per_night}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cleaning Fee
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="0"
                            value={propertyFormData.cleaning_fee || ''}
                            onChange={(e) => handleInputChange('cleaning_fee', parseFloat(e.target.value) || undefined)}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Security Deposit
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="0"
                            value={propertyFormData.security_deposit || ''}
                            onChange={(e) => handleInputChange('security_deposit', parseFloat(e.target.value) || undefined)}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="200"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Extra Guest Fee (per night)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="0"
                            value={propertyFormData.extra_guest_fee || ''}
                            onChange={(e) => handleInputChange('extra_guest_fee', parseFloat(e.target.value) || undefined)}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="25"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Availability */}
                {wizardStep === 5 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Availability Settings</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Minimum Stay (nights)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={propertyFormData.minimum_stay || 1}
                          onChange={(e) => handleInputChange('minimum_stay', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Maximum Stay (nights)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={propertyFormData.maximum_stay || ''}
                          onChange={(e) => handleInputChange('maximum_stay', parseInt(e.target.value) || undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Check-in Time
                        </label>
                        <input
                          type="time"
                          value={propertyFormData.check_in_time || '15:00'}
                          onChange={(e) => handleInputChange('check_in_time', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Check-out Time
                        </label>
                        <input
                          type="time"
                          value={propertyFormData.check_out_time || '11:00'}
                          onChange={(e) => handleInputChange('check_out_time', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="instant-booking"
                        checked={propertyFormData.instant_booking || false}
                        onChange={(e) => handleInputChange('instant_booking', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="instant-booking" className="ml-2 text-sm text-gray-700">
                        Enable instant booking (guests can book without approval)
                      </label>
                    </div>
                  </div>
                )}

                {/* Step 6: Rules & Policies */}
                {wizardStep === 6 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">House Rules & Policies</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cancellation Policy
                      </label>
                      <select
                        value={propertyFormData.cancellation_policy || 'moderate'}
                        onChange={(e) => handleInputChange('cancellation_policy', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="flexible">Flexible - Full refund 1 day before arrival</option>
                        <option value="moderate">Moderate - Full refund 5 days before arrival</option>
                        <option value="strict">Strict - 50% refund up to 1 week before arrival</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        House Rules (optional)
                      </label>
                      <textarea
                        value={propertyFormData.house_rules?.join('\n') || ''}
                        onChange={(e) => handleInputChange('house_rules', e.target.value.split('\n').filter(rule => rule.trim()))}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter each rule on a new line..."
                      />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">Review your property details</h4>
                      <div className="text-sm text-blue-700 space-y-1">
                        <p><strong>Title:</strong> {propertyFormData.title}</p>
                        <p><strong>Type:</strong> {propertyFormData.property_type}</p>
                        <p><strong>Location:</strong> {propertyFormData.city}, {propertyFormData.country}</p>
                        <p><strong>Capacity:</strong> {propertyFormData.guest_count} guests, {propertyFormData.bedrooms} bedrooms, {propertyFormData.bathrooms} bathrooms</p>
                        <p><strong>Price:</strong> ${propertyFormData.base_price_per_night}/api/night</p>
                        <p><strong>Amenities:</strong> {propertyFormData.amenities?.length || 0} selected</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="flex justify-between pt-6">
                  <button
                    type="button"
                    onClick={() => wizardStep > 1 ? setWizardStep(wizardStep - 1) : setCreateMode(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    {wizardStep > 1 ? 'Previous' : 'Cancel'}
                  </button>
                  
                  <button
                    type="submit"
                    disabled={createPropertyMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createPropertyMutation.isPending ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </span>
                    ) : wizardStep < 6 ? 'Next' : 'Create Property'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Property Management Mode */}
          {!createMode && selectedPropertyId && currentProperty && (
            <div className="space-y-6">
              {/* Property header */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{currentProperty.title}</h2>
                    <p className="text-gray-600">{currentProperty.city}, {currentProperty.country}</p>
                    <div className="flex items-center mt-2 space-x-4">
                      <span className="text-sm text-gray-500">{currentProperty.bedrooms} bed • {currentProperty.bathrooms} bath • {currentProperty.guest_count} guests</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        currentProperty.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {currentProperty.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {currentProperty.is_verified && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">${currentProperty.base_price_per_night}</p>
                    <p className="text-sm text-gray-500">per night</p>
                    {currentProperty.average_rating && (
                      <div className="flex items-center mt-2">
                        <span className="text-yellow-400">★</span>
                        <span className="ml-1 text-sm font-medium">{currentProperty.average_rating.toFixed(1)}</span>
                        <span className="ml-1 text-sm text-gray-500">({currentProperty.review_count} reviews)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Management navigation */}
              <div className="bg-white rounded-lg shadow">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                  {[
                    { id: 'overview', name: 'Overview' },
                    { id: 'calendar', name: 'Calendar' },
                    { id: 'pricing', name: 'Pricing' },
                    { id: 'photos', name: 'Photos' },
                    { id: 'analytics', name: 'Analytics' },
                    { id: 'settings', name: 'Settings' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => navigateToSection(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        section === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Section content */}
              <div className="bg-white rounded-lg shadow p-6">
                {section === 'overview' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Property Overview</h3>
                    
                    {/* Quick stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-900">Total Bookings</h4>
                        <p className="text-2xl font-bold text-blue-600">{bookingsData?.bookings?.length || 0}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-green-900">Avg Rating</h4>
                        <p className="text-2xl font-bold text-green-600">
                          {currentProperty.average_rating ? currentProperty.average_rating.toFixed(1) : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-yellow-900">Reviews</h4>
                        <p className="text-2xl font-bold text-yellow-600">{currentProperty.review_count}</p>
                      </div>
                    </div>

                    {/* Recent bookings */}
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-4">Recent Bookings</h4>
                      {bookingsLoading ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                      ) : bookingsData?.bookings?.length ? (
                        <div className="space-y-3">
                          {bookingsData.bookings.slice(0, 5).map((booking) => (
                            <div key={booking.booking_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium">{booking.check_in_date} - {booking.check_out_date}</p>
                                <p className="text-sm text-gray-600">{booking.guest_count} guests • {booking.nights} nights</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">${booking.total_price}</p>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  booking.booking_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                  booking.booking_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {booking.booking_status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No bookings yet</p>
                      )}
                    </div>
                  </div>
                )}

                {section === 'calendar' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Availability Calendar</h3>
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <p className="text-gray-600">Calendar management will be implemented with a date picker component</p>
                      <p className="text-sm text-gray-500 mt-2">This will allow you to set availability, blocked dates, and special pricing</p>
                    </div>
                  </div>
                )}

                {section === 'pricing' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Pricing Management</h3>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (selectedPropertyId) {
                        updatePropertyMutation.mutate({
                          property_id: selectedPropertyId,
                          base_price_per_night: propertyFormData.base_price_per_night,
                          cleaning_fee: propertyFormData.cleaning_fee,
                          security_deposit: propertyFormData.security_deposit,
                          extra_guest_fee: propertyFormData.extra_guest_fee
                        } as UpdatePropertyPayload);
                      }
                    }} className="space-y-4">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Base Price per Night
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              min="1"
                              value={propertyFormData.base_price_per_night || ''}
                              onChange={(e) => handleInputChange('base_price_per_night', parseFloat(e.target.value) || 0)}
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cleaning Fee
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              min="0"
                              value={propertyFormData.cleaning_fee || ''}
                              onChange={(e) => handleInputChange('cleaning_fee', parseFloat(e.target.value) || undefined)}
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Security Deposit
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              min="0"
                              value={propertyFormData.security_deposit || ''}
                              onChange={(e) => handleInputChange('security_deposit', parseFloat(e.target.value) || undefined)}
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Extra Guest Fee
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              min="0"
                              value={propertyFormData.extra_guest_fee || ''}
                              onChange={(e) => handleInputChange('extra_guest_fee', parseFloat(e.target.value) || undefined)}
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={updatePropertyMutation.isPending}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatePropertyMutation.isPending ? 'Updating...' : 'Update Pricing'}
                      </button>
                    </form>
                  </div>
                )}

                {section === 'photos' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Photo Management</h3>
                    
                    {photosLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    ) : photosData?.length ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {photosData.map((photo) => (
                          <div key={photo.photo_id} className="relative group">
                            <img
                              src={photo.photo_url}
                              alt={photo.alt_text || 'Property photo'}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            {photo.is_cover_photo && (
                              <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                                Cover
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <p className="text-gray-600">No photos uploaded yet</p>
                        <p className="text-sm text-gray-500 mt-2">Photo upload functionality will be implemented</p>
                      </div>
                    )}
                  </div>
                )}

                {section === 'analytics' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Performance Analytics</h3>
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <p className="text-gray-600">Analytics dashboard will be implemented</p>
                      <p className="text-sm text-gray-500 mt-2">This will show revenue, occupancy rates, and performance metrics</p>
                    </div>
                  </div>
                )}

                {section === 'settings' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Property Settings</h3>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (selectedPropertyId) {
                        updatePropertyMutation.mutate({
                          property_id: selectedPropertyId,
                          title: propertyFormData.title,
                          description: propertyFormData.description,
                          is_active: propertyFormData.is_active
                        } as UpdatePropertyPayload);
                      }
                    }} className="space-y-4">
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Property Title
                        </label>
                        <input
                          type="text"
                          value={propertyFormData.title || ''}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={propertyFormData.description || ''}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="is-active"
                          checked={propertyFormData.is_active !== false}
                          onChange={(e) => handleInputChange('is_active', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="is-active" className="ml-2 text-sm text-gray-700">
                          Property is active and available for booking
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={updatePropertyMutation.isPending}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatePropertyMutation.isPending ? 'Updating...' : 'Update Settings'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Properties Overview Mode */}
          {!createMode && !selectedPropertyId && !isLoading && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Your Properties</h2>
                <button
                  onClick={() => setCreateMode(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Add New Property
                </button>
              </div>

              {ownedProperties.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No properties yet</h3>
                  <p className="text-gray-600 mb-4">Start earning by listing your first property</p>
                  <button
                    onClick={() => setCreateMode(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    List Your Property
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ownedProperties.map((property) => (
                    <div key={property.property_id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-lg font-medium text-gray-900 truncate">{property.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            property.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {property.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-2">{property.city}, {property.country}</p>
                        <p className="text-sm text-gray-500 mb-3">{property.bedrooms} bed • {property.bathrooms} bath • {property.guest_count} guests</p>
                        
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <p className="text-xl font-bold text-gray-900">${property.base_price_per_night}</p>
                            <p className="text-sm text-gray-500">per night</p>
                          </div>
                          {property.average_rating && (
                            <div className="flex items-center">
                              <span className="text-yellow-400">★</span>
                              <span className="ml-1 text-sm font-medium">{property.average_rating.toFixed(1)}</span>
                              <span className="ml-1 text-sm text-gray-500">({property.review_count})</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex space-x-3">
                          <Link
                            to={`/host/property/${property.property_id}`}
                            className="flex-1 bg-blue-600 text-white text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            Manage
                          </Link>
                          <Link
                            to={`/property/${property.property_id}`}
                            className="flex-1 bg-gray-100 text-gray-700 text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                          >
                            View Listing
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_PropertyManagement;