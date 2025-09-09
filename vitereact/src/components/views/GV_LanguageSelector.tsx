import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/main';
import axios from 'axios';

interface SupportedLanguage {
  code: string;
  name: string;
  native_name: string;
  flag_icon: string;
  completion_percentage: number;
}

interface TranslationQuality {
  type: 'human' | 'machine' | 'community';
  quality_score: number;
  last_updated: string;
}

const GV_LanguageSelector: React.FC = () => {
  // State variables
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Global state access - CRITICAL: Individual selectors to prevent infinite loops
  const selectedLanguage = useAppStore(state => state.user_preferences.language);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const updateLanguage = useAppStore(state => state.update_language);

  // Supported languages with metadata
  const supportedLanguages: SupportedLanguage[] = [
    { code: 'en', name: 'English', native_name: 'English', flag_icon: '🇺🇸', completion_percentage: 100 },
    { code: 'es', name: 'Spanish', native_name: 'Español', flag_icon: '🇪🇸', completion_percentage: 95 },
    { code: 'fr', name: 'French', native_name: 'Français', flag_icon: '🇫🇷', completion_percentage: 92 },
    { code: 'de', name: 'German', native_name: 'Deutsch', flag_icon: '🇩🇪', completion_percentage: 88 },
    { code: 'it', name: 'Italian', native_name: 'Italiano', flag_icon: '🇮🇹', completion_percentage: 90 },
    { code: 'pt', name: 'Portuguese', native_name: 'Português', flag_icon: '🇵🇹', completion_percentage: 85 },
    { code: 'nl', name: 'Dutch', native_name: 'Nederlands', flag_icon: '🇳🇱', completion_percentage: 78 },
    { code: 'ru', name: 'Russian', native_name: 'Русский', flag_icon: '🇷🇺', completion_percentage: 75 },
    { code: 'zh', name: 'Chinese (Simplified)', native_name: '简体中文', flag_icon: '🇨🇳', completion_percentage: 70 },
    { code: 'ja', name: 'Japanese', native_name: '日本語', flag_icon: '🇯🇵', completion_percentage: 65 },
    { code: 'ko', name: 'Korean', native_name: '한국어', flag_icon: '🇰🇷', completion_percentage: 68 },
    { code: 'ar', name: 'Arabic', native_name: 'العربية', flag_icon: '🇸🇦', completion_percentage: 60 }
  ];

  // Translation quality metadata
  const translationQuality: Record<string, TranslationQuality> = {
    en: { type: 'human', quality_score: 100, last_updated: '2024-01-01' },
    es: { type: 'human', quality_score: 95, last_updated: '2024-01-10' },
    fr: { type: 'human', quality_score: 92, last_updated: '2024-01-08' },
    de: { type: 'community', quality_score: 88, last_updated: '2024-01-12' },
    it: { type: 'community', quality_score: 90, last_updated: '2024-01-05' },
    pt: { type: 'machine', quality_score: 85, last_updated: '2024-01-15' },
    nl: { type: 'machine', quality_score: 78, last_updated: '2024-01-14' },
    ru: { type: 'machine', quality_score: 75, last_updated: '2024-01-13' },
    zh: { type: 'machine', quality_score: 70, last_updated: '2024-01-11' },
    ja: { type: 'machine', quality_score: 65, last_updated: '2024-01-09' },
    ko: { type: 'machine', quality_score: 68, last_updated: '2024-01-07' },
    ar: { type: 'machine', quality_score: 60, last_updated: '2024-01-06' }
  };

  // Browser language detection
  const detectBrowserLanguage = useCallback(() => {
    try {
      const browserLang = navigator.language.split('-')[0];
      const supportedCodes = supportedLanguages.map(lang => lang.code);
      return supportedCodes.includes(browserLang) ? browserLang : 'en';
    } catch (error) {
      console.error('Error detecting browser language:', error);
      return 'en';
    }
  }, []);

  // Initialize language on component mount for guest users
  useEffect(() => {
    if (!isAuthenticated && selectedLanguage === 'en') {
      const detectedLang = detectBrowserLanguage();
      if (detectedLang !== 'en') {
        updateLanguage(detectedLang);
      }
    }
  }, [isAuthenticated, selectedLanguage, detectBrowserLanguage, updateLanguage]);

  // Update language preference
  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === selectedLanguage) {
      setIsDropdownOpen(false);
      return;
    }

