import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Types for API responses and form data
interface ProfileFormData {
  first_name: string;
  last_name: string;
  phone_number: string;
  bio: string;
  languages_spoken: string[];
  currency: string;
  language: string;
  temperature_unit: 'celsius' | 'fahrenheit';
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address: string;
  date_of_birth: string;
  government_id_number: string;
}



interface SavedSearch {
  search_id: string;
  search_name: string;
  destination?: string;
  check_in_date?: string;
  check_out_date?: string;
  guest_count?: number;
  property_type?: string;
  price_min?: number;
  price_max?: number;
  created_at: string;
}

const UV_UserProfile: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Zustand selectors - CRITICAL: Individual selectors to avoid infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  const updateUserProfile = useAppStore(state => state.update_user_profile);
  const updateCurrency = useAppStore(state => state.update_currency);
  const updateLanguage = useAppStore(state => state.update_language);
  const updateTemperatureUnit = useAppStore(state => state.update_temperature_unit);
  const updateNotificationSettings = useAppStore(state => state.update_notification_settings);

  // Local state
  const [activeSection, setActiveSection] = useState(searchParams.get('section') || 'personal');
  const [profileFormData, setProfileFormData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    phone_number: '',
    bio: '',
    languages_spoken: [],
    currency: 'USD',
    language: 'en',
    temperature_unit: 'celsius',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address: '',
    date_of_birth: '',
    government_id_number: ''
  });
  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    sms: false,
    push: true,
    marketing: false
  });
  const [privacySettings, setPrivacySettings] = useState({
    profile_visibility: 'public',
    data_sharing: false,
    marketing_emails: false,
    search_indexing: true
  });
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update URL when section changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (activeSection !== 'personal') {
      newSearchParams.set('section', activeSection);
    } else {
      newSearchParams.delete('section');
    }
    setSearchParams(newSearchParams, { replace: true });
  }, [activeSection, setSearchParams, searchParams]);

  // Fetch user profile data
  const { data: userProfileData, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/me`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    enabled: !!authToken,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Fetch saved searches
  const { data: savedSearches, isLoading: savedSearchesLoading } = useQuery({
    queryKey: ['savedSearches', currentUser?.user_id],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/saved-searches`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: {
            user_id: currentUser?.user_id,
            is_active: true
          }
        }
      );
      return response.data.saved_searches || [];
    },
    enabled: !!authToken && !!currentUser?.user_id && activeSection === 'preferences',
    staleTime: 5 * 60 * 1000
  });

  // Initialize form data when user profile loads
  useEffect(() => {
    if (userProfileData) {
      setProfileFormData({
        first_name: userProfileData.first_name || '',
        last_name: userProfileData.last_name || '',
        phone_number: userProfileData.phone_number || '',
        bio: userProfileData.bio || '',
        languages_spoken: userProfileData.languages_spoken || [],
        currency: userProfileData.currency || 'USD',
        language: userProfileData.language || 'en',
        temperature_unit: userProfileData.temperature_unit || 'celsius',
        emergency_contact_name: userProfileData.emergency_contact_name || '',
        emergency_contact_phone: userProfileData.emergency_contact_phone || '',
        address: userProfileData.address || '',
        date_of_birth: userProfileData.date_of_birth || '',
        government_id_number: userProfileData.government_id_number || ''
      });
      setSelectedLanguages(userProfileData.languages_spoken || []);
      setNotificationPreferences({
        email: userProfileData.notification_settings?.email || true,
        sms: userProfileData.notification_settings?.sms || false,
        push: userProfileData.notification_settings?.push || true,
        marketing: userProfileData.notification_settings?.marketing || false
      });
    }
  }, [userProfileData]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: Partial<ProfileFormData>) => {
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser?.user_id}`,
        {
          ...updatedData,
          languages_spoken: selectedLanguages,
          notification_settings: notificationPreferences
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      updateUserProfile(data);
      // Update global preferences
      updateCurrency(data.currency);
      updateLanguage(data.language);
      updateTemperatureUnit(data.temperature_unit);
      updateNotificationSettings(notificationPreferences);
      setErrors({});
    },
    onError: (error: any) => {
      setErrors({ general: error.response?.data?.message || 'Failed to update profile' });
    }
  });

  // Submit verification mutation
  const submitVerificationMutation = useMutation({
    mutationFn: async ({ verificationType, documentUrl }: { verificationType: string; documentUrl: string }) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser?.user_id}/api/verification`,
        {
          verification_type: verificationType,
          document_url: documentUrl
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setErrors({});
    },
    onError: (error: any) => {
      setErrors({ verification: error.response?.data?.message || 'Failed to submit verification' });
    }
  });

  // Delete saved search mutation
  const deleteSavedSearchMutation = useMutation({
    mutationFn: async (searchId: string) => {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/saved-searches/${searchId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches', currentUser?.user_id] });
    },
    onError: (error: any) => {
      setErrors({ search: error.response?.data?.message || 'Failed to delete saved search' });
    }
  });

  // Event handlers
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    updateProfileMutation.mutate(profileFormData);
  };

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setProfileFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLanguageToggle = (language: string) => {
    setSelectedLanguages(prev => 
      prev.includes(language) 
        ? prev.filter(lang => lang !== language)
        : [...prev, language]
    );
  };

  const handleVerificationSubmit = (verificationType: string) => {
    // File upload handling for verification documents
    const documentUrl = `https://example.com/documents/${Date.now()}.pdf`;
    submitVerificationMutation.mutate({ verificationType, documentUrl });
  };

  const handleNotificationChange = (setting: string, value: boolean) => {
    setNotificationPreferences(prev => ({ ...prev, [setting]: value }));
  };

  const handleDeleteSavedSearch = (searchId: string) => {
    deleteSavedSearchMutation.mutate(searchId);
  };

  if (profileLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your profile...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
                <p className="mt-2 text-gray-600">Manage your account information and preferences</p>
              </div>
              <Link
                to="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-3">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveSection('personal')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'personal'
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Personal Information
                </button>
                <button
                  onClick={() => setActiveSection('preferences')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'preferences'
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Preferences
                </button>
                <button
                  onClick={() => setActiveSection('verification')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'verification'
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Verification
                  {userProfileData?.is_verified && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveSection('security')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'security'
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Security & Privacy
                </button>
              </nav>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-9 mt-8 lg:mt-0">
              {errors.general && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {errors.general}
                </div>
              )}

              {/* Personal Information Section */}
              {activeSection === 'personal' && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
                    <p className="mt-1 text-sm text-gray-600">Update your personal details and contact information</p>
                  </div>
                  
                  <form onSubmit={handleFormSubmit} className="px-6 py-6 space-y-6">
                    {/* Profile Photo */}
                    <div className="flex items-center space-x-6">
                      <div className="flex-shrink-0">
                        {userProfileData?.profile_photo_url ? (
                          <img
                            src={userProfileData.profile_photo_url}
                            alt="Profile"
                            className="h-20 w-20 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-gray-600 text-xl font-medium">
                              {profileFormData.first_name.charAt(0) || 'U'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Change Photo
                        </button>
                        <p className="mt-2 text-sm text-gray-500">JPG, GIF or PNG. 1MB max.</p>
                      </div>
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                          First Name
                        </label>
                        <input
                          type="text"
                          id="first_name"
                          value={profileFormData.first_name}
                          onChange={(e) => handleInputChange('first_name', e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        {errors.first_name && <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>}
                      </div>
                      <div>
                        <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                          Last Name
                        </label>
                        <input
                          type="text"
                          id="last_name"
                          value={profileFormData.last_name}
                          onChange={(e) => handleInputChange('last_name', e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        {errors.last_name && <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>}
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div>
                      <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone_number"
                        value={profileFormData.phone_number}
                        onChange={(e) => handleInputChange('phone_number', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Bio */}
                    <div>
                      <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                        Bio
                      </label>
                      <textarea
                        id="bio"
                        rows={4}
                        value={profileFormData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        placeholder="Tell us about yourself..."
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        maxLength={500}/>
                      <p className="mt-2 text-sm text-gray-500">{profileFormData.bio.length}/api/500 characters</p>
                    </div>

                    {/* Languages Spoken */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Languages You Speak
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Greek', 'Turkish'].map((language) => (
                          <label key={language} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedLanguages.includes(language.toLowerCase())}
                              onChange={() => handleLanguageToggle(language.toLowerCase())}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{language}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700">
                            Contact Name
                          </label>
                          <input
                            type="text"
                            id="emergency_contact_name"
                            value={profileFormData.emergency_contact_name}
                            onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700">
                            Contact Phone
                          </label>
                          <input
                            type="tel"
                            id="emergency_contact_phone"
                            value={profileFormData.emergency_contact_phone}
                            onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-6">
                      <button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Preferences Section */}
              {activeSection === 'preferences' && (
                <div className="space-y-6">
                  {/* Display Preferences */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Display Preferences</h2>
                    </div>
                    
                    <div className="px-6 py-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Currency */}
                        <div>
                          <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                            Currency
                          </label>
                          <select
                            id="currency"
                            value={profileFormData.currency}
                            onChange={(e) => handleInputChange('currency', e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="USD">USD - US Dollar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="CAD">CAD - Canadian Dollar</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                          </select>
                        </div>

                        {/* Language */}
                        <div>
                          <label htmlFor="language" className="block text-sm font-medium text-gray-700">
                            Language
                          </label>
                          <select
                            id="language"
                            value={profileFormData.language}
                            onChange={(e) => handleInputChange('language', e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="en">English</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="it">Italiano</option>
                          </select>
                        </div>

                        {/* Temperature Unit */}
                        <div>
                          <label htmlFor="temperature_unit" className="block text-sm font-medium text-gray-700">
                            Temperature Unit
                          </label>
                          <select
                            id="temperature_unit"
                            value={profileFormData.temperature_unit}
                            onChange={(e) => handleInputChange('temperature_unit', e.target.value as 'celsius' | 'fahrenheit')}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="celsius">Celsius (°C)</option>
                            <option value="fahrenheit">Fahrenheit (°F)</option>
                          </select>
                        </div>
                      </div>

                      {/* Notification Preferences */}
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
                        <div className="space-y-4">
                          {[
                            { key: 'email', label: 'Email notifications', description: 'Get notified about bookings and important updates' },
                            { key: 'sms', label: 'SMS notifications', description: 'Receive text messages for urgent notifications' },
                            { key: 'push', label: 'Push notifications', description: 'Browser push notifications' },
                            { key: 'marketing', label: 'Marketing emails', description: 'Receive travel tips and promotional offers' }
                          ].map((setting) => (
                            <div key={setting.key} className="flex items-start">
                              <input
                                type="checkbox"
                                id={setting.key}
                                checked={notificationPreferences[setting.key as keyof typeof notificationPreferences]}
                                onChange={(e) => handleNotificationChange(setting.key, e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                              />
                              <div className="ml-3">
                                <label htmlFor={setting.key} className="text-sm font-medium text-gray-700">
                                  {setting.label}
                                </label>
                                <p className="text-sm text-gray-500">{setting.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Saved Searches */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Saved Searches</h2>
                      <p className="mt-1 text-sm text-gray-600">Manage your saved property searches</p>
                    </div>
                    
                    <div className="px-6 py-6">
                      {savedSearchesLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                          <p className="mt-2 text-sm text-gray-600">Loading saved searches...</p>
                        </div>
                      ) : savedSearches && savedSearches.length > 0 ? (
                        <div className="space-y-4">
                          {savedSearches.map((search: SavedSearch) => (
                            <div key={search.search_id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-gray-900">{search.search_name}</h4>
                                <div className="mt-1 text-sm text-gray-600">
                                  {search.destination && <span>📍 {search.destination}</span>}
                                  {search.check_in_date && search.check_out_date && (
                                    <span className="ml-4">📅 {search.check_in_date} - {search.check_out_date}</span>
                                  )}
                                  {search.guest_count && (
                                    <span className="ml-4">👥 {search.guest_count} guests</span>
                                  )}
                                  {search.price_min && search.price_max && (
                                    <span className="ml-4">💰 ${search.price_min} - ${search.price_max}</span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  Saved on {new Date(search.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Link
                                  to={`/search?${new URLSearchParams({
                                    ...(search.destination && { destination: search.destination }),
                                    ...(search.check_in_date && { check_in_date: search.check_in_date }),
                                    ...(search.check_out_date && { check_out_date: search.check_out_date }),
                                    ...(search.guest_count && { guest_count: search.guest_count.toString() }),
                                    ...(search.property_type && { property_type: search.property_type }),
                                    ...(search.price_min && { price_min: search.price_min.toString() }),
                                    ...(search.price_max && { price_max: search.price_max.toString() })
                                  }).toString()}`}
                                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                  View Results
                                </Link>
                                <button
                                  onClick={() => handleDeleteSavedSearch(search.search_id)}
                                  disabled={deleteSavedSearchMutation.isPending}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No saved searches yet</p>
                          <Link
                            to="/search"
                            className="mt-2 inline-block text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Start searching for properties →
                          </Link>
                        </div>
                      )}
                      {errors.search && (
                        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                          {errors.search}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Verification Section */}
              {activeSection === 'verification' && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Identity Verification</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Verify your identity to increase trust with other users and unlock additional features
                    </p>
                  </div>
                  
                  <div className="px-6 py-6 space-y-6">
                    {/* Verification Status */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {userProfileData?.is_verified ? (
                            <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm">✓</span>
                            </div>
                          ) : (
                            <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm">!</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-gray-900">
                            {userProfileData?.is_verified ? 'Account Verified' : 'Verification Pending'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {userProfileData?.is_verified 
                              ? 'Your identity has been verified successfully.'
                              : 'Complete the verification process to build trust with other users.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Verification Steps */}
                    <div className="space-y-4">
                      {[
                        {
                          type: 'identity',
                          title: 'Government ID',
                          description: 'Upload a photo of your government-issued ID',
                          status: userProfileData?.is_verified ? 'completed' : 'pending'
                        },
                        {
                          type: 'phone',
                          title: 'Phone Number',
                          description: 'Verify your phone number via SMS',
                          status: userProfileData?.phone_number ? 'completed' : 'pending'
                        },
                        {
                          type: 'email',
                          title: 'Email Address',
                          description: 'Confirm your email address',
                          status: 'completed'
                        }
                      ].map((step) => (
                        <div key={step.type} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                                step.status === 'completed' 
                                  ? 'bg-green-500 text-white' 
                                  : 'bg-gray-200 text-gray-600'
                              }`}>
                                {step.status === 'completed' ? '✓' : '○'}
                              </div>
                              <div className="ml-3">
                                <h4 className="text-sm font-medium text-gray-900">{step.title}</h4>
                                <p className="text-sm text-gray-600">{step.description}</p>
                              </div>
                            </div>
                            {step.status === 'pending' && (
                              <button
                                onClick={() => handleVerificationSubmit(step.type)}
                                disabled={submitVerificationMutation.isPending}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {submitVerificationMutation.isPending ? 'Uploading...' : 'Upload'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {errors.verification && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                        {errors.verification}
                      </div>
                    )}

                    {/* Verification Benefits */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Benefits of Verification</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Increased trust from property owners and guests</li>
                        <li>• Higher booking approval rates</li>
                        <li>• Access to premium properties</li>
                        <li>• Verified badge on your profile</li>
                        <li>• Priority customer support</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Security & Privacy Section */}
              {activeSection === 'security' && (
                <div className="space-y-6">
                  {/* Account Security */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Account Security</h2>
                    </div>
                    
                    <div className="px-6 py-6 space-y-6">
                      {/* Password */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Password</h3>
                          <p className="text-sm text-gray-600">Last updated 30 days ago</p>
                        </div>
                        <Link
                          to="/auth?mode=reset"
                          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          Change Password
                        </Link>
                      </div>

                      {/* Two-Factor Authentication */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                          <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                        </div>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                          Setup 2FA
                        </button>
                      </div>

                      {/* Login Activity */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Login Activity</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Current session - Chrome on MacOS</span>
                            <span className="text-green-600">Active now</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Mobile app - iOS</span>
                            <span className="text-gray-500">2 hours ago</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Privacy Settings */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Privacy Settings</h2>
                    </div>
                    
                    <div className="px-6 py-6 space-y-6">
                      {/* Profile Visibility */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Profile Visibility</h3>
                        <div className="space-y-2">
                          {[
                            { value: 'public', label: 'Public', description: 'Anyone can see your profile' },
                            { value: 'verified', label: 'Verified users only', description: 'Only verified users can see your profile' },
                            { value: 'private', label: 'Private', description: 'Only you can see your profile' }
                          ].map((option) => (
                            <label key={option.value} className="flex items-start">
                              <input
                                type="radio"
                                name="profile_visibility"
                                value={option.value}
                                checked={privacySettings.profile_visibility === option.value}
                                onChange={(e) => setPrivacySettings(prev => ({ ...prev, profile_visibility: e.target.value }))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mt-1"
                              />
                              <div className="ml-3">
                                <span className="text-sm font-medium text-gray-700">{option.label}</span>
                                <p className="text-sm text-gray-500">{option.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Data Sharing */}
                      <div className="space-y-4">
                        {[
                          { key: 'data_sharing', label: 'Allow data sharing with partners', description: 'Share anonymized data to improve our services' },
                          { key: 'search_indexing', label: 'Allow search engine indexing', description: 'Let search engines index your public profile' }
                        ].map((setting) => (
                          <div key={setting.key} className="flex items-start">
                            <input
                              type="checkbox"
                              id={setting.key}
                              checked={privacySettings[setting.key as keyof typeof privacySettings] as boolean}
                              onChange={(e) => setPrivacySettings(prev => ({ ...prev, [setting.key]: e.target.checked }))}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                            />
                            <div className="ml-3">
                              <label htmlFor={setting.key} className="text-sm font-medium text-gray-700">
                                {setting.label}
                              </label>
                              <p className="text-sm text-gray-500">{setting.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Account Deletion */}
                      <div className="border-t border-gray-200 pt-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-red-800">Delete Account</h3>
                          <p className="mt-1 text-sm text-red-600">
                            Permanently delete your account and all associated data. This action cannot be undone.
                          </p>
                          <button className="mt-3 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors">
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button for Preferences and Security sections */}
              {(activeSection === 'preferences' || activeSection === 'security') && (
                <div className="bg-white shadow rounded-lg px-6 py-4">
                  <div className="flex justify-end">
                    <button
                      onClick={handleFormSubmit}
                      disabled={updateProfileMutation.isPending}
                      className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_UserProfile;