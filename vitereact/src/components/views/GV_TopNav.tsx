import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Types for API responses
interface LocationSuggestion {
  location_id: string;
  city: string;
  country: string;
  destination_slug: string;
  is_featured: boolean;
}

interface LocationSearchResponse {
  locations: LocationSuggestion[];
  total: number;
}

const GV_TopNav: React.FC = () => {
  // CRITICAL: Individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const unreadMessages = useAppStore(state => state.notifications_state.unread_messages);
  const currency = useAppStore(state => state.user_preferences.currency);
  const language = useAppStore(state => state.user_preferences.language);
  const logoutUser = useAppStore(state => state.logout_user);
  const updateCurrency = useAppStore(state => state.update_currency);
  const updateLanguage = useAppStore(state => state.update_language);

  // Local component state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const currencyMenuRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  // Debounced search for autocomplete
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search suggestions query
  const { data: searchSuggestions, isLoading: isSearchLoading } = useQuery<LocationSearchResponse>({
    queryKey: ['searchSuggestions', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { locations: [], total: 0 };
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/locations`,
        {
          params: {
            query: debouncedQuery,
            is_hot_destination: true,
            limit: 8
          }
        }
      );
      return response.data;
    },
    enabled: !!debouncedQuery.trim() && isSearchFocused,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchFocused(false);
      setSearchQuery('');
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    navigate(`/search?destination=${encodeURIComponent(`${suggestion.city}, ${suggestion.country}`)}`);
    setIsSearchFocused(false);
    setSearchQuery('');
  };

  // Handle logout
  const handleLogout = () => {
    logoutUser();
    setIsUserMenuOpen(false);
    navigate('/');
  };

  // Handle outside clicks to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(event.target as Node)) {
        setIsCurrencyMenuOpen(false);
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Currency and language options
  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }
  ];

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' }
  ];

  const currentCurrency = currencies.find(c => c.code === currency) || currencies[0];
  const currentLanguage = languages.find(l => l.code === language) || languages[0];

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900 hidden sm:block">SunVillas</span>
              </Link>
            </div>

            {/* Desktop Search Bar */}
            <div className="hidden md:flex flex-1 max-w-md mx-8 relative">
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    placeholder="Search destinations..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    aria-label="Search destinations"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  
                  {/* Search Suggestions Dropdown */}
                  {isSearchFocused && debouncedQuery && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      {isSearchLoading ? (
                        <div className="p-4 text-center text-gray-500">
                          <svg className="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      ) : searchSuggestions?.locations.length ? (
                        <>
                          {searchSuggestions.locations.map((suggestion) => (
                            <button
                              key={suggestion.location_id}
                              onClick={() => handleSuggestionSelect(suggestion)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                            >
                              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <div>
                                <div className="font-medium text-gray-900">{suggestion.city}</div>
                                <div className="text-sm text-gray-500">{suggestion.country}</div>
                              </div>
                              {suggestion.is_featured && (
                                <span className="ml-auto text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">Featured</span>
                              )}
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          No destinations found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {!isAuthenticated ? (
                <>
                  {/* Unauthenticated Navigation */}
                  <Link
                    to="/host"
                    className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    Become a Host
                  </Link>
                  
                  {/* Language Selector */}
                  <div className="relative" ref={languageMenuRef}>
                    <button
                      onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                      className="flex items-center space-x-1 text-gray-700 hover:text-gray-900 transition-colors"
                      aria-label="Select language"
                    >
                      <span className="text-lg">{currentLanguage.flag}</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isLanguageMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              updateLanguage(lang.code);
                              setIsLanguageMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3 ${
                              lang.code === language ? 'bg-orange-50 text-orange-600' : 'text-gray-700'
                            }`}
                          >
                            <span className="text-lg">{lang.flag}</span>
                            <span>{lang.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Currency Selector */}
                  <div className="relative" ref={currencyMenuRef}>
                    <button
                      onClick={() => setIsCurrencyMenuOpen(!isCurrencyMenuOpen)}
                      className="flex items-center space-x-1 text-gray-700 hover:text-gray-900 transition-colors"
                      aria-label="Select currency"
                    >
                      <span className="font-medium">{currentCurrency.code}</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isCurrencyMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        {currencies.map((curr) => (
                          <button
                            key={curr.code}
                            onClick={() => {
                              updateCurrency(curr.code);
                              setIsCurrencyMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between ${
                              curr.code === currency ? 'bg-orange-50 text-orange-600' : 'text-gray-700'
                            }`}
                          >
                            <span>{curr.name}</span>
                            <span className="font-medium">{curr.symbol}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    to="/auth?mode=register"
                    className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    Sign Up
                  </Link>
                  
                  <Link
                    to="/auth?mode=login"
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium"
                  >
                    Log In
                  </Link>
                </>
              ) : (
                <>
                  {/* Authenticated Navigation */}
                  <Link
                    to="/dashboard"
                    className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    Your Trips
                  </Link>
                  
                  <Link
                    to="/messages"
                    className="relative text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    Messages
                    {unreadMessages > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </Link>
                  
                  <Link
                    to={currentUser?.user_type === 'host' ? '/host' : '/host'}
                    className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    {currentUser?.user_type === 'host' ? 'Host Dashboard' : 'Become a Host'}
                  </Link>

                  {/* User Menu */}
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
                      aria-label="User menu"
                    >
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        {currentUser?.profile_photo_url ? (
                          <img
                            src={currentUser.profile_photo_url}
                            alt={`${currentUser.first_name} ${currentUser.last_name}`}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-medium text-sm">
                            {currentUser?.first_name?.[0]}{currentUser?.last_name?.[0]}
                          </span>
                        )}
                      </div>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isUserMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <div className="p-4 border-b border-gray-200">
                          <div className="font-medium text-gray-900">
                            {currentUser?.first_name} {currentUser?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{currentUser?.email}</div>
                        </div>
                        
                        <div className="py-2">
                          <Link
                            to="/profile"
                            className="block px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            Profile
                          </Link>
                          
                          <Link
                            to="/dashboard"
                            className="block px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            Account Settings
                          </Link>
                          
                          {currentUser?.user_type === 'host' && (
                            <Link
                              to="/host"
                              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              Host Tools
                            </Link>
                          )}
                          
                          {currentUser?.user_type === 'admin' && (
                            <Link
                              to="/investments"
                              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              Investment Dashboard
                            </Link>
                          )}
                        </div>
                        
                        <div className="border-t border-gray-200 py-2">
                          <button
                            onClick={handleLogout}
                            className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Log Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-700 hover:text-gray-900 p-2"
                aria-label="Toggle mobile menu"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div className="md:hidden pb-4">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Search destinations..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-4">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/host"
                    className="block text-gray-700 hover:text-gray-900 font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Become a Host
                  </Link>
                  
                  <Link
                    to="/auth?mode=register"
                    className="block text-gray-700 hover:text-gray-900 font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                  
                  <Link
                    to="/auth?mode=login"
                    className="block bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium text-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Log In
                  </Link>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      {currentUser?.profile_photo_url ? (
                        <img
                          src={currentUser.profile_photo_url}
                          alt={`${currentUser.first_name} ${currentUser.last_name}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-medium">
                          {currentUser?.first_name?.[0]}{currentUser?.last_name?.[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {currentUser?.first_name} {currentUser?.last_name}
                      </div>
                      <div className="text-sm text-gray-500">{currentUser?.email}</div>
                    </div>
                  </div>
                  
                  <Link
                    to="/dashboard"
                    className="block text-gray-700 hover:text-gray-900 font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Your Trips
                  </Link>
                  
                  <Link
                    to="/messages"
                    className="flex items-center justify-between text-gray-700 hover:text-gray-900 font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span>Messages</span>
                    {unreadMessages > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </Link>
                  
                  <Link
                    to={currentUser?.user_type === 'host' ? '/host' : '/host'}
                    className="block text-gray-700 hover:text-gray-900 font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {currentUser?.user_type === 'host' ? 'Host Dashboard' : 'Become a Host'}
                  </Link>
                  
                  <Link
                    to="/profile"
                    className="block text-gray-700 hover:text-gray-900 font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="block w-full text-left text-gray-700 hover:text-gray-900 font-medium"
                  >
                    Log Out
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default GV_TopNav;