// Clear any previous errors
    setUpdateError(null);

    // Optimistic update
    const previousLanguage = selectedLanguage;
    updateLanguage(languageCode);
    setIsDropdownOpen(false);

    // If user is authenticated, persist to backend
    if (isAuthenticated && currentUser && authToken) {
      setIsUpdating(true);
      
      try {
        await axios.put(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}`,
          { language: languageCode },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error: any) {
        // Rollback optimistic update on error
        updateLanguage(previousLanguage);
        
        const errorMessage = error.response?.data?.message || error.message || 'Failed to update language preference';
        setUpdateError(errorMessage);
        console.error('Language update error:', error);
        
        // Auto-clear error after 5 seconds
        setTimeout(() => setUpdateError(null), 5000);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Get current language object
  const currentLanguage = supportedLanguages.find(lang => lang.code === selectedLanguage) || supportedLanguages[0];
  const currentQuality = translationQuality[selectedLanguage];

  // Get quality badge details
  const getQualityBadge = (quality: TranslationQuality) => {
    switch (quality.type) {
      case 'human':
        return { text: 'Human', color: 'bg-green-100 text-green-800', icon: '✓' };
      case 'community':
        return { text: 'Community', color: 'bg-blue-100 text-blue-800', icon: '👥' };
      case 'machine':
        return { text: 'Auto', color: 'bg-yellow-100 text-yellow-800', icon: '🤖' };
      default:
        return { text: 'Auto', color: 'bg-gray-100 text-gray-800', icon: '?' };
    }
  };

  const qualityBadge = getQualityBadge(currentQuality);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Language Selector Button */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isUpdating}
          className={`
            flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md border transition-all duration-200
            ${isUpdating 
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            }
          `}
          aria-label={`Current language: ${currentLanguage.native_name}`}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          <span className="text-lg" role="img" aria-label={`${currentLanguage.name} flag`}>
            {currentLanguage.flag_icon}
          </span>
          <span className="hidden sm:inline">{currentLanguage.native_name}</span>
          <span className="sm:hidden">{currentLanguage.code.toUpperCase()}</span>
          
          {isUpdating ? (
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        {/* Error Message */}
        {updateError && (
          <div className="absolute top-full left-0 mt-1 z-50">
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs max-w-xs">
              <p>{updateError}</p>
            </div>
          </div>
        )}

        {/* Language Dropdown */}
        {isDropdownOpen && (
          <div className="absolute top-full right-0 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Choose Language</h3>
                <div className="flex items-center space-x-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${qualityBadge.color}`}>
                    <span className="mr-1">{qualityBadge.icon}</span>
                    {qualityBadge.text}
                  </span>
                  <span className="text-xs text-gray-500">
                    {currentLanguage.completion_percentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* Language List */}
            <div className="py-1" role="listbox" aria-label="Language options">
              {supportedLanguages.map((language) => {
                const quality = translationQuality[language.code];
                const badge = getQualityBadge(quality);
                const isSelected = language.code === selectedLanguage;
                const isRTL = language.code === 'ar';

                return (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageChange(language.code)}
                    className={`
                      w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150
                      ${isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''}
                      ${isRTL ? 'text-right' : 'text-left'}
                    `}
                    role="option"
                    aria-selected={isSelected}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center space-x-3 ${isRTL ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <span className="text-lg" role="img" aria-label={`${language.name} flag`}>
                          {language.flag_icon}
                        </span>
                        <div>
                          <div className={`text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {language.native_name}
                          </div>
                          <div className={`text-xs text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {language.name}
                          </div>
                        </div>
                      </div>
                      
                      <div className={`flex items-center space-x-2 ${isRTL ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {/* Translation Quality Badge */}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                          <span className="mr-1">{badge.icon}</span>
                          {badge.text}
                        </span>
                        
                        {/* Completion Percentage */}
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            {language.completion_percentage}%
                          </div>
                          <div className="w-12 bg-gray-200 rounded-full h-1">
                            <div 
                              className={`h-1 rounded-full ${
                                language.completion_percentage >= 90 ? 'bg-green-500' :
                                language.completion_percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${language.completion_percentage}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* Selected Indicator */}
                        {isSelected && (
                          <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer with Community Contribution Link */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-600 text-center">
                <p className="mb-2">
                  Help improve translations for your language
                </p>
                <button className="text-blue-600 hover:text-blue-500 font-medium transition-colors duration-150">
                  Join our translation community →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GV_LanguageSelector;