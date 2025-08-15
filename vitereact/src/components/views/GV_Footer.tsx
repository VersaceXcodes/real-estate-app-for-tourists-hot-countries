import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const GV_Footer: React.FC = () => {
  // Individual selectors to avoid infinite loops
  const userLanguage = useAppStore(state => state.user_preferences.language);
  const userCurrency = useAppStore(state => state.user_preferences.currency);
  const updateLanguage = useAppStore(state => state.update_language);
  const updateCurrency = useAppStore(state => state.update_currency);

  // Mobile accordion state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    company: false,
    support: false,
    community: false,
    hosting: false,
    legal: false
  });

  // Static data
  const currentYear = new Date().getFullYear();
  
  const legalLinks = {
    terms_url: '/terms',
    privacy_url: '/privacy',
    cookies_url: '/cookies',
    gdpr_url: '/gdpr'
  };

  const socialMediaLinks = [
    {
      platform: 'facebook',
      url: 'https://facebook.com/sunvillas',
      icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'
    },
    {
      platform: 'twitter',
      url: 'https://twitter.com/sunvillas',
      icon: 'M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z'
    },
    {
      platform: 'instagram',
      url: 'https://instagram.com/sunvillas',
      icon: 'M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.014 5.367 18.647.001 12.017.001zM8.449 12.013c0-1.971 1.591-3.57 3.559-3.57s3.559 1.599 3.559 3.57-1.591 3.558-3.559 3.558-3.559-1.587-3.559-3.558zm10.238-3.684a.837.837 0 01-.835.843.843.843 0 01-.843-.843c0-.463.38-.843.843-.843s.835.38.835.843zm2.559 3.684c0 .463-.047.926-.141 1.378a4.997 4.997 0 01-1.271 1.8 4.997 4.997 0 01-1.8 1.271c-.452.094-.915.141-1.378.141H7.582c-.463 0-.926-.047-1.378-.141a4.997 4.997 0 01-1.8-1.271 4.997 4.997 0 01-1.271-1.8c-.094-.452-.141-.915-.141-1.378V7.948c0-.463.047-.926.141-1.378a4.997 4.997 0 011.271-1.8 4.997 4.997 0 011.8-1.271c.452-.094.915-.141 1.378-.141h8.064c.463 0 .926.047 1.378.141a4.997 4.997 0 011.8 1.271 4.997 4.997 0 011.271 1.8c.094.452.141.915.141 1.378v8.064z'
    },
    {
      platform: 'linkedin',
      url: 'https://linkedin.com/company/sunvillas',
      icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'
    }
  ];

  const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' }
  ];

  const supportedCurrencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }
  ];

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleLanguageChange = (languageCode: string) => {
    updateLanguage(languageCode);
  };

  const handleCurrencyChange = (currencyCode: string) => {
    updateCurrency(currencyCode);
  };

  return (
    <>
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer Content */}
          <div className="py-12">
            {/* Desktop Layout */}
            <div className="hidden md:grid md:grid-cols-5 md:gap-8">
              {/* Company Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Company
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link to="/about" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link to="/careers" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Careers
                    </Link>
                  </li>
                  <li>
                    <Link to="/press" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Press
                    </Link>
                  </li>
                  <li>
                    <Link to="/blog" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Blog
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Support Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Support
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link to="/help" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Help Center
                    </Link>
                  </li>
                  <li>
                    <Link to="/safety" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Safety
                    </Link>
                  </li>
                  <li>
                    <Link to="/cancellation" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Cancellation Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/accessibility" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Disability Support
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Community Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Community
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link to="/diversity" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Diversity & Belonging
                    </Link>
                  </li>
                  <li>
                    <Link to="/discrimination" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Against Discrimination
                    </Link>
                  </li>
                  <li>
                    <Link to="/accessibility" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Accessibility
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Host Resources Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Host Resources
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link to="/host" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Host Your Home
                    </Link>
                  </li>
                  <li>
                    <Link to="/host/experience" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Host an Experience
                    </Link>
                  </li>
                  <li>
                    <Link to="/responsible-hosting" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Responsible Hosting
                    </Link>
                  </li>
                  <li>
                    <Link to="/community" className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Community Center
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Legal Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                  Legal
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link to={legalLinks.terms_url} className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link to={legalLinks.privacy_url} className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to={legalLinks.cookies_url} className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      Cookie Policy
                    </Link>
                  </li>
                  <li>
                    <Link to={legalLinks.gdpr_url} className="text-base text-gray-300 hover:text-white transition-colors duration-200">
                      GDPR Compliance
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Mobile Layout - Accordion Style */}
            <div className="md:hidden space-y-6">
              {/* Company Section Mobile */}
              <div className="border-b border-gray-700">
                <button
                  onClick={() => toggleSection('company')}
                  className="flex justify-between items-center w-full py-4 text-left"
                  aria-expanded={expandedSections.company}
                >
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                    Company
                  </h3>
                  <svg
                    className={`w-5 h-5 transform transition-transform duration-200 ${
                      expandedSections.company ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.company && (
                  <ul className="pb-4 space-y-3">
                    <li>
                      <Link to="/about" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        About Us
                      </Link>
                    </li>
                    <li>
                      <Link to="/careers" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Careers
                      </Link>
                    </li>
                    <li>
                      <Link to="/press" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Press
                      </Link>
                    </li>
                    <li>
                      <Link to="/blog" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Blog
                      </Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* Support Section Mobile */}
              <div className="border-b border-gray-700">
                <button
                  onClick={() => toggleSection('support')}
                  className="flex justify-between items-center w-full py-4 text-left"
                  aria-expanded={expandedSections.support}
                >
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                    Support
                  </h3>
                  <svg
                    className={`w-5 h-5 transform transition-transform duration-200 ${
                      expandedSections.support ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.support && (
                  <ul className="pb-4 space-y-3">
                    <li>
                      <Link to="/help" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Help Center
                      </Link>
                    </li>
                    <li>
                      <Link to="/safety" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Safety
                      </Link>
                    </li>
                    <li>
                      <Link to="/cancellation" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Cancellation Policy
                      </Link>
                    </li>
                    <li>
                      <Link to="/accessibility" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Disability Support
                      </Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* Community Section Mobile */}
              <div className="border-b border-gray-700">
                <button
                  onClick={() => toggleSection('community')}
                  className="flex justify-between items-center w-full py-4 text-left"
                  aria-expanded={expandedSections.community}
                >
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                    Community
                  </h3>
                  <svg
                    className={`w-5 h-5 transform transition-transform duration-200 ${
                      expandedSections.community ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.community && (
                  <ul className="pb-4 space-y-3">
                    <li>
                      <Link to="/diversity" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Diversity & Belonging
                      </Link>
                    </li>
                    <li>
                      <Link to="/discrimination" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Against Discrimination
                      </Link>
                    </li>
                    <li>
                      <Link to="/accessibility" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Accessibility
                      </Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* Host Resources Section Mobile */}
              <div className="border-b border-gray-700">
                <button
                  onClick={() => toggleSection('hosting')}
                  className="flex justify-between items-center w-full py-4 text-left"
                  aria-expanded={expandedSections.hosting}
                >
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                    Host Resources
                  </h3>
                  <svg
                    className={`w-5 h-5 transform transition-transform duration-200 ${
                      expandedSections.hosting ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.hosting && (
                  <ul className="pb-4 space-y-3">
                    <li>
                      <Link to="/host" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Host Your Home
                      </Link>
                    </li>
                    <li>
                      <Link to="/host/experience" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Host an Experience
                      </Link>
                    </li>
                    <li>
                      <Link to="/responsible-hosting" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Responsible Hosting
                      </Link>
                    </li>
                    <li>
                      <Link to="/community" className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Community Center
                      </Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* Legal Section Mobile */}
              <div>
                <button
                  onClick={() => toggleSection('legal')}
                  className="flex justify-between items-center w-full py-4 text-left"
                  aria-expanded={expandedSections.legal}
                >
                  <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                    Legal
                  </h3>
                  <svg
                    className={`w-5 h-5 transform transition-transform duration-200 ${
                      expandedSections.legal ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.legal && (
                  <ul className="pb-4 space-y-3">
                    <li>
                      <Link to={legalLinks.terms_url} className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Terms of Service
                      </Link>
                    </li>
                    <li>
                      <Link to={legalLinks.privacy_url} className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Privacy Policy
                      </Link>
                    </li>
                    <li>
                      <Link to={legalLinks.cookies_url} className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        Cookie Policy
                      </Link>
                    </li>
                    <li>
                      <Link to={legalLinks.gdpr_url} className="text-base text-gray-300 hover:text-white transition-colors duration-200 block py-1">
                        GDPR Compliance
                      </Link>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-gray-700 py-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-8 lg:space-y-0">
              {/* Language and Currency Selectors */}
              <div className="flex flex-col sm:flex-row sm:space-x-6 space-y-4 sm:space-y-0">
                {/* Language Selector */}
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <select
                    value={userLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    aria-label="Select language"
                  >
                    {supportedLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Currency Selector */}
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <select
                    value={userCurrency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    aria-label="Select currency"
                  >
                    {supportedCurrencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Social Media Links */}
              <div className="flex space-x-6">
                {socialMediaLinks.map((social) => (
                  <a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors duration-200"
                    aria-label={`Visit our ${social.platform} page`}
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d={social.icon}/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Copyright */}
            <div className="mt-8 pt-8 border-t border-gray-700">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center text-center md:text-left">
                <p className="text-sm text-gray-400">
                  © {currentYear} SunVillas, Inc. All rights reserved.
                </p>
                <p className="text-sm text-gray-400 mt-2 md:mt-0">
                  Made with ❤️ for travelers seeking the perfect getaway in hot destinations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default GV_Footer;