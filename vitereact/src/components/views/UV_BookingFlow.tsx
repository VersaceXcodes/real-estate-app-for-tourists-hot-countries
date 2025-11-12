import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Types for the component
interface BookingData {
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
  special_requests: string;
}

interface GuestInformation {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  special_requests: string;
  travel_purpose: string;
  accessibility_needs: string;
}

interface PaymentInformation {
  payment_method: string;
  amount: number;
  currency: string;
  payment_schedule: string;
  billing_address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

interface PropertySummary {
  property_id: string;
  title: string;
  country: string;
  city: string;
  address: string;
  check_in_time: string;
  check_out_time: string;
  cancellation_policy: string;
  house_rules: string[];
  base_price_per_night: number;
  cleaning_fee: number;
  currency: string;
  minimum_stay: number;
}

interface BookingConfirmation {
  booking_id: string;
  booking_status: string;
  payment_status: string;
  confirmation_number: string;
  check_in_instructions: string;
  access_code: string;
  host_contact: {
    name: string;
    email: string;
    phone: string;
  };
}

interface ValidationErrors {
  step1: string[];
  step2: string[];
  step3: string[];
  step4: string[];
}

interface ProcessingStatus {
  is_creating_booking: boolean;
  is_processing_payment: boolean;
  availability_checked: boolean;
}

const UV_BookingFlow: React.FC = () => {
  const { property_id } = useParams<{ property_id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract URL parameters
  const check_in_date = searchParams.get('check_in_date') || '';
  const check_out_date = searchParams.get('check_out_date') || '';
  const guest_count = parseInt(searchParams.get('guest_count') || '1');
  const adults = parseInt(searchParams.get('adults') || '1');
  const children = parseInt(searchParams.get('children') || '0');
  const infants = parseInt(searchParams.get('infants') || '0');
  const step = parseInt(searchParams.get('step') || '1');

  // Global state access with individual selectors
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const userCurrency = useAppStore(state => state.user_preferences.currency);
  const setCurrentBooking = useAppStore(state => state.set_current_booking);
  const updateBookingStep = useAppStore(state => state.update_booking_step);
  const setBookingError = useAppStore(state => state.set_booking_error);

  // Local state management
  const [currentStep, setCurrentStep] = useState(step);
  const [bookingData, setBookingData] = useState<BookingData>({
    property_id: property_id || '',
    guest_id: currentUser?.user_id || '',
    check_in_date,
    check_out_date,
    guest_count,
    adults,
    children,
    infants,
    nights: 0,
    base_price: 0,
    cleaning_fee: 0,
    service_fee: 0,
    taxes_and_fees: 0,
    total_price: 0,
    currency: userCurrency,
    special_requests: ''
  });

  const [guestInformation, setGuestInformation] = useState<GuestInformation>({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    special_requests: '',
    travel_purpose: '',
    accessibility_needs: ''
  });

  const [paymentInformation, setPaymentInformation] = useState<PaymentInformation>({
    payment_method: '',
    amount: 0,
    currency: userCurrency,
    payment_schedule: 'full',
    billing_address: {
      street: '',
      city: '',
      state: '',
      postal_code: '',
      country: ''
    }
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    step1: [],
    step2: [],
    step3: [],
    step4: []
  });

  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    is_creating_booking: false,
    is_processing_payment: false,
    availability_checked: false
  });

  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null);

  // Calculate nights
  const nights = useMemo(() => {
    if (check_in_date && check_out_date) {
      const checkIn = new Date(check_in_date);
      const checkOut = new Date(check_out_date);
      return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    }
    return 0;
  }, [check_in_date, check_out_date]);

  // Fetch property information
  const { data: propertyData, isLoading: propertyLoading, error: propertyError } = useQuery({
    queryKey: ['property', property_id],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties/${property_id}`
      );
      return response.data;
    },
    enabled: !!property_id,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Extract property summary
  const propertySummary: PropertySummary | null = useMemo(() => {
    if (!propertyData) return null;
    
    return {
      property_id: propertyData.property_id,
      title: propertyData.title,
      country: propertyData.country,
      city: propertyData.city,
      address: propertyData.address,
      check_in_time: propertyData.check_in_time,
      check_out_time: propertyData.check_out_time,
      cancellation_policy: propertyData.cancellation_policy,
      house_rules: propertyData.house_rules || [],
      base_price_per_night: propertyData.base_price_per_night,
      cleaning_fee: propertyData.cleaning_fee || 0,
      currency: propertyData.currency,
      minimum_stay: propertyData.minimum_stay || 1
    };
  }, [propertyData]);

  // Calculate pricing
  const pricing = useMemo(() => {
    if (!propertySummary || nights === 0) return null;

    const basePrice = propertySummary.base_price_per_night * nights;
    const cleaningFee = propertySummary.cleaning_fee;
    const serviceFee = basePrice * 0.1; // 10% service fee
    const taxesAndFees = basePrice * 0.06; // 6% taxes
    const extraGuestFee = guest_count > 4 ? (guest_count - 4) * 25 * nights : 0; // $25 per extra guest per night
    
    const totalPrice = basePrice + cleaningFee + serviceFee + taxesAndFees + extraGuestFee;

    return {
      nights,
      base_price: basePrice,
      cleaning_fee: cleaningFee,
      service_fee: serviceFee,
      taxes_and_fees: taxesAndFees,
      extra_guest_fee: extraGuestFee,
      total_price: totalPrice,
      currency: propertySummary.currency
    };
  }, [propertySummary, nights, guest_count]);

  // Check availability
  useQuery({
    queryKey: ['availability', property_id, check_in_date, check_out_date],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/properties/${property_id}/api/availability`,
        {
          params: {
            start_date: check_in_date,
            end_date: check_out_date
          }
        }
      );
      return response.data;
    },
    enabled: !!property_id && !!check_in_date && !!check_out_date,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1
  });

  // Prefill guest information if authenticated
  useEffect(() => {
    if (currentUser && currentStep === 2) {
      setGuestInformation(prev => ({
        ...prev,
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
        phone_number: currentUser.phone_number || '',
        emergency_contact_name: currentUser.emergency_contact_name || '',
        emergency_contact_phone: currentUser.emergency_contact_phone || ''
      }));
    }
  }, [currentUser, currentStep]);

  // Update booking data with pricing
  useEffect(() => {
    if (pricing) {
      setBookingData(prev => ({
        ...prev,
        nights: pricing.nights,
        base_price: pricing.base_price,
        cleaning_fee: pricing.cleaning_fee,
        service_fee: pricing.service_fee,
        taxes_and_fees: pricing.taxes_and_fees,
        total_price: pricing.total_price,
        currency: pricing.currency
      }));
    }
  }, [pricing]);

  // Update payment amount
  useEffect(() => {
    if (pricing) {
      setPaymentInformation(prev => ({
        ...prev,
        amount: pricing.total_price,
        currency: pricing.currency
      }));
    }
  }, [pricing]);

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingPayload: any) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings`,
        bookingPayload,
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
      setCurrentBooking(data);
      setBookingConfirmation({
        booking_id: data.booking_id,
        booking_status: data.booking_status,
        payment_status: data.payment_status,
        confirmation_number: `SV${data.booking_id.slice(-8).toUpperCase()}`,
        check_in_instructions: data.check_in_instructions || 'Check-in instructions will be sent 24 hours before arrival.',
        access_code: data.access_code || '',
        host_contact: {
          name: 'Property Host',
          email: 'host@sunvillas.com',
          phone: '+1-555-SUNVILLAS'
        }
      });
      setCurrentStep(4);
      updateSearchParams(4);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to create booking';
      setBookingError(errorMessage);
      setValidationErrors(prev => ({
        ...prev,
        step3: [errorMessage]
      }));
    }
  });

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async (paymentPayload: any) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/payments`,
        paymentPayload,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      // Payment successful, booking is now confirmed
      if (bookingConfirmation) {
        setBookingConfirmation(prev => prev ? {
          ...prev,
          payment_status: 'completed'
        } : null);
      }
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Payment failed';
      setValidationErrors(prev => ({
        ...prev,
        step3: [errorMessage]
      }));
    }
  });

  // Update URL search params
  const updateSearchParams = useCallback((newStep: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('step', newStep.toString());
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    const errors: string[] = [];

    switch (currentStep) {
      case 1:
        if (!check_in_date) errors.push('Check-in date is required');
        if (!check_out_date) errors.push('Check-out date is required');
        if (!guest_count || guest_count < 1) errors.push('At least 1 guest is required');
        if (nights < 1) errors.push('Stay must be at least 1 night');
        if (propertySummary && nights < propertySummary.minimum_stay) {
          errors.push(`Minimum stay is ${propertySummary.minimum_stay} nights`);
        }
        break;

      case 2:
        if (!guestInformation.first_name.trim()) errors.push('First name is required');
        if (!guestInformation.last_name.trim()) errors.push('Last name is required');
        if (!guestInformation.email.trim()) errors.push('Email is required');
        if (!/\S+@\S+\.\S+/.test(guestInformation.email)) errors.push('Valid email is required');
        if (!guestInformation.phone_number.trim()) errors.push('Phone number is required');
        break;

      case 3:
        if (!paymentInformation.payment_method) errors.push('Payment method is required');
        if (!paymentInformation.billing_address.street.trim()) errors.push('Billing address is required');
        if (!paymentInformation.billing_address.city.trim()) errors.push('City is required');
        if (!paymentInformation.billing_address.postal_code.trim()) errors.push('Postal code is required');
        if (!paymentInformation.billing_address.country.trim()) errors.push('Country is required');
        break;

      default:
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [`step${currentStep}`]: errors
    }));

    return errors.length === 0;
  }, [currentStep, check_in_date, check_out_date, guest_count, nights, propertySummary, guestInformation, paymentInformation]);

  // Navigate to next step
  const handleNextStep = useCallback(() => {
    if (validateCurrentStep()) {
      if (currentStep < 4) {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        updateSearchParams(nextStep);
        updateBookingStep(nextStep);
      }
    }
  }, [currentStep, validateCurrentStep, updateSearchParams, updateBookingStep]);

  // Navigate to previous step
  const handlePrevStep = useCallback(() => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      updateSearchParams(prevStep);
      updateBookingStep(prevStep);
    }
  }, [currentStep, updateSearchParams, updateBookingStep]);

  // Handle booking submission
  const handleCreateBooking = useCallback(async () => {
    if (!validateCurrentStep() || !isAuthenticated) return;

    setProcessingStatus(prev => ({ ...prev, is_creating_booking: true }));

    try {
      const bookingPayload = {
        property_id: bookingData.property_id,
        guest_id: currentUser?.user_id,
        check_in_date: bookingData.check_in_date,
        check_out_date: bookingData.check_out_date,
        guest_count: bookingData.guest_count,
        adults: bookingData.adults,
        children: bookingData.children,
        infants: bookingData.infants,
        special_requests: guestInformation.special_requests
      };

      const booking = await createBookingMutation.mutateAsync(bookingPayload);

      // Process payment immediately
      if (booking) {
        const paymentPayload = {
          booking_id: booking.booking_id,
          amount: bookingData.total_price,
          currency: bookingData.currency,
          payment_method: paymentInformation.payment_method
        };

        await processPaymentMutation.mutateAsync(paymentPayload);
      }
    } catch (error) {
      console.error('Booking creation failed:', error);
    } finally {
      setProcessingStatus(prev => ({ ...prev, is_creating_booking: false }));
    }
  }, [validateCurrentStep, isAuthenticated, bookingData, currentUser, guestInformation, paymentInformation, createBookingMutation, processPaymentMutation]);

  // Render Step 1: Booking Details
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Summary</h3>
        {propertySummary && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900">{propertySummary.title}</h4>
              <p className="text-gray-600">{propertySummary.address}, {propertySummary.city}, {propertySummary.country}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Check-in:</span>
                <p className="font-medium">{check_in_date} at {propertySummary.check_in_time}</p>
              </div>
              <div>
                <span className="text-gray-500">Check-out:</span>
                <p className="font-medium">{check_out_date} at {propertySummary.check_out_time}</p>
              </div>
            </div>
            
            <div className="text-sm">
              <span className="text-gray-500">Guests:</span>
              <p className="font-medium">{guest_count} guests ({adults} adults{children > 0 && `, ${children} children`}{infants > 0 && `, ${infants} infants`})</p>
            </div>
          </div>
        )}
      </div>

      {pricing && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>${propertySummary?.base_price_per_night} × {nights} nights</span>
              <span>${pricing.base_price.toFixed(2)}</span>
            </div>
            {pricing.cleaning_fee > 0 && (
              <div className="flex justify-between">
                <span>Cleaning fee</span>
                <span>${pricing.cleaning_fee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Service fee</span>
              <span>${pricing.service_fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxes and fees</span>
              <span>${pricing.taxes_and_fees.toFixed(2)}</span>
            </div>
            {pricing.extra_guest_fee > 0 && (
              <div className="flex justify-between">
                <span>Extra guest fee</span>
                <span>${pricing.extra_guest_fee.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-3 flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>${pricing.total_price.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Special Requests</h3>
        <textarea
          value={bookingData.special_requests}
          onChange={(e) => setBookingData(prev => ({ ...prev, special_requests: e.target.value }))}
          placeholder="Any special requests or notes for the host..."
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={4} />
      </div>

      {propertySummary && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancellation Policy</h3>
          <p className="text-gray-700 mb-4">{propertySummary.cancellation_policy} cancellation</p>
          
          <h4 className="font-medium text-gray-900 mb-2">House Rules</h4>
          <ul className="text-gray-700 space-y-1">
            {propertySummary.house_rules.map((rule, index) => (
              <li key={index}>• {rule}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  // Render Step 2: Guest Information
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Guest Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              value={guestInformation.first_name}
              onChange={(e) => setGuestInformation(prev => ({ ...prev, first_name: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              value={guestInformation.last_name}
              onChange={(e) => setGuestInformation(prev => ({ ...prev, last_name: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={guestInformation.email}
              onChange={(e) => setGuestInformation(prev => ({ ...prev, email: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              value={guestInformation.phone_number}
              onChange={(e) => setGuestInformation(prev => ({ ...prev, phone_number: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Emergency Contact Name
            </label>
            <input
              type="text"
              value={guestInformation.emergency_contact_name}
              onChange={(e) => setGuestInformation(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Emergency Contact Phone
            </label>
            <input
              type="tel"
              value={guestInformation.emergency_contact_phone}
              onChange={(e) => setGuestInformation(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Travel Purpose
            </label>
            <select
              value={guestInformation.travel_purpose}
              onChange={(e) => setGuestInformation(prev => ({ ...prev, travel_purpose: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select purpose</option>
              <option value="vacation">Vacation</option>
              <option value="business">Business</option>
              <option value="family_visit">Family Visit</option>
              <option value="event">Event/Wedding</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Accessibility Needs
            </label>
            <textarea
              value={guestInformation.accessibility_needs}
              onChange={(e) => setGuestInformation(prev => ({ ...prev, accessibility_needs: e.target.value }))}
              placeholder="Please describe any accessibility requirements..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3} />
          </div>
        </div>
      </div>
    </div>
  );

  // Render Step 3: Payment Processing
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="relative">
              <input
                type="radio"
                name="payment_method"
                value="credit_card"
                checked={paymentInformation.payment_method === 'credit_card'}
                onChange={(e) => setPaymentInformation(prev => ({ ...prev, payment_method: e.target.value }))}
                className="sr-only"
              />
              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                paymentInformation.payment_method === 'credit_card' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <div className="text-center">
                  <div className="text-lg font-medium">💳</div>
                  <div className="text-sm font-medium">Credit Card</div>
                </div>
              </div>
            </label>
            
            <label className="relative">
              <input
                type="radio"
                name="payment_method"
                value="paypal"
                checked={paymentInformation.payment_method === 'paypal'}
                onChange={(e) => setPaymentInformation(prev => ({ ...prev, payment_method: e.target.value }))}
                className="sr-only"
              />
              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                paymentInformation.payment_method === 'paypal' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <div className="text-center">
                  <div className="text-lg font-medium">🏦</div>
                  <div className="text-sm font-medium">PayPal</div>
                </div>
              </div>
            </label>
            
            <label className="relative">
              <input
                type="radio"
                name="payment_method"
                value="bank_transfer"
                checked={paymentInformation.payment_method === 'bank_transfer'}
                onChange={(e) => setPaymentInformation(prev => ({ ...prev, payment_method: e.target.value }))}
                className="sr-only"
              />
              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                paymentInformation.payment_method === 'bank_transfer' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <div className="text-center">
                  <div className="text-lg font-medium">🏪</div>
                  <div className="text-sm font-medium">Bank Transfer</div>
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Address</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Address *
            </label>
            <input
              type="text"
              value={paymentInformation.billing_address.street}
              onChange={(e) => setPaymentInformation(prev => ({
                ...prev,
                billing_address: { ...prev.billing_address, street: e.target.value }
              }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <input
                type="text"
                value={paymentInformation.billing_address.city}
                onChange={(e) => setPaymentInformation(prev => ({
                  ...prev,
                  billing_address: { ...prev.billing_address, city: e.target.value }
                }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State/Province *
              </label>
              <input
                type="text"
                value={paymentInformation.billing_address.state}
                onChange={(e) => setPaymentInformation(prev => ({
                  ...prev,
                  billing_address: { ...prev.billing_address, state: e.target.value }
                }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Postal Code *
              </label>
              <input
                type="text"
                value={paymentInformation.billing_address.postal_code}
                onChange={(e) => setPaymentInformation(prev => ({
                  ...prev,
                  billing_address: { ...prev.billing_address, postal_code: e.target.value }
                }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country *
              </label>
              <select
                value={paymentInformation.billing_address.country}
                onChange={(e) => setPaymentInformation(prev => ({
                  ...prev,
                  billing_address: { ...prev.billing_address, country: e.target.value }
                }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select country</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="MX">Mexico</option>
                <option value="GB">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
                <option value="GR">Greece</option>
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Schedule</h3>
        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="radio"
              name="payment_schedule"
              value="full"
              checked={paymentInformation.payment_schedule === 'full'}
              onChange={(e) => setPaymentInformation(prev => ({ ...prev, payment_schedule: e.target.value }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="text-sm font-medium">Pay in full today - ${pricing?.total_price.toFixed(2)}</span>
          </label>
          
          <label className="flex items-center space-x-3">
            <input
              type="radio"
              name="payment_schedule"
              value="split"
              checked={paymentInformation.payment_schedule === 'split'}
              onChange={(e) => setPaymentInformation(prev => ({ ...prev, payment_schedule: e.target.value }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="text-sm font-medium">
              Pay ${pricing ? (pricing.total_price * 0.5).toFixed(2) : 0} today, ${pricing ? (pricing.total_price * 0.5).toFixed(2) : 0} on arrival
            </span>
          </label>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="text-green-600">🔒</div>
          <div className="text-sm text-green-800">
            <strong>Secure Payment</strong> - Your payment information is protected with SSL encryption and PCI compliance.
          </div>
        </div>
      </div>
    </div>
  );

  // Render Step 4: Booking Confirmation
  const renderStep4 = () => (
    <div className="space-y-6">
      {bookingConfirmation && (
        <>
          <div className="text-center bg-green-50 border border-green-200 rounded-lg p-8">
            <div className="text-green-600 text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">Booking Confirmed!</h2>
            <p className="text-green-700 mb-4">
              Your reservation has been successfully created.
            </p>
            <div className="bg-white border border-green-300 rounded-lg p-4 inline-block">
              <p className="text-sm text-gray-600">Confirmation Number</p>
              <p className="text-2xl font-bold text-gray-900">{bookingConfirmation.confirmation_number}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Property:</span>
                  <p className="font-medium">{propertySummary?.title}</p>
                </div>
                <div>
                  <span className="text-gray-500">Location:</span>
                  <p className="font-medium">{propertySummary?.city}, {propertySummary?.country}</p>
                </div>
                <div>
                  <span className="text-gray-500">Check-in:</span>
                  <p className="font-medium">{check_in_date}</p>
                </div>
                <div>
                  <span className="text-gray-500">Check-out:</span>
                  <p className="font-medium">{check_out_date}</p>
                </div>
                <div>
                  <span className="text-gray-500">Guests:</span>
                  <p className="font-medium">{guest_count} guests</p>
                </div>
                <div>
                  <span className="text-gray-500">Total Paid:</span>
                  <p className="font-medium">${pricing?.total_price.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Host Contact</h3>
            <div className="space-y-2">
              <p><strong>Name:</strong> {bookingConfirmation.host_contact.name}</p>
              <p><strong>Email:</strong> {bookingConfirmation.host_contact.email}</p>
              <p><strong>Phone:</strong> {bookingConfirmation.host_contact.phone}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Check-in Instructions</h3>
            <p className="text-blue-800">{bookingConfirmation.check_in_instructions}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/dashboard"
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg text-center font-medium hover:bg-blue-700 transition-colors"
            >
              View in Dashboard
            </Link>
            <button
              onClick={() => window.print()}
              className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Print Confirmation
            </button>
          </div>
        </>
      )}
    </div>
  );

  // Handle authentication requirement
  useEffect(() => {
    if (!isAuthenticated && currentStep > 1) {
      navigate(`/auth?mode=login&redirect_to=/book/${property_id}?${searchParams.toString()}`);
    }
  }, [isAuthenticated, currentStep, navigate, property_id, searchParams]);

  // Loading state
  if (propertyLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading property information...</p>
          </div>
        </div>
      </>
    );
  }

// Error state
  if (propertyError || !propertySummary) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Property Not Found</h2>
            <p className="text-gray-600 mb-4">
              The property you're trying to book could not be found.
            </p>
            <Link
              to="/search"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Back to Search
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Booking</h1>
            <p className="text-gray-600">Secure your stay at {propertySummary.title}</p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4">
              {[1, 2, 3, 4].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                      stepNumber <= currentStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {stepNumber}
                  </div>
                  {stepNumber < 4 && (
                    <div
                      className={`h-1 w-16 ${
                        stepNumber < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                      }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-4 space-x-8 text-sm">
              <span className={currentStep >= 1 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                Details
              </span>
              <span className={currentStep >= 2 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                Guest Info
              </span>
              <span className={currentStep >= 3 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                Payment
              </span>
              <span className={currentStep >= 4 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                Confirmation
              </span>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors[`step${currentStep}` as keyof ValidationErrors].length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">Please fix the following errors:</h4>
              <ul className="text-red-700 text-sm space-y-1">
                {validationErrors[`step${currentStep}` as keyof ValidationErrors].map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Step Content */}
          <div className="mb-8">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </div>

          {/* Navigation Buttons */}
          {currentStep < 4 && (
            <div className="flex justify-between">
              <button
                onClick={handlePrevStep}
                disabled={currentStep === 1}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              {currentStep < 3 ? (
                <button
                  onClick={handleNextStep}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleCreateBooking}
                  disabled={processingStatus.is_creating_booking}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {processingStatus.is_creating_booking ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Complete Booking'
                  )}
                </button>
              )}
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <span>🔒</span>
              <span>Secure SSL Encryption</span>
              <span>•</span>
              <span>PCI Compliant</span>
              <span>•</span>
              <span>100% Secure</span>
            </div>
            <p>Your personal and payment information is protected with industry-standard security.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_BookingFlow;