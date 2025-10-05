import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

interface BookingContext {
  booking_id: string;
  property_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  nights: number;
  base_price: number;
  cleaning_fee: number;
  service_fee: number;
  taxes_and_fees: number;
  total_price: number;
  currency: string;
  booking_status: string;
  property?: {
    title: string;
    city: string;
    country: string;
  };
}

interface PaymentFormData {
  booking_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id: string | null;
}

interface PaymentMethod {
  method_id: string;
  method_type: string;
  display_name: string;
  is_available: boolean;
  processing_fee: number;
}

interface BillingAddress {
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface CardDetails {
  card_number: string;
  cardholder_name: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
}

interface TransactionStatus {
  is_processing: boolean;
  payment_step: number;
  processing_stage: string;
  error_message: string | null;
  requires_3ds: boolean;
  redirect_url: string | null;
}

const UV_PaymentProcessing: React.FC = () => {
  const { booking_id } = useParams<{ booking_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Global state access
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const userCurrency = useAppStore(state => state.user_preferences.currency);
  const setPaymentProcessing = useAppStore(state => state.set_payment_processing);
  const setBookingError = useAppStore(state => state.set_booking_error);

  // Local state
  const [currentStep, setCurrentStep] = useState<number>(parseInt(searchParams.get('step') || '1'));
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({
    booking_id: booking_id || '',
    amount: 0,
    currency: userCurrency,
    payment_method: '',
    transaction_id: null
  });
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: ''
  });
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    card_number: '',
    cardholder_name: '',
    expiry_month: '',
    expiry_year: '',
    cvv: ''
  });
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>({
    is_processing: false,
    payment_step: 1,
    processing_stage: 'idle',
    error_message: null,
    requires_3ds: false,
    redirect_url: null
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);

  // Available payment methods (mock data since endpoint is missing)
  const paymentMethods: PaymentMethod[] = [
    {
      method_id: 'credit_card',
      method_type: 'credit_card',
      display_name: 'Credit/Debit Card',
      is_available: true,
      processing_fee: 0
    },
    {
      method_id: 'paypal',
      method_type: 'paypal',
      display_name: 'PayPal',
      is_available: true,
      processing_fee: 2.9
    },
    {
      method_id: 'bank_transfer',
      method_type: 'bank_transfer',
      display_name: 'Bank Transfer',
      is_available: true,
      processing_fee: 0
    }
  ];

  // Fetch booking context
  const { data: bookingContext, isLoading: bookingLoading, error: bookingError } = useQuery({
    queryKey: ['booking', booking_id],
    queryFn: async (): Promise<BookingContext> => {
      if (!booking_id || !authToken) {
        throw new Error('Missing booking ID or authentication');
      }
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${booking_id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    },
    enabled: !!booking_id && !!authToken,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentFormData) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/payments`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onMutate: () => {
      setTransactionStatus(prev => ({
        ...prev,
        is_processing: true,
        processing_stage: 'processing',
        error_message: null
      }));
      setPaymentProcessing(true);
    },
    onSuccess: () => {
      setTransactionStatus(prev => ({
        ...prev,
        is_processing: false,
        processing_stage: 'completed',
        error_message: null
      }));
      setPaymentProcessing(false);
      setCurrentStep(3);
      updateUrlStep(3);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Payment processing failed';
      setTransactionStatus(prev => ({
        ...prev,
        is_processing: false,
        processing_stage: 'failed',
        error_message: errorMessage
      }));
      setPaymentProcessing(false);
      setBookingError(errorMessage);
    }
  });

  // Update URL step
  const updateUrlStep = useCallback((step: number) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('step', step.toString());
      return newParams;
    });
  }, [setSearchParams]);

  // Initialize form data when booking context loads
  useEffect(() => {
    if (bookingContext) {
      setPaymentFormData(prev => ({
        ...prev,
        booking_id: bookingContext.booking_id,
        amount: bookingContext.total_price,
        currency: bookingContext.currency
      }));
    }
  }, [bookingContext]);

  // Validate payment form
  const validatePaymentForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (currentStep === 1 && !paymentFormData.payment_method) {
      errors.payment_method = 'Please select a payment method';
    }

    if (currentStep === 2) {
      if (paymentFormData.payment_method === 'credit_card') {
        if (!cardDetails.card_number) {
          errors.card_number = 'Card number is required';
        } else if (!/^\d{13,19}$/.test(cardDetails.card_number.replace(/\s/g, ''))) {
          errors.card_number = 'Invalid card number format';
        }

        if (!cardDetails.cardholder_name) {
          errors.cardholder_name = 'Cardholder name is required';
        }

        if (!cardDetails.expiry_month || !cardDetails.expiry_year) {
          errors.expiry = 'Expiry date is required';
        }

        if (!cardDetails.cvv) {
          errors.cvv = 'CVV is required';
        } else if (!/^\d{3,4}$/.test(cardDetails.cvv)) {
          errors.cvv = 'Invalid CVV format';
        }
      }

      if (!billingAddress.street_address) {
        errors.street_address = 'Street address is required';
      }

      if (!billingAddress.city) {
        errors.city = 'City is required';
      }

      if (!billingAddress.postal_code) {
        errors.postal_code = 'Postal code is required';
      }

      if (!billingAddress.country) {
        errors.country = 'Country is required';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStep, paymentFormData.payment_method, cardDetails, billingAddress]);

  // Handle payment method selection
  const handlePaymentMethodSelect = (methodId: string) => {
    setPaymentFormData(prev => ({
      ...prev,
      payment_method: methodId
    }));
    setFormErrors(prev => ({ ...prev, payment_method: '' }));
  };

  // Handle step navigation
  const handleNextStep = () => {
    if (validatePaymentForm()) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      updateUrlStep(nextStep);
    }
  };

  const handlePrevStep = () => {
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    updateUrlStep(prevStep);
  };

  // Handle payment submission
  const handlePaymentSubmit = () => {
    if (validatePaymentForm() && bookingContext) {
      processPaymentMutation.mutate(paymentFormData);
    }
  };

  // Handle retry payment
  const handleRetryPayment = () => {
    setTransactionStatus(prev => ({
      ...prev,
      error_message: null,
      processing_stage: 'idle'
    }));
    setBookingError(null);
    setCurrentStep(2);
    updateUrlStep(2);
  };

  // Redirect if not authenticated or no booking ID
  if (!currentUser || !authToken || !booking_id) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">You need to be logged in to access payment processing.</p>
            <Link
              to="/auth?mode=login"
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </>
    );
  }

// Loading state
  if (bookingLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payment information...</p>
          </div>
        </div>
      </>
    );
  }

// Error state
  if (bookingError || !bookingContext) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Payment Error</h2>
            <p className="text-gray-600 mb-6">
              Unable to load booking information. Please try again or contact support.
            </p>
            <div className="space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <Link
                to="/dashboard"
                className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
            <p className="text-gray-600">Secure payment processing for your booking</p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-4">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        step <= currentStep
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {step}
                    </div>
                    {step < 3 && (
                      <div
                        className={`w-16 h-1 ${
                          step < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                        }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-2 max-w-xs mx-auto">
              <span>Payment Method</span>
              <span>Payment Details</span>
              <span>Confirmation</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Payment Content */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6">
                {/* Step 1: Payment Method Selection */}
                {currentStep === 1 && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Select Payment Method</h2>
                    
                    <div className="space-y-4">
                      {paymentMethods.map((method) => (
                        <div key={method.method_id} className="relative">
                          <button
                            onClick={() => handlePaymentMethodSelect(method.method_id)}
                            className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                              paymentFormData.payment_method === method.method_id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center">
                                  {method.method_type === 'credit_card' && (
                                    <span className="text-xs font-bold">CARD</span>
                                  )}
                                  {method.method_type === 'paypal' && (
                                    <span className="text-xs font-bold text-blue-600">PP</span>
                                  )}
                                  {method.method_type === 'bank_transfer' && (
                                    <span className="text-xs font-bold">BANK</span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{method.display_name}</p>
                                  {method.processing_fee > 0 && (
                                    <p className="text-sm text-gray-500">
                                      Processing fee: {method.processing_fee}%
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full border-2 ${
                                  paymentFormData.payment_method === method.method_id
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-gray-300'
                                }`}
                              >
                                {paymentFormData.payment_method === method.method_id && (
                                  <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>

                    {formErrors.payment_method && (
                      <p className="text-red-600 text-sm mt-2">{formErrors.payment_method}</p>
                    )}

                    {/* Security Features */}
                    <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h3 className="font-medium text-green-800 mb-2">Your payment is secure</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-green-700">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          SSL Encrypted
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          PCI DSS Compliant
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Fraud Protection
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleNextStep}
                        disabled={!paymentFormData.payment_method}
                        className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Continue to Payment Details
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Payment Details */}
                {currentStep === 2 && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Details</h2>

                    {/* Credit Card Form */}
                    {paymentFormData.payment_method === 'credit_card' && (
                      <div className="space-y-6">
                        <div>
                          <label htmlFor="card_number" className="block text-sm font-medium text-gray-700 mb-1">
                            Card Number
                          </label>
                          <input
                            type="text"
                            id="card_number"
                            value={cardDetails.card_number}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              const formattedValue = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                              setCardDetails(prev => ({ ...prev, card_number: formattedValue }));
                              setFormErrors(prev => ({ ...prev, card_number: '' }));
                            }}
                            placeholder="1234 5678 9012 3456"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              formErrors.card_number ? 'border-red-500' : 'border-gray-300'
                            }`} />
                          {formErrors.card_number && (
                            <p className="text-red-600 text-sm mt-1">{formErrors.card_number}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="cardholder_name" className="block text-sm font-medium text-gray-700 mb-1">
                            Cardholder Name
                          </label>
                          <input
                            type="text"
                            id="cardholder_name"
                            value={cardDetails.cardholder_name}
                            onChange={(e) => {
                              setCardDetails(prev => ({ ...prev, cardholder_name: e.target.value }));
                              setFormErrors(prev => ({ ...prev, cardholder_name: '' }));
                            }}
                            placeholder="John Doe"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              formErrors.cardholder_name ? 'border-red-500' : 'border-gray-300'
                            }`} />
                          {formErrors.cardholder_name && (
                            <p className="text-red-600 text-sm mt-1">{formErrors.cardholder_name}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label htmlFor="expiry_month" className="block text-sm font-medium text-gray-700 mb-1">
                              Month
                            </label>
                            <select
                              id="expiry_month"
                              value={cardDetails.expiry_month}
                              onChange={(e) => {
                                setCardDetails(prev => ({ ...prev, expiry_month: e.target.value }));
                                setFormErrors(prev => ({ ...prev, expiry: '' }));
                              }}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.expiry ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">MM</option>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <option key={month} value={month.toString().padStart(2, '0')}>
                                  {month.toString().padStart(2, '0')}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="expiry_year" className="block text-sm font-medium text-gray-700 mb-1">
                              Year
                            </label>
                            <select
                              id="expiry_year"
                              value={cardDetails.expiry_year}
                              onChange={(e) => {
                                setCardDetails(prev => ({ ...prev, expiry_year: e.target.value }));
                                setFormErrors(prev => ({ ...prev, expiry: '' }));
                              }}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.expiry ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">YYYY</option>
                              {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() + i).map(year => (
                                <option key={year} value={year.toString()}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                              CVV
                            </label>
                            <input
                              type="text"
                              id="cvv"
                              value={cardDetails.cvv}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                setCardDetails(prev => ({ ...prev, cvv: value }));
                                setFormErrors(prev => ({ ...prev, cvv: '' }));
                              }}
                              placeholder="123"
                              maxLength={4}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.cvv ? 'border-red-500' : 'border-gray-300'
                              }`} />
                            {formErrors.cvv && (
                              <p className="text-red-600 text-sm mt-1">{formErrors.cvv}</p>
                            )}
                          </div>
                        </div>
                        {formErrors.expiry && (
                          <p className="text-red-600 text-sm">{formErrors.expiry}</p>
                        )}
                      </div>
                    )}

                    {/* PayPal Info */}
                    {paymentFormData.payment_method === 'paypal' && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-800">
                          You will be redirected to PayPal to complete your payment securely.
                        </p>
                      </div>
                    )}

                    {/* Bank Transfer Info */}
                    {paymentFormData.payment_method === 'bank_transfer' && (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-gray-800 mb-2">
                          Bank transfer instructions will be provided after confirmation.
                        </p>
                        <p className="text-sm text-gray-600">
                          Please note: Bank transfers may take 3-5 business days to process.
                        </p>
                      </div>
                    )}

                    {/* Billing Address */}
                    <div className="mt-8">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Billing Address</h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="street_address" className="block text-sm font-medium text-gray-700 mb-1">
                            Street Address
                          </label>
                          <input
                            type="text"
                            id="street_address"
                            value={billingAddress.street_address}
                            onChange={(e) => {
                              setBillingAddress(prev => ({ ...prev, street_address: e.target.value }));
                              setFormErrors(prev => ({ ...prev, street_address: '' }));
                            }}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              formErrors.street_address ? 'border-red-500' : 'border-gray-300'
                            }`} />
                          {formErrors.street_address && (
                            <p className="text-red-600 text-sm mt-1">{formErrors.street_address}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              id="city"
                              value={billingAddress.city}
                              onChange={(e) => {
                                setBillingAddress(prev => ({ ...prev, city: e.target.value }));
                                setFormErrors(prev => ({ ...prev, city: '' }));
                              }}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.city ? 'border-red-500' : 'border-gray-300'
                              }`} />
                            {formErrors.city && (
                              <p className="text-red-600 text-sm mt-1">{formErrors.city}</p>
                            )}
                          </div>
                          <div>
                            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                              State/Province
                            </label>
                            <input
                              type="text"
                              id="state"
                              value={billingAddress.state}
                              onChange={(e) => setBillingAddress(prev => ({ ...prev, state: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-1">
                              Postal Code
                            </label>
                            <input
                              type="text"
                              id="postal_code"
                              value={billingAddress.postal_code}
                              onChange={(e) => {
                                setBillingAddress(prev => ({ ...prev, postal_code: e.target.value }));
                                setFormErrors(prev => ({ ...prev, postal_code: '' }));
                              }}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.postal_code ? 'border-red-500' : 'border-gray-300'
                              }`} />
                            {formErrors.postal_code && (
                              <p className="text-red-600 text-sm mt-1">{formErrors.postal_code}</p>
                            )}
                          </div>
                          <div>
                            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                              Country
                            </label>
                            <select
                              id="country"
                              value={billingAddress.country}
                              onChange={(e) => {
                                setBillingAddress(prev => ({ ...prev, country: e.target.value }));
                                setFormErrors(prev => ({ ...prev, country: '' }));
                              }}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                formErrors.country ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select Country</option>
                              <option value="US">United States</option>
                              <option value="CA">Canada</option>
                              <option value="GB">United Kingdom</option>
                              <option value="AU">Australia</option>
                              <option value="DE">Germany</option>
                              <option value="FR">France</option>
                              <option value="ES">Spain</option>
                              <option value="IT">Italy</option>
                              <option value="NL">Netherlands</option>
                              <option value="SE">Sweden</option>
                            </select>
                            {formErrors.country && (
                              <p className="text-red-600 text-sm mt-1">{formErrors.country}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Payment Method */}
                    {paymentFormData.payment_method === 'credit_card' && (
                      <div className="mt-6">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={savePaymentMethod}
                            onChange={(e) => setSavePaymentMethod(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Save this payment method for future bookings
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="mt-8 flex justify-between">
                      <button
                        onClick={handlePrevStep}
                        className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleNextStep}
                        className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Review Payment
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Confirmation */}
                {currentStep === 3 && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Confirmation</h2>

                    {transactionStatus.is_processing && (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Processing your payment...</p>
                        <p className="text-sm text-gray-500 mt-2">Please do not close this window</p>
                      </div>
                    )}

                    {transactionStatus.processing_stage === 'failed' && transactionStatus.error_message && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-medium text-red-800 mb-2">Payment Failed</h3>
                        <p className="text-red-700 mb-4">{transactionStatus.error_message}</p>
                        <div className="space-x-4">
                          <button
                            onClick={handleRetryPayment}
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                          >
                            Try Again
                          </button>
                          <button
                            onClick={() => {
                              setCurrentStep(1);
                              updateUrlStep(1);
                            }}
                            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                          >
                            Change Payment Method
                          </button>
                        </div>
                      </div>
                    )}

                    {transactionStatus.processing_stage === 'completed' && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h3>
                        <p className="text-gray-600 mb-6">
                          Your booking has been confirmed and you will receive a confirmation email shortly.
                        </p>
                        <div className="space-x-4">
                          <Link
                            to="/dashboard"
                            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors inline-block"
                          >
                            View My Bookings
                          </Link>
                          <button
                            onClick={() => window.print()}
                            className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
                          >
                            Print Receipt
                          </button>
                        </div>
                      </div>
                    )}

                    {!transactionStatus.is_processing && transactionStatus.processing_stage === 'idle' && (
                      <div>
                        <div className="bg-gray-50 rounded-lg p-6 mb-6">
                          <h3 className="font-medium text-gray-900 mb-4">Payment Summary</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Payment Method:</span>
                              <span className="font-medium">
                                {paymentMethods.find(m => m.method_id === paymentFormData.payment_method)?.display_name}
                              </span>
                            </div>
                            {paymentFormData.payment_method === 'credit_card' && (
                              <div className="flex justify-between">
                                <span>Card:</span>
                                <span className="font-medium">
                                  •••• •••• •••• {cardDetails.card_number.slice(-4)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Amount:</span>
                              <span className="font-medium">
                                {paymentFormData.currency} {paymentFormData.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <button
                            onClick={handlePrevStep}
                            className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
                          >
                            Back
                          </button>
                          <button
                            onClick={handlePaymentSubmit}
                            disabled={transactionStatus.is_processing}
                            className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Complete Payment
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Booking Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
                
                {bookingContext.property && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900">{bookingContext.property.title}</h4>
                    <p className="text-sm text-gray-600">
                      {bookingContext.property.city}, {bookingContext.property.country}
                    </p>
                  </div>
                )}

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Check-in:</span>
                    <span className="font-medium">
                      {new Date(bookingContext.check_in_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Check-out:</span>
                    <span className="font-medium">
                      {new Date(bookingContext.check_out_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Guests:</span>
                    <span className="font-medium">{bookingContext.guest_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nights:</span>
                    <span className="font-medium">{bookingContext.nights}</span>
                  </div>
                </div>

                <hr className="my-4" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Base Price:</span>
                    <span>{bookingContext.currency} {bookingContext.base_price.toFixed(2)}</span>
                  </div>
                  {bookingContext.cleaning_fee > 0 && (
                    <div className="flex justify-between">
                      <span>Cleaning Fee:</span>
                      <span>{bookingContext.currency} {bookingContext.cleaning_fee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Service Fee:</span>
                    <span>{bookingContext.currency} {bookingContext.service_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes & Fees:</span>
                    <span>{bookingContext.currency} {bookingContext.taxes_and_fees.toFixed(2)}</span>
                  </div>
                </div>

                <hr className="my-4" />

                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{bookingContext.currency} {bookingContext.total_price.toFixed(2)}</span>
                </div>

                {/* Cancellation Policy */}
                <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    <strong>Cancellation Policy:</strong> Free cancellation until 24 hours before check-in. 
                    50% refund for cancellations within 24 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PaymentProcessing;