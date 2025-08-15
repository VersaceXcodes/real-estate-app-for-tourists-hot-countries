import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const GV_MobileNav: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // CRITICAL: Individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const unreadMessages = useAppStore(state => state.notifications_state.unread_messages);

  const currency = useAppStore(state => state.user_preferences.currency);
  const language = useAppStore(state => state.user_preferences.language);
  const logoutUser = useAppStore(state => state.logout_user);
  const updateCurrency = useAppStore(state => state.update_currency);
  const updateLanguage = useAppStore(state => state.update_language);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    closeMenu();
  };

  const handleLogout = () => {
    logoutUser();
    closeMenu();
  };

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  // Handle touch events for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    // Store initial touch position for swipe detection
    (e.currentTarget as any).touchStartX = touch.clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const startX = (e.currentTarget as any).touchStartX;
    const endX = touch.clientX;
    const diff = startX - endX;

    // If swiped left more than 50px, close menu
    if (diff > 50) {
      closeMenu();
    }
  };

  return (
    <>
      {/* Hamburger Menu Button - Always visible on mobile */}
      <button
        onClick={toggleMenu}
        className="md:hidden fixed top-4 left-4 z-50 bg-white rounded-lg shadow-lg p-2 border border-gray-200"
        aria-label="Toggle mobile menu"
        aria-expanded={isMenuOpen}
      >
        <div className="w-6 h-6 flex flex-col justify-center items-center">
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1' : '-translate-y-1'}`}></span>
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}></span>
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1' : 'translate-y-1'}`}></span>
        </div>
      </button>

      {/* Overlay */}
      {isMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Navigation Menu */}
      <nav
        className={`md:hidden fixed top-0 left-0 h-full w-80 max-w-sm bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Mobile navigation"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-blue-600 text-white">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold">SunVillas</span>
            </div>
            <button
              onClick={closeMenu}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Menu Content */}
          <div className="flex-1 overflow-y-auto">
            {!isAuthenticated ? (
              /* Unauthenticated Menu */
              <div className="py-6">
                {/* Search Properties */}
                <div className="px-6 mb-6">
                  <Link
                    to="/search"
                    onClick={closeMenu}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Search Properties</div>
                      <div className="text-sm text-gray-500">Find your perfect stay</div>
                    </div>
                  </Link>
                </div>

                {/* Explore Destinations */}
                <div className="px-6 mb-6">
                  <Link
                    to="/destinations"
                    onClick={closeMenu}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Explore Destinations</div>
                      <div className="text-sm text-gray-500">Discover hot climate locations</div>
                    </div>
                  </Link>
                </div>

                {/* Become a Host */}
                <div className="px-6 mb-6">
                  <Link
                    to="/host"
                    onClick={closeMenu}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Become a Host</div>
                      <div className="text-sm text-gray-500">Start earning from your property</div>
                    </div>
                  </Link>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {/* Authentication */}
                <div className="px-6 mb-6 space-y-3">
                  <Link
                    to="/auth?mode=login"
                    onClick={closeMenu}
                    className="block w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors min-h-[44px] flex items-center justify-center"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/auth?mode=register"
                    onClick={closeMenu}
                    className="block w-full border border-gray-300 text-gray-700 text-center py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors min-h-[44px] flex items-center justify-center"
                  >
                    Sign Up
                  </Link>
                </div>

                {/* Help Center */}
                <div className="px-6 mb-6">
                  <button
                    onClick={() => handleNavigation('/help')}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] w-full text-left"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Help Center</div>
                      <div className="text-sm text-gray-500">Get support and answers</div>
                    </div>
                  </button>
                </div>

                {/* Language & Currency */}
                <div className="px-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Language</span>
                      <select
                        value={language}
                        onChange={(e) => updateLanguage(e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white min-h-[44px]"
                      >
                        <option value="en">🇺🇸 English</option>
                        <option value="es">🇪🇸 Español</option>
                        <option value="fr">🇫🇷 Français</option>
                        <option value="de">🇩🇪 Deutsch</option>
                        <option value="it">🇮🇹 Italiano</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Currency</span>
                      <select
                        value={currency}
                        onChange={(e) => updateCurrency(e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white min-h-[44px]"
                      >
                        <option value="USD">$ USD</option>
                        <option value="EUR">€ EUR</option>
                        <option value="GBP">£ GBP</option>
                        <option value="CAD">$ CAD</option>
                        <option value="AUD">$ AUD</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Authenticated Menu */
              <div className="py-6">
                {/* User Info */}
                <div className="px-6 mb-6">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {currentUser?.first_name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {currentUser?.first_name} {currentUser?.last_name}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">{currentUser?.user_type}</div>
                    </div>
                  </div>
                </div>

                {/* Your Trips */}
                <div className="px-6 mb-4">
                  <Link
                    to="/dashboard?tab=trips"
                    onClick={closeMenu}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-6 0H3m3 0h6M9 7h6m-6 4h6m-6 4h6" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Your Trips</div>
                      <div className="text-sm text-gray-500">Manage your bookings</div>
                    </div>
                  </Link>
                </div>

                {/* Messages */}
                <div className="px-6 mb-4">
                  <Link
                    to="/messages"
                    onClick={closeMenu}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center relative">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Messages</div>
                      <div className="text-sm text-gray-500">
                        {unreadMessages > 0 ? `${unreadMessages} unread` : 'No new messages'}
                      </div>
                    </div>
                  </Link>
                </div>

                {/* Saved Properties */}
                <div className="px-6 mb-4">
                  <Link
                    to="/dashboard?tab=favorites"
                    onClick={closeMenu}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Saved Properties</div>
                      <div className="text-sm text-gray-500">Your favorite listings</div>
                    </div>
                  </Link>
                </div>

                {/* Host Dashboard - Only for hosts */}
                {currentUser?.user_type === 'host' && (
                  <div className="px-6 mb-4">
                    <Link
                      to="/host"
                      onClick={closeMenu}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                    >
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Host Dashboard</div>
                        <div className="text-sm text-gray-500">Manage your properties</div>
                      </div>
                    </Link>
                  </div>
                )}

                {/* Investment Tools - Only for investors/verified users */}
                {(currentUser?.user_type === 'admin' || currentUser?.is_verified) && (
                  <div className="px-6 mb-4">
                    <Link
                      to="/investments"
                      onClick={closeMenu}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                    >
                      <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Investment Tools</div>
                        <div className="text-sm text-gray-500">Market analysis & ROI</div>
                      </div>
                    </Link>
                  </div>
                )}

                {/* Profile Settings */}
                <div className="px-6 mb-4">
                  <Link
                    to="/profile"
                    onClick={closeMenu}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Profile Settings</div>
                      <div className="text-sm text-gray-500">Edit your information</div>
                    </div>
                  </Link>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {/* Help Center */}
                <div className="px-6 mb-4">
                  <button
                    onClick={() => handleNavigation('/help')}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] w-full text-left"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Help Center</div>
                      <div className="text-sm text-gray-500">Personalized support</div>
                    </div>
                  </button>
                </div>

                {/* Language & Currency */}
                <div className="px-6 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Language</span>
                      <select
                        value={language}
                        onChange={(e) => updateLanguage(e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white min-h-[44px]"
                      >
                        <option value="en">🇺🇸 English</option>
                        <option value="es">🇪🇸 Español</option>
                        <option value="fr">🇫🇷 Français</option>
                        <option value="de">🇩🇪 Deutsch</option>
                        <option value="it">🇮🇹 Italiano</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Currency</span>
                      <select
                        value={currency}
                        onChange={(e) => updateCurrency(e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white min-h-[44px]"
                      >
                        <option value="USD">$ USD</option>
                        <option value="EUR">€ EUR</option>
                        <option value="GBP">£ GBP</option>
                        <option value="CAD">$ CAD</option>
                        <option value="AUD">$ AUD</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Logout */}
                <div className="px-6">
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-red-50 transition-colors min-h-[44px] w-full text-left text-red-600"
                  >
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Log Out</div>
                      <div className="text-sm text-red-500">Sign out of your account</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default GV_MobileNav;