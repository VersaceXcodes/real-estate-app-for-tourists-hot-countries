import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import ErrorBoundary from '@/components/ErrorBoundary';

// Import all required view components
import GV_TopNav from '@/components/views/GV_TopNav';
import GV_Footer from '@/components/views/GV_Footer';
import GV_MobileNav from '@/components/views/GV_MobileNav';
import GV_NotificationPanel from '@/components/views/GV_NotificationPanel';

import UV_Landing from '@/components/views/UV_Landing';
import UV_SearchResults from '@/components/views/UV_SearchResults';
import UV_PropertyDetail from '@/components/views/UV_PropertyDetail';
import UV_BookingFlow from '@/components/views/UV_BookingFlow';
import UV_UserDashboard from '@/components/views/UV_UserDashboard';
import UV_PropertyManagement from '@/components/views/UV_PropertyManagement';
import UV_MessageCenter from '@/components/views/UV_MessageCenter';
import UV_UserProfile from '@/components/views/UV_UserProfile';
import UV_Authentication from '@/components/views/UV_Authentication';
import UV_InvestmentAnalytics from '@/components/views/UV_InvestmentAnalytics';
import UV_LocalGuides from '@/components/views/UV_LocalGuides';
import UV_ReviewSubmission from '@/components/views/UV_ReviewSubmission';
import UV_PaymentProcessing from '@/components/views/UV_PaymentProcessing';

// Configure React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading component for auth initialization
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    <p className="ml-3 text-gray-600">Loading SunVillas...</p>
  </div>
);

// Protected Route wrapper component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CRITICAL: Individual selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth?mode=login" replace />;
  }
  
  return <>{children}</>;
};

// Layout wrapper with universal global components
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-gray-50">
    <GV_TopNav />
    <GV_MobileNav />
    <main className="flex-1 relative">
      {children}
    </main>
    <GV_Footer />
    <GV_NotificationPanel />
  </div>
);

const App: React.FC = () => {
  // CRITICAL: Individual selectors, no object destructuring
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const initializeAuth = useAppStore(state => state.initialize_auth);
  
  useEffect(() => {
    // Initialize auth state when app loads
    initializeAuth();
  }, [initializeAuth]);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return (
    <ErrorBoundary>
      <Router>
        <QueryClientProvider client={queryClient}>
          <AppLayout>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<UV_Landing />} />
            
            {/* Authentication Route - redirect if already authenticated */}
            <Route 
              path="/auth" 
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <UV_Authentication />
                )
              } 
            />
            
            {/* Public Search and Property Routes */}
            <Route path="/search" element={<UV_SearchResults />} />
            <Route path="/property/:property_id" element={<UV_PropertyDetail />} />
            
            {/* Destination Guides - Public Routes */}
            <Route path="/destinations" element={<UV_LocalGuides />} />
            <Route path="/destinations/:destination_slug" element={<UV_LocalGuides />} />
            
            {/* Protected Booking and Payment Routes */}
            <Route 
              path="/book/:property_id" 
              element={
                <ProtectedRoute>
                  <UV_BookingFlow />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/payment/:booking_id" 
              element={
                <ProtectedRoute>
                  <UV_PaymentProcessing />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected User Management Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <UV_UserDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <UV_UserProfile />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected Property Management Routes */}
            <Route 
              path="/host" 
              element={
                <ProtectedRoute>
                  <UV_PropertyManagement />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/host/property/:property_id" 
              element={
                <ProtectedRoute>
                  <UV_PropertyManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected Communication Routes */}
            <Route 
              path="/messages" 
              element={
                <ProtectedRoute>
                  <UV_MessageCenter />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/messages/:conversation_id" 
              element={
                <ProtectedRoute>
                  <UV_MessageCenter />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected Investment Routes */}
            <Route 
              path="/investments" 
              element={
                <ProtectedRoute>
                  <UV_InvestmentAnalytics />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected Review Routes */}
            <Route 
              path="/review/:booking_id" 
              element={
                <ProtectedRoute>
                  <UV_ReviewSubmission />
                </ProtectedRoute>
              } 
            />
            
            {/* Catch all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </QueryClientProvider>
    </Router>
    </ErrorBoundary>
  );
};

export default App;