import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Types for currency data
interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
}

interface ExchangeRatesResponse {
  base_currency: string;
  rates: Record<string, number>;
  rate_date: string;
}

interface UpdateCurrencyResponse {
  currency: string;
  updated_at: string;
}

    // Currency data with names and symbols
const CURRENCY_DATA: Record<string, { name: string; symbol: string }> = {
  'USD': { name: 'US Dollar', symbol: '$' },
  'EUR': { name: 'Euro', symbol: '€' },
  'GBP': { name: 'British Pound', symbol: '£' },
  'CAD': { name: 'Canadian Dollar', symbol: 'C$' },
  'AUD': { name: 'Australian Dollar', symbol: 'A$' },
  'JPY': { name: 'Japanese Yen', symbol: '¥' },
  'CHF': { name: 'Swiss Franc', symbol: 'CHF' },
  'SEK': { name: 'Swedish Krona', symbol: 'kr' },
  'NOK': { name: 'Norwegian Krone', symbol: 'kr' },
  'DKK': { name: 'Danish Krone', symbol: 'kr' },
  'MXN': { name: 'Mexican Peso', symbol: '$' },
  'THB': { name: 'Thai Baht', symbol: '฿' },
  'IDR': { name: 'Indonesian Rupiah', symbol: 'Rp' },
  'MYR': { name: 'Malaysian Ringgit', symbol: 'RM' },
  'SGD': { name: 'Singapore Dollar', symbol: 'S$' },
  'ZAR': { name: 'South African Rand', symbol: 'R' },
  'BRL': { name: 'Brazilian Real', symbol: 'R$' },
  'AED': { name: 'UAE Dirham', symbol: 'د.إ' },
  'TRY': { name: 'Turkish Lira', symbol: '₺' },
  'CNY': { name: 'Chinese Yuan', symbol: '¥' }
};

// Supported currencies list
const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_DATA);

// Helper function to detect browser locale currency
const detectBrowserCurrency = (): string => {
  try {
    const locale = navigator.language || 'en-US';
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
    const parts = formatter.formatToParts(1);
    const currencyPart = parts.find(part => part.type === 'currency');
    
    if (currencyPart && SUPPORTED_CURRENCIES.includes(currencyPart.value)) {
      return currencyPart.value;
    }

    // Fallback based on locale
    if (locale.includes('en-GB') || locale.includes('gb')) return 'GBP';
    if (locale.includes('de') || locale.includes('at')) return 'EUR';
    if (locale.includes('fr')) return 'EUR';
    if (locale.includes('es')) return 'EUR';
    if (locale.includes('it')) return 'EUR';
    if (locale.includes('ja')) return 'JPY';
    if (locale.includes('ca')) return 'CAD';
    if (locale.includes('au')) return 'AUD';
    if (locale.includes('se')) return 'SEK';
    if (locale.includes('no')) return 'NOK';
    if (locale.includes('dk')) return 'DKK';
    if (locale.includes('ch')) return 'CHF';
    
    return 'USD';
  } catch {
    return 'USD';
  }
};

