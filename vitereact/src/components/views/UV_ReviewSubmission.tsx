import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Types based on Zod schemas
interface BookingReference {
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
  total_price: number;
  currency: string;
  booking_status: string;
  created_at: string;
  property?: {
    property_id: string;
    title: string;
    property_type: string;
    country: string;
    city: string;
    address: string;
    owner_id: string;
    base_price_per_night: number;
    currency: string;
    average_rating?: number;
    review_count: number;
  };
}

interface ReviewFormData {
  booking_id: string;
  property_id: string;
  reviewer_id: string;
  overall_rating: number;
  cleanliness_rating: number;
  accuracy_rating: number;
  communication_rating: number;
  location_rating: number;
  checkin_rating: number;
  value_rating: number;
  review_text: string;
  review_photos: string[];
  is_anonymous: boolean;
}

interface SubmissionStatus {
  is_submitting: boolean;
  is_submitted: boolean;
  validation_errors: string[];
  submission_error: string | null;
  can_submit: boolean;
}

interface PhotoUploads {
  uploading_photos: string[];
  uploaded_photos: string[];
  upload_errors: string[];
}

// Star Rating Component
const StarRating: React.FC<{
  rating: number;
  onRatingChange: (rating: number) => void;
  label: string;
  description?: string;
  required?: boolean;
}> = ({ rating, onRatingChange, label, description, required = true }) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <span className="text-sm text-gray-500">{rating > 0 ? `${rating} star${rating !== 1 ? 's' : ''}` : 'Not rated'}</span>
      </div>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`w-8 h-8 transition-colors ${
              star <= (hoverRating || rating)
                ? 'text-yellow-400'
                : 'text-gray-300'
            } hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded`}
            onClick={() => onRatingChange(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''} for ${label}`}
          >
            <svg className="w-full h-full fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};

// Photo Upload Component
const PhotoUpload: React.FC<{
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  uploading: string[];
  errors: string[];
}> = ({ photos, onPhotosChange, uploading, errors }) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelection(files);
  };

  const handleFileSelection = (files: File[]) => {
    const maxPhotos = 10;
    const availableSlots = maxPhotos - photos.length;
    const filesToProcess = files.slice(0, availableSlots);

    filesToProcess.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            onPhotosChange([...photos, e.target.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    onPhotosChange(newPhotos);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Add Photos (Optional)</h3>
        <span className="text-sm text-gray-500">{photos.length}/api/10 photos</span>
      </div>
      
      <p className="text-sm text-gray-600">
        Help future guests by sharing photos of your experience. You can upload up to 10 photos.
      </p>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : photos.length >= 10
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {photos.length >= 10 ? (
          <p className="text-gray-500">Maximum number of photos reached</p>
        ) : (
          <>
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-4">
              <label htmlFor="photo-upload" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-500 font-medium">Upload photos</span>
                <span className="text-gray-500"> or drag and drop</span>
                <input
                  id="photo-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFileSelection(Array.from(e.target.files));
                    }
                  }} />
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF up to 10MB each</p>
          </>
        )}
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo}
                alt={`Review photo ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-sm text-red-700">
            <strong>Photo upload errors:</strong>
            <ul className="mt-1 list-disc list-inside">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const UV_ReviewSubmission: React.FC = () => {
  const { booking_id } = useParams<{ booking_id: string }>();
  const navigate = useNavigate();
  
  // Individual Zustand selectors to avoid infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Local state
  const [reviewFormData, setReviewFormData] = useState<ReviewFormData>({
    booking_id: booking_id || '',
    property_id: '',
    reviewer_id: currentUser?.user_id || '',
    overall_rating: 0,
    cleanliness_rating: 0,
    accuracy_rating: 0,
    communication_rating: 0,
    location_rating: 0,
    checkin_rating: 0,
    value_rating: 0,
    review_text: '',
    review_photos: [],
    is_anonymous: false,
  });

  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    is_submitting: false,
    is_submitted: false,
    validation_errors: [],
    submission_error: null,
    can_submit: false,
  });

  const [photoUploads, setPhotoUploads] = useState<PhotoUploads>({
    uploading_photos: [],
    uploaded_photos: [],
    upload_errors: [],
  });

  const [showPreview, setShowPreview] = useState(false);

  // Fetch booking data
  const { data: bookingData, isLoading: isLoadingBooking, error: bookingError } = useQuery({
    queryKey: ['booking', booking_id],
    queryFn: async (): Promise<BookingReference> => {
      if (!booking_id || !authToken) {
        throw new Error('Missing booking ID or authentication');
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/bookings/${booking_id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    enabled: !!booking_id && !!authToken,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: ReviewFormData) => {
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/reviews`,
        reviewData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onMutate: () => {
      setSubmissionStatus(prev => ({ ...prev, is_submitting: true, submission_error: null }));
    },
    onSuccess: () => {
      setSubmissionStatus(prev => ({ ...prev, is_submitting: false, is_submitted: true }));
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit review';
      setSubmissionStatus(prev => ({
        ...prev,
        is_submitting: false,
        submission_error: errorMessage
      }));
    }
  });

  // Update form data when booking loads
  useEffect(() => {
    if (bookingData && currentUser) {
      setReviewFormData(prev => ({
        ...prev,
        booking_id: bookingData.booking_id,
        property_id: bookingData.property_id,
        reviewer_id: currentUser.user_id,
      }));
    }
  }, [bookingData, currentUser]);

  // Validate form
  useEffect(() => {
    const errors: string[] = [];
    
    if (reviewFormData.overall_rating === 0) errors.push('Overall rating is required');
    if (reviewFormData.cleanliness_rating === 0) errors.push('Cleanliness rating is required');
    if (reviewFormData.accuracy_rating === 0) errors.push('Accuracy rating is required');
    if (reviewFormData.communication_rating === 0) errors.push('Communication rating is required');
    if (reviewFormData.location_rating === 0) errors.push('Location rating is required');
    if (reviewFormData.checkin_rating === 0) errors.push('Check-in rating is required');
    if (reviewFormData.value_rating === 0) errors.push('Value rating is required');
    
    if (reviewFormData.review_text.length < 50) {
      errors.push('Review text must be at least 50 characters');
    }
    if (reviewFormData.review_text.length > 1000) {
      errors.push('Review text must be no more than 1000 characters');
    }

    const canSubmit = errors.length === 0;
    
    setSubmissionStatus(prev => ({
      ...prev,
      validation_errors: errors,
      can_submit: canSubmit
    }));
  }, [reviewFormData]);

  // Update rating
  const updateRating = (category: keyof ReviewFormData, rating: number) => {
    setReviewFormData(prev => ({ ...prev, [category]: rating }));
  };

  // Update review text
  const updateReviewText = (text: string) => {
    setReviewFormData(prev => ({ ...prev, review_text: text }));
  };

  // Update photos
  const updatePhotos = (photos: string[]) => {
    setReviewFormData(prev => ({ ...prev, review_photos: photos }));
  };

  // Submit review
  const handleSubmitReview = async () => {
    if (!submissionStatus.can_submit) return;
    
    await submitReviewMutation.mutateAsync(reviewFormData);
  };

  // Loading state
  if (isLoadingBooking) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading booking details...</p>
          </div>
        </div>
      </>
    );
  }

// Error state
  if (bookingError || !bookingData) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking Not Found</h2>
            <p className="text-gray-600 mb-6">
              We couldn't find this booking or you don't have permission to review it.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

// Success state
  if (submissionStatus.is_submitted) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Review Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Thank you for sharing your experience. Your review helps build trust in our community.
            </p>
            <div className="space-y-3">
              <Link
                to="/dashboard"
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Dashboard
              </Link>
              <Link
                to={`/property/${bookingData.property_id}`}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                View Property
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

// Preview mode
  if (showPreview) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h1 className="text-xl font-semibold text-gray-900">Review Preview</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Please review your submission before publishing
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Property Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900">{bookingData.property?.title}</h3>
                  <p className="text-sm text-gray-600">{bookingData.property?.city}, {bookingData.property?.country}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Stay: {new Date(bookingData.check_in_date).toLocaleDateString()} - {new Date(bookingData.check_out_date).toLocaleDateString()}
                  </p>
                </div>

                {/* Overall Rating */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Overall Rating</h4>
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-5 h-5 ${star <= reviewFormData.overall_rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">{reviewFormData.overall_rating} stars</span>
                  </div>
                </div>

                {/* Category Ratings */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Category Ratings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'cleanliness_rating', label: 'Cleanliness' },
                      { key: 'accuracy_rating', label: 'Accuracy' },
                      { key: 'communication_rating', label: 'Communication' },
                      { key: 'location_rating', label: 'Location' },
                      { key: 'checkin_rating', label: 'Check-in' },
                      { key: 'value_rating', label: 'Value' },
                    ].map((category) => (
                      <div key={category.key} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{category.label}</span>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`w-4 h-4 ${star <= reviewFormData[category.key as keyof ReviewFormData] ? 'text-yellow-400' : 'text-gray-300'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Review Text */}
                {reviewFormData.review_text && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Written Review</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{reviewFormData.review_text}</p>
                    </div>
                  </div>
                )}

                {/* Photos */}
                {reviewFormData.review_photos.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Photos ({reviewFormData.review_photos.length})</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {reviewFormData.review_photos.map((photo, index) => (
                        <img
                          key={index}
                          src={photo}
                          alt={`Review photo ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Anonymous Option */}
                {reviewFormData.is_anonymous && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Anonymous Review:</strong> Your name will not be displayed with this review.
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back to Edit
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={submissionStatus.is_submitting || !submissionStatus.can_submit}
                  className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submissionStatus.is_submitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Publishing...
                    </span>
                  ) : (
                    'Publish Review'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

// Main form
  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">Write a Review</h1>
              <p className="text-sm text-gray-600 mt-1">
                Share your experience to help future guests and improve our community
              </p>
            </div>

            <div className="p-6 space-y-8">
              {/* Booking Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900">{bookingData.property?.title}</h3>
                <p className="text-sm text-blue-700">{bookingData.property?.city}, {bookingData.property?.country}</p>
                <p className="text-xs text-blue-600 mt-1">
                  Your stay: {new Date(bookingData.check_in_date).toLocaleDateString()} - {new Date(bookingData.check_out_date).toLocaleDateString()} • {bookingData.nights} night{bookingData.nights !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Review Invitation */}
              <div className="text-center py-4">
                <h2 className="text-lg font-medium text-gray-900 mb-2">How was your stay?</h2>
                <p className="text-gray-600">
                  Your honest feedback helps build trust in our community and helps other guests make informed decisions.
                </p>
              </div>

              {/* Overall Rating */}
              <div className="space-y-4">
                <StarRating
                  rating={reviewFormData.overall_rating}
                  onRatingChange={(rating) => updateRating('overall_rating', rating)}
                  label="Overall Experience"
                  description="How would you rate your overall experience?"
                />
              </div>

              {/* Category Ratings */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Rate Your Experience</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <StarRating
                    rating={reviewFormData.cleanliness_rating}
                    onRatingChange={(rating) => updateRating('cleanliness_rating', rating)}
                    label="Cleanliness"
                    description="How clean was the property?"
                  />
                  
                  <StarRating
                    rating={reviewFormData.accuracy_rating}
                    onRatingChange={(rating) => updateRating('accuracy_rating', rating)}
                    label="Accuracy"
                    description="How accurate was the listing description?"
                  />
                  
                  <StarRating
                    rating={reviewFormData.communication_rating}
                    onRatingChange={(rating) => updateRating('communication_rating', rating)}
                    label="Communication"
                    description="How was communication with the host?"
                  />
                  
                  <StarRating
                    rating={reviewFormData.location_rating}
                    onRatingChange={(rating) => updateRating('location_rating', rating)}
                    label="Location"
                    description="How was the location and neighborhood?"
                  />
                  
                  <StarRating
                    rating={reviewFormData.checkin_rating}
                    onRatingChange={(rating) => updateRating('checkin_rating', rating)}
                    label="Check-in"
                    description="How smooth was the check-in process?"
                  />
                  
                  <StarRating
                    rating={reviewFormData.value_rating}
                    onRatingChange={(rating) => updateRating('value_rating', rating)}
                    label="Value"
                    description="How was the value for money?"
                  />
                </div>
              </div>

              {/* Written Review */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="review-text" className="text-lg font-medium text-gray-900">
                    Tell us about your experience <span className="text-red-500">*</span>
                  </label>
                  <span className="text-sm text-gray-500">
                    {reviewFormData.review_text.length}/api/1000 characters
                  </span>
                </div>
                
                <p className="text-sm text-gray-600">
                  Help other guests by sharing specific details about your stay. What did you love? What could be improved?
                </p>
                
                <textarea
                  id="review-text"
                  rows={6}
                  value={reviewFormData.review_text}
                  onChange={(e) => updateReviewText(e.target.value)}
                  placeholder="Tell future guests about your experience. Was the property as described? How was the host? What made your stay special?"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    reviewFormData.review_text.length < 50 || reviewFormData.review_text.length > 1000
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                  maxLength={1000} />
                
                <div className="text-xs text-gray-500">
                  Minimum 50 characters required. Be specific and helpful for future guests.
                </div>
              </div>

              {/* Photo Upload */}
              <PhotoUpload
                photos={reviewFormData.review_photos}
                onPhotosChange={updatePhotos}
                uploading={photoUploads.uploading_photos}
                errors={photoUploads.upload_errors} />

              {/* Review Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Review Options</h3>
                
                <div className="flex items-start space-x-3">
                  <input
                    id="anonymous"
                    type="checkbox"
                    checked={reviewFormData.is_anonymous}
                    onChange={(e) => setReviewFormData(prev => ({ ...prev, is_anonymous: e.target.checked }))}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div>
                    <label htmlFor="anonymous" className="text-sm font-medium text-gray-700">
                      Submit anonymously
                    </label>
                    <p className="text-xs text-gray-500">
                      Your name won't be displayed with this review, but it will still be helpful to other guests.
                    </p>
                  </div>
                </div>
              </div>

              {/* Review Guidelines */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Review Guidelines</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Be honest and constructive in your feedback</li>
                  <li>• Focus on your personal experience during the stay</li>
                  <li>• Avoid personal information about yourself or others</li>
                  <li>• Keep photos appropriate and relevant to your stay</li>
                  <li>• Help other guests by being specific and detailed</li>
                </ul>
              </div>

              {/* Validation Errors */}
              {submissionStatus.validation_errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="text-sm text-red-700">
                    <strong>Please complete the following:</strong>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      {submissionStatus.validation_errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Submission Error */}
              {submissionStatus.submission_error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="text-sm text-red-700">
                    <strong>Error:</strong> {submissionStatus.submission_error}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
              <Link
                to="/dashboard"
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </Link>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  disabled={!submissionStatus.can_submit}
                  className="px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Preview Review
                </button>
                
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={submissionStatus.is_submitting || !submissionStatus.can_submit}
                  className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submissionStatus.is_submitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    'Submit Review'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_ReviewSubmission;