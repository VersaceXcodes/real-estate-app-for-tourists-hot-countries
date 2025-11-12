import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Types for API responses
interface MarketData {
  market_id: string;
  location_id: string;
  property_type: string;
  average_price_per_sqm: number;
  average_rental_yield: number;
  price_growth_12m: number;
  price_growth_24m: number;
  rental_demand_score: number;
  investment_score: number;
  market_liquidity: string;
  foreign_ownership_allowed: boolean;
  property_tax_rate: number;
  rental_tax_rate: number;
  legal_requirements: string[];
  month: string;
  location: {
    location_id: string;
    city: string;
    country: string;
    climate_type: string;
    destination_slug: string;
  };
}

interface InvestmentAnalytics {
  analytics_id: string;
  property_id: string;
  owner_id: string;
  purchase_price?: number;
  purchase_date?: string;
  current_value?: number;
  annual_rental_income: number;
  annual_expenses: number;
  occupancy_rate: number;
  rental_yield?: number;
  capital_appreciation?: number;
  total_return?: number;
  roi_percentage?: number;
  year: number;
  created_at: string;
  updated_at: string;
}

interface CurrencyRate {
  base_currency: string;
  rates: Record<string, number>;
  rate_date: string;
}

interface PortfolioSummary {
  total_properties: number;
  total_invested: number;
  current_value: number;
  annual_income: number;
  average_roi: number;
  total_return_percentage: number;
}