const GV_CurrencySelector: React.FC = () => {
  // Individual Zustand selectors (CRITICAL: no object destructuring)
  const currentCurrency = useAppStore(state => state.user_preferences.currency);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const updateCurrency = useAppStore(state => state.update_currency);

  // Local state
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency || 'USD');
  const [autoDetectedCurrency, setAutoDetectedCurrency] = useState<string | null>(null);

  // Query client for cache management
  const queryClient = useQueryClient();

  // Fetch exchange rates
  const {
    data: exchangeRates,
    isLoading: ratesLoading,
    error: ratesError,
    refetch: refetchRates
  } = useQuery<ExchangeRatesResponse>({
    queryKey: ['currency-rates', selectedCurrency],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/currency-rates`,
        {
          params: {
            base_currency: selectedCurrency,
            target_currencies: SUPPORTED_CURRENCIES
          }
        }
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2
  });

  // Update user currency preference mutation
  const updateCurrencyMutation = useMutation<UpdateCurrencyResponse, Error, string>({
    mutationFn: async (currency: string) => {
      if (!isAuthenticated || !currentUser?.user_id || !authToken) {
        throw new Error('User not authenticated');
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${currentUser.user_id}`,
        { currency },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Update global state
      updateCurrency(data.currency);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['currency-rates'] });
    },
    onError: (error) => {
      console.error('Failed to update currency preference:', error);
      // Could show a toast notification here
    }
  });

  // Process exchange rates data
  const supportedCurrencies: CurrencyRate[] = React.useMemo(() => {
    if (!exchangeRates?.rates) {
      return SUPPORTED_CURRENCIES.map(code => ({
        code,
        name: CURRENCY_DATA[code]?.name || code,
        symbol: CURRENCY_DATA[code]?.symbol || code,
        exchange_rate: code === selectedCurrency ? 1.0 : 1.0
      }));
    }

    return SUPPORTED_CURRENCIES.map(code => ({
      code,
      name: CURRENCY_DATA[code]?.name || code,
      symbol: CURRENCY_DATA[code]?.symbol || code,
      exchange_rate: exchangeRates.rates[code] || 1.0
    }));
  }, [exchangeRates, selectedCurrency]);

  // Auto-detect currency on first load
  useEffect(() => {
    if (!currentCurrency) {
      const detectedCurrency = detectBrowserCurrency();
      setAutoDetectedCurrency(detectedCurrency);
      setSelectedCurrency(detectedCurrency);
      updateCurrency(detectedCurrency);
    }
  }, [currentCurrency, updateCurrency]);

  // Sync with global state
  useEffect(() => {
    if (currentCurrency && currentCurrency !== selectedCurrency) {
      setSelectedCurrency(currentCurrency);
    }
  }, [currentCurrency, selectedCurrency]);

  // Handle currency selection
  const handleCurrencySelect = useCallback((currency: string) => {
    // Clear errors
    setSelectedCurrency(currency);
    updateCurrency(currency);
    setIsOpen(false);

    // Update user preference if authenticated
    if (isAuthenticated && currentUser?.user_id) {
      updateCurrencyMutation.mutate(currency);
    }
  }, [isAuthenticated, currentUser?.user_id, updateCurrency, updateCurrencyMutation]);

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-currency-selector]')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDropdown();
    }
  }, [toggleDropdown]);

  // Get current currency data
  const currentCurrencyData = supportedCurrencies.find(c => c.code === selectedCurrency) || {
    code: selectedCurrency,
    name: CURRENCY_DATA[selectedCurrency]?.name || selectedCurrency,
    symbol: CURRENCY_DATA[selectedCurrency]?.symbol || selectedCurrency,
    exchange_rate: 1.0
  };

  // Format last update time
  const formatLastUpdate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <>
      <div className="relative" data-currency-selector>
        {/* Currency Selector Button */}
        <button
          type="button"
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={`Current currency: ${currentCurrencyData.name}`}
        >
          <span className="text-lg" role="img" aria-hidden="true">
            {currentCurrencyData.symbol}
          </span>
          <span className="text-sm font-mono">{selectedCurrency}</span>
          
          {/* Loading indicator */}
          {(ratesLoading || updateCurrencyMutation.isPending) && (
            <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          
          {/* Dropdown arrow */}
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 z-50 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Select Currency</h3>
                {exchangeRates?.rate_date && (
                  <span className="text-xs text-gray-500">
                    Updated: {formatLastUpdate(exchangeRates.rate_date)}
                  </span>
                )}
              </div>
              
              {/* Auto-detected notice */}
              {autoDetectedCurrency && !isAuthenticated && (
                <p className="mt-1 text-xs text-blue-600">
                  Auto-detected from your location: {CURRENCY_DATA[autoDetectedCurrency]?.name}
                </p>
              )}
              
              {/* Error notice */}
              {ratesError && (
                <div className="mt-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs text-amber-600">Using cached rates</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      refetchRates();
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Currency List */}
            <div className="max-h-64 overflow-y-auto" role="listbox">
              {supportedCurrencies.map((currency) => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => handleCurrencySelect(currency.code)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors ${
                    currency.code === selectedCurrency ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                  role="option"
                  aria-selected={currency.code === selectedCurrency}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg" role="img" aria-hidden="true">
                        {currency.symbol}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {currency.code}
                        </div>
                        <div className="text-xs text-gray-500">
                          {currency.name}
                        </div>
                      </div>
                    </div>
                    
                    {/* Exchange rate */}
                    {currency.code !== selectedCurrency && (
                      <div className="text-right">
                        <div className="text-xs font-mono text-gray-600">
                          1 {selectedCurrency} = {currency.exchange_rate.toFixed(4)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {currency.code}
                        </div>
                      </div>
                    )}
                    
                    {/* Selected indicator */}
                    {currency.code === selectedCurrency && (
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {isAuthenticated ? 'Preference saved automatically' : 'Sign in to save preference'}
                </span>
                <span>
                  {supportedCurrencies.length} currencies
                </span>
              </div>
              
              {/* Attribution */}
              <div className="mt-1 text-xs text-gray-400">
                Exchange rates provided by financial data sources
              </div>
            </div>
          </div>
        )}

        {/* Error message for mutation */}
        {updateCurrencyMutation.isError && (
          <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 z-40">
            Failed to save currency preference. Please try again.
          </div>
        )}
      </div>
    </>
  );
};

export default GV_CurrencySelector;