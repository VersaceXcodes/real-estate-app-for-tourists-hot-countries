import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

interface PasswordResetPayload {
  email: string;
}



const UV_Authentication: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL parameter handling
  const modeParam = searchParams.get('mode') || 'login';
  const redirectParam = searchParams.get('redirect_to');

  // Local state variables based on datamap
  const [authMode, setAuthMode] = useState<string>(modeParam);
  const [redirectUrl] = useState<string | null>(redirectParam);
  
  const [authFormData, setAuthFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    user_type: 'guest' as 'guest' | 'host' | 'admin',
    currency: 'USD',
    language: 'en',
    temperature_unit: 'celsius' as 'celsius' | 'fahrenheit',
    notification_settings: { email: true, sms: false, push: true },
    terms_accepted: false,
    newsletter_subscribe: false,
  });
  
  const [loginCredentials, setLoginCredentials] = useState({
    email: '',
    password: '',
    remember_me: false,
  });
  

  
  const [passwordResetData, setPasswordResetData] = useState({
    email: '',
    reset_sent: false,
    token_valid: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // CRITICAL: Individual Zustand selectors to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const authLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const authError = useAppStore(state => state.authentication_state.error_message);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const loginUser = useAppStore(state => state.login_user);
  const registerUser = useAppStore(state => state.register_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);

  // Update mode when URL parameter changes
  useEffect(() => {
    setAuthMode(modeParam);
    clearAuthError();
  }, [modeParam, clearAuthError]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const destination = redirectUrl || '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, currentUser, redirectUrl, navigate]);

  // Password reset mutation
  const passwordResetMutation = useMutation({
    mutationFn: async (payload: PasswordResetPayload) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/reset-password`,
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    },
    onSuccess: () => {
      setPasswordResetData(prev => ({ ...prev, reset_sent: true }));
    },
    onError: (error: any) => {
      console.error('Password reset error:', error);
    }
  });



  // Password strength calculator
  const calculatePasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    return strength;
  };

  // Handle mode switching
  const switchMode = (newMode: string) => {
    setAuthMode(newMode);
    clearAuthError();
    navigate(`/auth?mode=${newMode}${redirectUrl ? `&redirect_to=${encodeURIComponent(redirectUrl)}` : ''}`);
  };

  // Handle login form submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    
    try {
      await loginUser(loginCredentials.email, loginCredentials.password);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Handle registration form submission
  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    
    if (!authFormData.terms_accepted) {
      return;
    }
    
    try {
      await registerUser({
        email: authFormData.email,
        password: authFormData.password,
        first_name: authFormData.first_name,
        last_name: authFormData.last_name,
        phone_number: authFormData.phone_number || undefined,
        user_type: authFormData.user_type,
        currency: authFormData.currency,
        language: authFormData.language,
        temperature_unit: authFormData.temperature_unit,
      });
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  // Handle password reset submission
  const handlePasswordResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordResetData.email) {
      passwordResetMutation.mutate({ email: passwordResetData.email });
    }
  };

  // Handle social login
  const handleSocialLogin = (provider: 'google' | 'facebook' | 'apple') => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const redirectParam = redirectUrl ? `&redirect_to=${encodeURIComponent(redirectUrl)}` : '';
    window.location.href = `${baseUrl}/api/auth/${provider}?${redirectParam}`;
  };

  // Update password strength when password changes
  useEffect(() => {
    if (authMode === 'register') {
      setPasswordStrength(calculatePasswordStrength(authFormData.password));
    }
  }, [authFormData.password, authMode]);

  // Clear error when switching between forms
  const handleInputChange = (field: string, value: any) => {
    clearAuthError();
    if (authMode === 'login') {
      setLoginCredentials(prev => ({ ...prev, [field]: value }));
    } else if (authMode === 'register') {
      setAuthFormData(prev => ({ ...prev, [field]: value }));
    } else if (authMode === 'reset') {
      setPasswordResetData(prev => ({ ...prev, [field]: value }));
    }
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 25) return 'bg-red-500';
    if (strength < 50) return 'bg-orange-500';
    if (strength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = (strength: number): string => {
    if (strength < 25) return 'Weak';
    if (strength < 50) return 'Fair';
    if (strength < 75) return 'Good';
    return 'Strong';
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <Link to="/" className="inline-block">
              <h1 className="text-3xl font-bold text-orange-600">SunVillas</h1>
            </Link>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              {authMode === 'login' && 'Sign in to your account'}
              {authMode === 'register' && 'Create your account'}
              {authMode === 'reset' && 'Reset your password'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {authMode === 'login' && (
                <>
                  Or{' '}
                  <button
                    onClick={() => switchMode('register')}
                    className="font-medium text-orange-600 hover:text-orange-500"
                  >
                    create a new account
                  </button>
                </>
              )}
              {authMode === 'register' && (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    className="font-medium text-orange-600 hover:text-orange-500"
                  >
                    Sign in
                  </button>
                </>
              )}
              {authMode === 'reset' && (
                <>
                  Remember your password?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    className="font-medium text-orange-600 hover:text-orange-500"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Social Login Buttons (only for login and register) */}
          {(authMode === 'login' || authMode === 'register') && (
            <div className="space-y-3">
              <button
                onClick={() => handleSocialLogin('google')}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={() => handleSocialLogin('facebook')}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <svg className="w-5 h-5 mr-2" fill="#1877F2" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continue with Facebook
              </button>

              <button
                onClick={() => handleSocialLogin('apple')}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <svg className="w-5 h-5 mr-2" fill="#000000" viewBox="0 0 24 24">
                  <path d="M12.017 0C8.396 0 8.001.01 7.544.048 4.548.204 2.25 2.526 2.097 5.544.059 6.001.049 6.396.049 10.017c0 3.621.01 4.016.048 4.473.153 3.018 2.475 5.34 5.493 5.493.457.038.852.048 4.473.048 3.621 0 4.016-.01 4.473-.048 3.018-.153 5.34-2.475 5.493-5.493.038-.457.048-.852.048-4.473 0-3.621-.01-4.016-.048-4.473C21.874 2.526 19.552.204 16.534.051 16.077.013 15.682.003 12.061.003h-.044zm-2.708 7.86c-.012-.025-.02-.048-.02-.048-.128-.024-.257-.036-.39-.036-.507 0-.978.18-1.309.503-.49.48-.805 1.22-.805 1.918 0 .698.315 1.438.805 1.918.331.323.802.503 1.309.503.133 0 .262-.012.39-.036 0 0 .008-.023.02-.048l-.02.048c.128.024.257.036.39.036.507 0 .978-.18 1.309-.503.49-.48.805-1.22.805-1.918 0-.698-.315-1.438-.805-1.918-.331-.323-.802-.503-1.309-.503-.133 0-.262.012-.39.036z"/>
                </svg>
                Continue with Apple
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with email</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md" role="alert" aria-live="polite">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{authError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          {authMode === 'login' && (
            <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginCredentials.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={loginCredentials.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={loginCredentials.remember_me}
                      onChange={(e) => handleInputChange('remember_me', e.target.checked)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                      Remember me
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-sm text-orange-600 hover:text-orange-500"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Registration Form */}
          {authMode === 'register' && (
            <form className="mt-8 space-y-6" onSubmit={handleRegistrationSubmit}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
                      First name
                    </label>
                    <input
                      id="first-name"
                      name="first-name"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={authFormData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                      placeholder="John"
                    />
                  </div>

                  <div>
                    <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">
                      Last name
                    </label>
                    <input
                      id="last-name"
                      name="last-name"
                      type="text"
                      autoComplete="family-name"
                      required
                      value={authFormData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="register-email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={authFormData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700">
                    Phone number (optional)
                  </label>
                  <input
                    id="phone-number"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={authFormData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label htmlFor="register-password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={authFormData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {authFormData.password && (
                    <div className="mt-2">
                      <div className="flex items-center">
                        <div className="flex-1">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength)}`}
                              style={{ width: `${passwordStrength}%` }} />
                          </div>
                        </div>
                        <div className="ml-2 text-xs text-gray-500">
                          {getPasswordStrengthText(passwordStrength)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Password must be at least 8 characters long
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="user-type" className="block text-sm font-medium text-gray-700">
                    I want to
                  </label>
                  <select
                    id="user-type"
                    name="user-type"
                    value={authFormData.user_type}
                    onChange={(e) => handleInputChange('user_type', e.target.value as 'guest' | 'host')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  >
                    <option value="guest">Book vacation rentals</option>
                    <option value="host">List my property</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      id="terms-accepted"
                      name="terms-accepted"
                      type="checkbox"
                      required
                      checked={authFormData.terms_accepted}
                      onChange={(e) => handleInputChange('terms_accepted', e.target.checked)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="terms-accepted" className="ml-2 block text-sm text-gray-900">
                      I agree to the{' '}
                      <Link to="/terms" className="text-orange-600 hover:text-orange-500">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="text-orange-600 hover:text-orange-500">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="newsletter-subscribe"
                      name="newsletter-subscribe"
                      type="checkbox"
                      checked={authFormData.newsletter_subscribe}
                      onChange={(e) => handleInputChange('newsletter_subscribe', e.target.checked)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="newsletter-subscribe" className="ml-2 block text-sm text-gray-900">
                      Send me travel tips and special offers
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={authLoading || !authFormData.terms_accepted || authFormData.password.length < 8}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Password Reset Form */}
          {authMode === 'reset' && (
            <div className="mt-8 space-y-6">
              {!passwordResetData.reset_sent ? (
                <form onSubmit={handlePasswordResetSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700">
                        Email address
                      </label>
                      <input
                        id="reset-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={passwordResetData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="submit"
                      disabled={passwordResetMutation.isPending || !passwordResetData.email}
                      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordResetMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending reset email...
                        </span>
                      ) : (
                        'Send reset email'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Reset email sent</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        We've sent a password reset link to {passwordResetData.email}. 
                        Please check your email and follow the instructions to reset your password.
                      </p>
                    </div>
                    <div className="mt-5">
                      <button
                        onClick={() => switchMode('login')}
                        className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-orange-600 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                      >
                        Return to sign in
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Protected by SSL encryption. Your data is secure.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Authentication;