const UV_InvestmentAnalytics: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'calculator' | 'market' | 'legal'>('overview');
  const [calculatorInputs, setCalculatorInputs] = useState({
    purchasePrice: '',
    currentValue: '',
    annualIncome: '',
    annualExpenses: '',
    occupancyRate: ''
  });

  // URL params
  const selectedCountry = searchParams.get('country');
  const selectedPropertyType = searchParams.get('property_type');

  // Individual Zustand selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const userCurrency = useAppStore(state => state.user_preferences.currency);
  const setInvestmentPortfolio = useAppStore(state => state.set_investment_portfolio);
  const setMarketData = useAppStore(state => state.set_market_data);
  const setInvestmentLoading = useAppStore(state => state.set_investment_loading);

  // API functions
  const fetchMarketData = async (): Promise<{ market_data: MarketData[], total: number }> => {
    const params = new URLSearchParams();
    if (selectedCountry) params.append('location_id', selectedCountry);
    if (selectedPropertyType) params.append('property_type', selectedPropertyType);
    params.append('limit', '50');

    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/market-data?${params}`,
      {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      }
    );
    return response.data;
  };

  const fetchInvestmentPortfolio = async (): Promise<InvestmentAnalytics[]> => {
    if (!currentUser?.user_id || !authToken) return [];

    // Since we need to aggregate multiple property analytics, we'll fetch user's properties first
    const propertiesResponse = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties?owner_id=${currentUser.user_id}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const properties = propertiesResponse.data.properties || [];
    const analyticsPromises = properties.map((property: any) =>
      axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties/${property.property_id}/api/analytics?year=${new Date().getFullYear()}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      ).catch(() => null)
    );

    const analyticsResults = await Promise.all(analyticsPromises);
    return analyticsResults.filter(result => result?.data).map(result => result!.data);
  };

  const fetchCurrencyRates = async (): Promise<CurrencyRate> => {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/currency-rates?base_currency=${userCurrency}&target_currencies=USD,EUR,GBP`
    );
    return response.data;
  };

  // React Query hooks
  const { data: marketAnalysisData, isLoading: isMarketLoading, error: marketError } = useQuery({
    queryKey: ['market-data', selectedCountry, selectedPropertyType],
    queryFn: fetchMarketData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!authToken
  });

  const { data: portfolioAnalytics, isLoading: isPortfolioLoading } = useQuery({
    queryKey: ['investment-portfolio', currentUser?.user_id],
    queryFn: fetchInvestmentPortfolio,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!(authToken && currentUser?.user_id)
  });

  useQuery({
    queryKey: ['currency-rates', userCurrency],
    queryFn: fetchCurrencyRates,
    staleTime: 10 * 60 * 1000,
    retry: 1
  });

  // Update store when data changes
  useEffect(() => {
    if (marketAnalysisData) {
      setMarketData(marketAnalysisData.market_data);
    }
  }, [marketAnalysisData, setMarketData]);

  useEffect(() => {
    if (portfolioAnalytics) {
      setInvestmentPortfolio(portfolioAnalytics);
    }
  }, [portfolioAnalytics, setInvestmentPortfolio]);

  useEffect(() => {
    setInvestmentLoading(isMarketLoading || isPortfolioLoading);
  }, [isMarketLoading, isPortfolioLoading, setInvestmentLoading]);

  // Calculate portfolio summary
  const portfolioSummary: PortfolioSummary = useMemo(() => {
    if (!portfolioAnalytics || portfolioAnalytics.length === 0) {
      return {
        total_properties: 0,
        total_invested: 0,
        current_value: 0,
        annual_income: 0,
        average_roi: 0,
        total_return_percentage: 0
      };
    }

    const totalInvested = portfolioAnalytics.reduce((sum, item) => sum + (item.purchase_price || 0), 0);
    const currentValue = portfolioAnalytics.reduce((sum, item) => sum + (item.current_value || 0), 0);
    const annualIncome = portfolioAnalytics.reduce((sum, item) => sum + item.annual_rental_income, 0);
    const avgRoi = portfolioAnalytics.reduce((sum, item) => sum + (item.roi_percentage || 0), 0) / portfolioAnalytics.length;
    const totalReturnPercentage = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

    return {
      total_properties: portfolioAnalytics.length,
      total_invested: totalInvested,
      current_value: currentValue,
      annual_income: annualIncome,
      average_roi: avgRoi,
      total_return_percentage: totalReturnPercentage
    };
  }, [portfolioAnalytics]);

  // Calculate ROI from inputs
  const calculatedROI = useMemo(() => {
    const purchase = parseFloat(calculatorInputs.purchasePrice) || 0;
    const current = parseFloat(calculatorInputs.currentValue) || 0;
    const income = parseFloat(calculatorInputs.annualIncome) || 0;
    const expenses = parseFloat(calculatorInputs.annualExpenses) || 0;
    const occupancy = parseFloat(calculatorInputs.occupancyRate) || 0;

    if (purchase === 0) return null;

    const netIncome = (income * occupancy / 100) - expenses;
    const capitalGain = current - purchase;
    const totalReturn = netIncome + capitalGain;
    const roiPercentage = (totalReturn / purchase) * 100;
    const rentalYield = purchase > 0 ? (netIncome / purchase) * 100 : 0;

    return {
      netIncome,
      capitalGain,
      totalReturn,
      roiPercentage,
      rentalYield
    };
  }, [calculatorInputs]);

  // Event handlers
  const handleFilterChange = (filterType: 'country' | 'property_type', value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(filterType, value);
    } else {
      newParams.delete(filterType);
    }
    setSearchParams(newParams);
  };

  const handleCalculatorInputChange = (field: string, value: string) => {
    setCalculatorInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearCalculator = () => {
    setCalculatorInputs({
      purchasePrice: '',
      currentValue: '',
      annualIncome: '',
      annualExpenses: '',
      occupancyRate: ''
    });
  };

  // Format currency helper
  const formatCurrency = (amount: number, currency: string = userCurrency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Format percentage helper
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Check if user has investor permissions
  const isInvestorVerified = currentUser?.user_type === 'host' || currentUser?.is_verified;

  if (!currentUser) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Investment Analytics</h2>
            <p className="text-gray-600 mb-6">Please sign in to access investment analysis tools.</p>
            <Link
              to="/auth?mode=login"
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Sign In
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!isInvestorVerified) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Investor Verification Required</h2>
            <p className="text-gray-600 mb-6">
              Access to investment analytics requires investor account verification. This includes advanced market analysis, 
              portfolio tracking, and financial calculation tools.
            </p>
            <div className="space-y-4">
              <Link
                to="/profile?section=verification"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Complete Verification
              </Link>
              <Link
                to="/dashboard"
                className="block text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Return to Dashboard
              </Link>
            </div>
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
                <h1 className="text-3xl font-bold text-gray-900">Investment Analytics</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Comprehensive real estate investment analysis for hot climate destinations
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedCountry || ''}
                  onChange={(e) => handleFilterChange('country', e.target.value)}
                  className="block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">All Countries</option>
                  <option value="greece">Greece</option>
                  <option value="spain">Spain</option>
                  <option value="portugal">Portugal</option>
                  <option value="mexico">Mexico</option>
                  <option value="thailand">Thailand</option>
                </select>
                <select
                  value={selectedPropertyType || ''}
                  onChange={(e) => handleFilterChange('property_type', e.target.value)}
                  className="block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">All Types</option>
                  <option value="villa">Villa</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="resort">Resort</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              {[
                { id: 'overview', name: 'Market Overview', icon: '📊' },
                { id: 'portfolio', name: 'My Portfolio', icon: '💼' },
                { id: 'calculator', name: 'ROI Calculator', icon: '🧮' },
                { id: 'market', name: 'Market Analysis', icon: '📈' },
                { id: 'legal', name: 'Legal Info', icon: '⚖️' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Market Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl">🏠</div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Properties</dt>
                          <dd className="text-lg font-medium text-gray-900">{portfolioSummary.total_properties}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl">💰</div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Invested</dt>
                          <dd className="text-lg font-medium text-gray-900">{formatCurrency(portfolioSummary.total_invested)}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl">📈</div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Current Value</dt>
                          <dd className="text-lg font-medium text-gray-900">{formatCurrency(portfolioSummary.current_value)}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="text-2xl">🎯</div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Average ROI</dt>
                          <dd className={`text-lg font-medium ${portfolioSummary.average_roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercentage(portfolioSummary.average_roi)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Data Table */}
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Market Analysis</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Current market data for selected filters
                  </p>
                </div>
                <div className="overflow-x-auto">
                  {isMarketLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : marketError ? (
                    <div className="text-center py-8 text-red-600">
                      Error loading market data
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Price/sqm</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rental Yield</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Investment Score</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">12M Growth</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {marketAnalysisData?.market_data?.map((market) => (
                          <tr key={market.market_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {market.location.city}, {market.location.country}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                              {market.property_type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              €{market.average_price_per_sqm.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatPercentage(market.average_rental_yield)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                market.investment_score >= 8 ? 'bg-green-100 text-green-800' :
                                market.investment_score >= 6 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {market.investment_score}/api/10
                              </span>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                              market.price_growth_12m >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatPercentage(market.price_growth_12m)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <div className="space-y-6">
              {/* Portfolio Summary */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Portfolio Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border-l-4 border-blue-400 pl-4">
                      <p className="text-sm font-medium text-gray-500">Total Return</p>
                      <p className={`text-2xl font-bold ${portfolioSummary.total_return_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(portfolioSummary.total_return_percentage)}
                      </p>
                    </div>
                    <div className="border-l-4 border-green-400 pl-4">
                      <p className="text-sm font-medium text-gray-500">Annual Income</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(portfolioSummary.annual_income)}</p>
                    </div>
                    <div className="border-l-4 border-purple-400 pl-4">
                      <p className="text-sm font-medium text-gray-500">Portfolio Value</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(portfolioSummary.current_value)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Investments */}
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Individual Investments</h3>
                </div>
                {isPortfolioLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : portfolioAnalytics && portfolioAnalytics.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {portfolioAnalytics.map((investment) => (
                      <li key={investment.analytics_id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900">Property {investment.property_id}</p>
                              <div className="flex space-x-4">
                                <span className="text-sm text-gray-500">
                                  Purchase: {formatCurrency(investment.purchase_price || 0)}
                                </span>
                                <span className="text-sm text-gray-500">
                                  Current: {formatCurrency(investment.current_value || 0)}
                                </span>
                                <span className={`text-sm font-medium ${
                                  (investment.roi_percentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  ROI: {formatPercentage(investment.roi_percentage || 0)}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex space-x-6 text-sm text-gray-500">
                                <span>Annual Income: {formatCurrency(investment.annual_rental_income)}</span>
                                <span>Occupancy: {formatPercentage(investment.occupancy_rate)}</span>
                                <span>Yield: {formatPercentage(investment.rental_yield || 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No investments tracked yet</p>
                    <Link
                      to="/search"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Find Investment Properties
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ROI Calculator Tab */}
          {activeTab === 'calculator' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calculator Inputs */}
                <div className="bg-white shadow sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Investment Calculator</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Purchase Price ({userCurrency})</label>
                        <input
                          type="number"
                          value={calculatorInputs.purchasePrice}
                          onChange={(e) => handleCalculatorInputChange('purchasePrice', e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="250000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Current Value ({userCurrency})</label>
                        <input
                          type="number"
                          value={calculatorInputs.currentValue}
                          onChange={(e) => handleCalculatorInputChange('currentValue', e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="280000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Annual Rental Income ({userCurrency})</label>
                        <input
                          type="number"
                          value={calculatorInputs.annualIncome}
                          onChange={(e) => handleCalculatorInputChange('annualIncome', e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="20000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Annual Expenses ({userCurrency})</label>
                        <input
                          type="number"
                          value={calculatorInputs.annualExpenses}
                          onChange={(e) => handleCalculatorInputChange('annualExpenses', e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="5000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Occupancy Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={calculatorInputs.occupancyRate}
                          onChange={(e) => handleCalculatorInputChange('occupancyRate', e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="85"
                        />
                      </div>
                      <button
                        onClick={clearCalculator}
                        className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                </div>

                {/* Calculator Results */}
                <div className="bg-white shadow sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Calculation Results</h3>
                    {calculatedROI ? (
                      <div className="space-y-4">
                        <div className="border-l-4 border-green-400 pl-4">
                          <p className="text-sm font-medium text-gray-500">Net Annual Income</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(calculatedROI.netIncome)}</p>
                        </div>
                        <div className="border-l-4 border-blue-400 pl-4">
                          <p className="text-sm font-medium text-gray-500">Capital Appreciation</p>
                          <p className={`text-xl font-bold ${calculatedROI.capitalGain >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(calculatedROI.capitalGain)}
                          </p>
                        </div>
                        <div className="border-l-4 border-purple-400 pl-4">
                          <p className="text-sm font-medium text-gray-500">Total Return</p>
                          <p className={`text-xl font-bold ${calculatedROI.totalReturn >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                            {formatCurrency(calculatedROI.totalReturn)}
                          </p>
                        </div>
                        <div className="border-l-4 border-yellow-400 pl-4">
                          <p className="text-sm font-medium text-gray-500">ROI Percentage</p>
                          <p className={`text-2xl font-bold ${calculatedROI.roiPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercentage(calculatedROI.roiPercentage)}
                          </p>
                        </div>
                        <div className="border-l-4 border-indigo-400 pl-4">
                          <p className="text-sm font-medium text-gray-500">Rental Yield</p>
                          <p className="text-xl font-bold text-indigo-600">{formatPercentage(calculatedROI.rentalYield)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">Enter investment details to see calculations</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Market Analysis Tab */}
          {activeTab === 'market' && (
            <div className="space-y-6">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Comparative Market Analysis</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Detailed market analysis for hot climate real estate investments
                  </p>
                  
                  {isMarketLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : marketAnalysisData?.market_data && marketAnalysisData.market_data.length > 0 ? (
                    <div className="space-y-8">
                      {marketAnalysisData.market_data.map((market) => (
                        <div key={market.market_id} className="border border-gray-200 rounded-lg p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-lg font-medium text-gray-900">
                                {market.location.city}, {market.location.country}
                              </h4>
                              <p className="text-sm text-gray-500 capitalize">{market.property_type} Properties</p>
                            </div>
                            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                              market.investment_score >= 8 ? 'bg-green-100 text-green-800' :
                              market.investment_score >= 6 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              Score: {market.investment_score}/api/10
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-500">Price per sqm</p>
                              <p className="text-lg font-semibold text-gray-900">€{market.average_price_per_sqm.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-500">Rental Yield</p>
                              <p className="text-lg font-semibold text-gray-900">{formatPercentage(market.average_rental_yield)}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-500">12M Growth</p>
                              <p className={`text-lg font-semibold ${market.price_growth_12m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPercentage(market.price_growth_12m)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-500">24M Growth</p>
                              <p className={`text-lg font-semibold ${market.price_growth_24m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPercentage(market.price_growth_24m)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <div className="flex space-x-6 text-sm text-gray-500">
                                <span>Demand Score: {market.rental_demand_score}/api/10</span>
                                <span>Liquidity: {market.market_liquidity}</span>
                                <span>Foreign Ownership: {market.foreign_ownership_allowed ? 'Allowed' : 'Restricted'}</span>
                              </div>
                              <Link
                                to={`/search?country=${market.location.country.toLowerCase()}&property_type=${market.property_type}`}
                                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                              >
                                View Properties →
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No market data available for selected filters</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Legal Information Tab */}
          {activeTab === 'legal' && (
            <div className="space-y-6">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Legal & Regulatory Information</h3>
                  
                  {marketAnalysisData?.market_data && marketAnalysisData.market_data.length > 0 ? (
                    <div className="space-y-8">
                      {marketAnalysisData.market_data.map((market) => (
                        <div key={market.market_id} className="border border-gray-200 rounded-lg p-6">
                          <h4 className="text-lg font-medium text-gray-900 mb-4">
                            {market.location.country} - {market.location.city}
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-2">Tax Information</h5>
                              <ul className="text-sm text-gray-600 space-y-1">
                                <li>Property Tax: {formatPercentage(market.property_tax_rate)}</li>
                                <li>Rental Tax: {formatPercentage(market.rental_tax_rate)}</li>
                              </ul>
                            </div>
                            
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-2">Ownership Rules</h5>
                              <p className="text-sm text-gray-600">
                                Foreign Ownership: {market.foreign_ownership_allowed ? 'Permitted' : 'Restricted'}
                              </p>
                            </div>
                          </div>
                          
                          {market.legal_requirements && market.legal_requirements.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-sm font-medium text-gray-900 mb-2">Legal Requirements</h5>
                              <ul className="text-sm text-gray-600 space-y-1">
                                {market.legal_requirements.map((requirement, index) => (
                                  <li key={index} className="flex items-start">
                                    <span className="text-blue-500 mr-2">•</span>
                                    {requirement}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Select market filters to view legal information</p>
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <p className="text-blue-700 text-sm">
                          <strong>Disclaimer:</strong> This information is for general guidance only. 
                          Always consult with qualified legal professionals before making investment decisions.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Additional Legal Resources */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Legal Resources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Documentation Checklist</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Passport and ID verification</li>
                        <li>• Proof of income and assets</li>
                        <li>• Tax residency certificate</li>
                        <li>• Bank statements and financing</li>
                        <li>• Property inspection reports</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Professional Services</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• International tax advisors</li>
                        <li>• Real estate lawyers</li>
                        <li>• Property management companies</li>
                        <li>• Currency exchange services</li>
                        <li>• Insurance providers</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_InvestmentAnalytics;