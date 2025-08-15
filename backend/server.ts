import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import morgan from 'morgan';
import { Pool } from 'pg';


// Import Zod schemas
import {
  userSchema, createUserInputSchema, updateUserInputSchema, searchUsersInputSchema,
  propertySchema, createPropertyInputSchema, updatePropertyInputSchema, searchPropertiesInputSchema,
  propertyPhotoSchema, createPropertyPhotoInputSchema, updatePropertyPhotoInputSchema,
  bookingSchema, createBookingInputSchema, updateBookingInputSchema, searchBookingsInputSchema,
  paymentSchema, createPaymentInputSchema, updatePaymentInputSchema,
  reviewSchema, createReviewInputSchema, updateReviewInputSchema, searchReviewsInputSchema,
  conversationSchema, createConversationInputSchema, updateConversationInputSchema,
  messageSchema, createMessageInputSchema, updateMessageInputSchema,
  locationSchema, createLocationInputSchema, searchLocationsInputSchema,
  notificationSchema, createNotificationInputSchema, updateNotificationInputSchema, searchNotificationsInputSchema,
  savedSearchSchema, createSavedSearchInputSchema,
  investmentAnalyticsSchema, createInvestmentAnalyticsInputSchema,
  systemAlertSchema, createSystemAlertInputSchema, searchSystemAlertsInputSchema
} from './schema';

// Extend Socket interface to include user property
declare module 'socket.io' {
  interface Socket {
    user?: any;
  }
}

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

dotenv.config();

// __dirname is available in CommonJS

// Environment variables
const { 
  DATABASE_URL, 
  PGHOST, 
  PGDATABASE, 
  PGUSER, 
  PGPASSWORD, 
  PGPORT = 5432,
  JWT_SECRET = 'sunvillas-secret-key-2024',
  PORT = 3000
} = process.env;

// PostgreSQL connection setup
const pool = new Pool(
  DATABASE_URL
    ? { 
        connectionString: DATABASE_URL, 
        ssl: { rejectUnauthorized: false }      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: { rejectUnauthorized: false },
      }
);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(morgan('combined'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create storage directory if it doesn't exist
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Utility functions
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

// Error response utility
function createErrorResponse(message, error = null, errorCode = null) {
  const response: any = {
    success: false,
    message,
    error: message, // Add error field for test compatibility
    timestamp: getCurrentTimestamp()
  };

  if (errorCode) {
    response.error_code = errorCode;
  }

  if (error && process.env.NODE_ENV === 'development') {
    response.details = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return response;
}

/*
  JWT Authentication Middleware - Validates JWT tokens for protected routes
*/
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(createErrorResponse('Access token required', null, 'AUTH_TOKEN_MISSING'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT user_id, email, first_name, last_name, user_type, is_verified, is_superhost, created_at FROM users WHERE user_id = $1 AND is_active = true',
        [decoded.user_id]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json(createErrorResponse('Invalid token - user not found', null, 'AUTH_USER_NOT_FOUND'));
      }

      req.user = result.rows[0];
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json(createErrorResponse('Invalid or expired token', error, 'AUTH_TOKEN_INVALID'));
  }
};

/*
  Optional Authentication Middleware - Adds user info if token is provided but doesn't require it
*/
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT user_id, email, first_name, last_name, user_type, is_verified, is_superhost, created_at FROM users WHERE user_id = $1 AND is_active = true',
        [decoded.user_id]
      );
      
      req.user = result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      client.release();
    }
  } catch (error) {
    req.user = null;
  }
  
  next();
};

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/*
  POST /api/auth/register - Creates new user account with comprehensive profile setup
*/
app.post('/api/auth/register', async (req, res) => {
  try {
    const validatedData = createUserInputSchema.parse(req.body);
    const {
      email,
      password,
      first_name,
      last_name,
      phone_number,
      profile_photo_url,
      user_type,
      bio,
      languages_spoken,
      currency,
      language,
      temperature_unit,
      notification_settings,
      emergency_contact_name,
      emergency_contact_phone,
      address,
      date_of_birth,
      government_id_number
    } = validatedData;

    // Check if user already exists
    const client = await pool.connect();
    
    try {
      const existingUser = await client.query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json(createErrorResponse('User with this email already exists', null, 'USER_ALREADY_EXISTS'));
      }

      const user_id = generateId();
      const timestamp = getCurrentTimestamp();

      // Insert new user (NO PASSWORD HASHING - store directly for development)
      const result = await client.query(`
        INSERT INTO users (
          user_id, email, password_hash, first_name, last_name, phone_number, profile_photo_url,
          user_type, bio, languages_spoken, is_verified, is_superhost, currency, language,
          temperature_unit, notification_settings, emergency_contact_name, emergency_contact_phone,
          address, date_of_birth, government_id_number, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING user_id, email, first_name, last_name, phone_number, profile_photo_url, user_type, bio, languages_spoken, is_verified, is_superhost, currency, language, temperature_unit, is_active, created_at
      `, [
        user_id, email.toLowerCase().trim(), password, first_name, last_name, phone_number, profile_photo_url,
        user_type, bio, languages_spoken ? JSON.stringify(languages_spoken) : '[]', false, false, currency, language,
        temperature_unit, JSON.stringify(notification_settings || {}), emergency_contact_name, emergency_contact_phone,
        address, date_of_birth, government_id_number, true, timestamp, timestamp
      ]);

      const user = result.rows[0];

      // Generate JWT token
      const token = jwt.sign(
        { user_id: user.user_id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Parse JSON fields for response
      try {
        if (typeof user.languages_spoken === 'string') {
          user.languages_spoken = user.languages_spoken && user.languages_spoken.trim() !== '' && user.languages_spoken !== '[]' ? JSON.parse(user.languages_spoken) : [];
        } else if (!Array.isArray(user.languages_spoken)) {
          user.languages_spoken = [];
        }
      } catch (e) {
        user.languages_spoken = [];
      }

      res.status(201).json({
        user,
        token
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ZodError') {
      // Extract specific validation errors
      const issues = error.issues || [];
      let errorMessage = 'Invalid input data';
      
      // Check for specific field errors
      for (const issue of issues) {
        if (issue.path.includes('email')) {
          errorMessage = 'Invalid email format';
          break;
        } else if (issue.path.includes('password')) {
          errorMessage = 'Password must be at least 8 characters long';
          break;
        }
      }
      
      return res.status(400).json(createErrorResponse(errorMessage, error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/auth/login - Authenticates user with email/password and returns JWT token
*/
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(createErrorResponse('Email and password are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    const client = await pool.connect();
    
    try {
      // Find user (direct password comparison for development)
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email.toLowerCase().trim()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json(createErrorResponse('Invalid credentials', null, 'INVALID_CREDENTIALS'));
      }

      const user = result.rows[0];

      // Direct password comparison (no hashing for development)
      if (password !== user.password_hash) {
        return res.status(401).json(createErrorResponse('Invalid credentials', null, 'INVALID_CREDENTIALS'));
      }

      // Update last login timestamp
      await client.query(
        'UPDATE users SET last_login_at = $1 WHERE user_id = $2',
        [getCurrentTimestamp(), user.user_id]
      );

      // Generate JWT token
      const token = jwt.sign(
        { user_id: user.user_id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Remove sensitive data and parse JSON fields
      delete user.password_hash;
      try {
        user.languages_spoken = user.languages_spoken && user.languages_spoken.trim() !== '' && user.languages_spoken !== '[]' ? JSON.parse(user.languages_spoken) : [];
      } catch (e) {
        user.languages_spoken = [];
      }
      try {
        user.notification_settings = user.notification_settings && user.notification_settings.trim() !== '' && user.notification_settings !== '{}' ? JSON.parse(user.notification_settings) : {};
      } catch (e) {
        user.notification_settings = {};
      }

      res.json({
        user,
        token
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/auth/logout - Logs out current user session
*/
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // In a production environment, you might want to invalidate the token
    // For this implementation, we'll just return success
    res.json({
      message: 'User logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/auth/reset-password - Initiates password reset process
  @@need:external-api: Email service to send password reset emails with secure tokens
*/
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(createErrorResponse('Email is required', null, 'MISSING_EMAIL'));
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      
      // Always return success for security reasons (don't reveal if email exists)
      res.json({
        message: 'If an account with this email exists, a password reset link has been sent'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/auth/verify-email - Verifies user email address with token
  @@need:external-api: Email verification service to validate tokens
*/
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json(createErrorResponse('Verification token is required', null, 'MISSING_TOKEN'));
    }

    // Mock email verification for development
    const mockVerificationSuccess = true;

    if (mockVerificationSuccess) {
      res.json({
        message: 'Email verified successfully'
      });
    } else {
      res.status(400).json(createErrorResponse('Invalid or expired verification token', null, 'INVALID_TOKEN'));
    }
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

/*
  GET /api/users/me - Gets current authenticated user profile
*/
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE user_id = $1',
        [req.user.user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
      }

      const user = result.rows[0];
      delete user.password_hash;
      try {
        user.languages_spoken = user.languages_spoken && user.languages_spoken.trim() !== '' && user.languages_spoken !== '[]' ? JSON.parse(user.languages_spoken) : [];
      } catch (e) {
        user.languages_spoken = [];
      }
      try {
        user.notification_settings = user.notification_settings && user.notification_settings.trim() !== '' && user.notification_settings !== '{}' ? JSON.parse(user.notification_settings) : {};
      } catch (e) {
        user.notification_settings = {};
      }

      res.json(user);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/users/:user_id - Gets public user profile by ID
*/
app.get('/api/users/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT user_id, first_name, last_name, profile_photo_url, user_type, bio, 
               languages_spoken, is_verified, is_superhost, created_at 
        FROM users WHERE user_id = $1 AND is_active = true
      `, [user_id]);

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
      }

      const user = result.rows[0];
      user.languages_spoken = user.languages_spoken ? JSON.parse(user.languages_spoken) : [];

      res.json(user);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  PUT /api/users/:user_id - Updates user profile information
*/
app.put('/api/users/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    
    // Users can only update their own profile (or admins can update any profile)
    if (req.user.user_id !== user_id && req.user.user_type !== 'admin') {
      return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
    }

    const validatedData = updateUserInputSchema.parse({ user_id, ...req.body });
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    // Build dynamic update query
    const updateableFields = [
      'email', 'first_name', 'last_name', 'phone_number', 'profile_photo_url',
      'bio', 'languages_spoken', 'currency', 'language', 'temperature_unit',
      'notification_settings', 'emergency_contact_name', 'emergency_contact_phone',
      'address', 'date_of_birth', 'government_id_number'
    ];

    updateableFields.forEach(field => {
      if (validatedData[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        if (field === 'languages_spoken' || field === 'notification_settings') {
          updateValues.push(JSON.stringify(validatedData[field]));
        } else {
          updateValues.push(validatedData[field]);
        }
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    updateFields.push(`updated_at = $${paramIndex}`);
    updateValues.push(getCurrentTimestamp());
    updateValues.push(user_id);

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        UPDATE users SET ${updateFields.join(', ')} 
        WHERE user_id = $${paramIndex + 1}
        RETURNING user_id, email, first_name, last_name, phone_number, profile_photo_url, user_type, bio, languages_spoken, is_verified, is_superhost, currency, language, temperature_unit, notification_settings, emergency_contact_name, emergency_contact_phone, address, date_of_birth, government_id_number, created_at, updated_at
      `, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
      }

      const user = result.rows[0];
      user.languages_spoken = user.languages_spoken ? JSON.parse(user.languages_spoken) : [];
      user.notification_settings = user.notification_settings ? JSON.parse(user.notification_settings) : {};

      res.json(user);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/users/:user_id/verification - Submits user verification documents
*/
app.post('/api/users/:user_id/verification', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { verification_type, document_url } = req.body;

    if (req.user.user_id !== user_id) {
      return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
    }

    if (!verification_type || !document_url) {
      return res.status(400).json(createErrorResponse('Verification type and document URL are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    const client = await pool.connect();
    
    try {
      const verification_id = generateId();
      const timestamp = getCurrentTimestamp();

      await client.query(`
        INSERT INTO user_verification (verification_id, user_id, verification_type, document_url, verification_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [verification_id, user_id, verification_type, document_url, 'pending', timestamp, timestamp]);

      res.status(201).json({
        message: 'Verification document submitted successfully',
        verification_id
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/users/:user_id/favorites - Gets user's favorite properties
*/
app.get('/api/users/:user_id/favorites', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    if (req.user.user_id !== user_id) {
      return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT p.*, pp.photo_url as cover_photo_url, u.first_name, u.last_name, u.is_superhost
        FROM user_favorites uf
        JOIN properties p ON uf.property_id = p.property_id
        JOIN users u ON p.owner_id = u.user_id
        LEFT JOIN property_photos pp ON p.property_id = pp.property_id AND pp.is_cover_photo = true
        WHERE uf.user_id = $1 AND p.is_active = true
        ORDER BY uf.created_at DESC
        LIMIT $2 OFFSET $3
      `, [user_id, limit, offset]);

      const countResult = await client.query(`
        SELECT COUNT(*) FROM user_favorites uf
        JOIN properties p ON uf.property_id = p.property_id
        WHERE uf.user_id = $1 AND p.is_active = true
      `, [user_id]);

      const properties = result.rows.map(row => {
        row.amenities = row.amenities ? JSON.parse(row.amenities) : [];
        row.house_rules = row.house_rules ? JSON.parse(row.house_rules) : [];
        row.host_language = row.host_language ? JSON.parse(row.host_language) : [];
        return row;
      });

      res.json({
        favorites: properties,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/users/:user_id/favorites - Adds property to user's favorites
*/
app.post('/api/users/:user_id/favorites', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { property_id } = req.body;

    if (req.user.user_id !== user_id) {
      return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
    }

    if (!property_id) {
      return res.status(400).json(createErrorResponse('Property ID is required', null, 'MISSING_PROPERTY_ID'));
    }

    const client = await pool.connect();
    
    try {
      // Check if property exists
      const propertyResult = await client.query('SELECT property_id FROM properties WHERE property_id = $1', [property_id]);
      if (propertyResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
      }

      // Check if already favorited
      const existingResult = await client.query(
        'SELECT favorite_id FROM user_favorites WHERE user_id = $1 AND property_id = $2',
        [user_id, property_id]
      );

      if (existingResult.rows.length > 0) {
        return res.status(409).json(createErrorResponse('Property already in favorites', null, 'ALREADY_FAVORITED'));
      }

      const favorite_id = generateId();
      await client.query(
        'INSERT INTO user_favorites (favorite_id, user_id, property_id, created_at) VALUES ($1, $2, $3, $4)',
        [favorite_id, user_id, property_id, getCurrentTimestamp()]
      );

      res.status(201).json({
        message: 'Property added to favorites',
        favorite_id
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  DELETE /api/users/:user_id/favorites/:property_id - Removes property from favorites
*/
app.delete('/api/users/:user_id/favorites/:property_id', authenticateToken, async (req, res) => {
  try {
    const { user_id, property_id } = req.params;

    if (req.user.user_id !== user_id) {
      return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'DELETE FROM user_favorites WHERE user_id = $1 AND property_id = $2',
        [user_id, property_id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json(createErrorResponse('Favorite not found', null, 'FAVORITE_NOT_FOUND'));
      }

      res.status(204).send();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// PROPERTY MANAGEMENT ENDPOINTS
// ============================================================================

/*
  GET /api/properties - Comprehensive property search with advanced filtering
*/
app.get('/api/properties', optionalAuth, async (req, res) => {
  try {
    const {
      query, destination, country, city, check_in_date, check_out_date, guest_count,
      property_type, price_min, price_max, min_bedrooms, max_bedrooms, min_bathrooms, max_bathrooms,
      amenities, instant_booking, distance_beach, distance_airport, host_language, min_rating,
      sort_by = 'created_at', sort_order = 'desc', limit = 10, offset = 0
    } = req.query;

    // Coerce query parameters to proper types
    const parsedParams = {
      query: query ? String(query) : undefined,
      destination: destination ? String(destination) : undefined,
      country: country ? String(country) : undefined,
      city: city ? String(city) : undefined,
      check_in_date: check_in_date ? String(check_in_date) : undefined,
      check_out_date: check_out_date ? String(check_out_date) : undefined,
      guest_count: guest_count ? parseInt(String(guest_count)) || undefined : undefined,
      property_type: property_type ? String(property_type) : undefined,
      price_min: price_min ? parseFloat(String(price_min)) || undefined : undefined,
      price_max: price_max ? parseFloat(String(price_max)) || undefined : undefined,
      min_bedrooms: min_bedrooms ? parseInt(String(min_bedrooms)) || undefined : undefined,
      max_bedrooms: max_bedrooms ? parseInt(String(max_bedrooms)) || undefined : undefined,
      min_bathrooms: min_bathrooms ? parseFloat(String(min_bathrooms)) || undefined : undefined,
      max_bathrooms: max_bathrooms ? parseFloat(String(max_bathrooms)) || undefined : undefined,
      amenities: amenities ? (Array.isArray(amenities) ? amenities : String(amenities).split(',')) : undefined,
      instant_booking: instant_booking ? String(instant_booking).toLowerCase() === 'true' : undefined,
      distance_beach: distance_beach ? parseFloat(String(distance_beach)) || undefined : undefined,
      distance_airport: distance_airport ? parseFloat(String(distance_airport)) || undefined : undefined,
      host_language: host_language ? String(host_language) : undefined,
      min_rating: min_rating ? parseFloat(String(min_rating)) || undefined : undefined,
      sort_by: sort_by ? String(sort_by) : 'created_at',
      sort_order: sort_order ? String(sort_order) : 'desc',
      limit: limit ? Math.min(100, Math.max(1, parseInt(String(limit)) || 10)) : 10,
      offset: offset ? Math.max(0, parseInt(String(offset)) || 0) : 0
    };

    const client = await pool.connect();
    
    try {
      let whereConditions = ['p.is_active = true'];
      let queryParams = [];
      let paramIndex = 1;

      // Build dynamic WHERE conditions using parsed parameters
      if (parsedParams.query) {
        whereConditions.push(`(p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR p.city ILIKE $${paramIndex} OR p.country ILIKE $${paramIndex})`);
        queryParams.push(`%${parsedParams.query}%`);
        paramIndex++;
      }

      if (parsedParams.country) {
        whereConditions.push(`p.country ILIKE $${paramIndex}`);
        queryParams.push(`%${parsedParams.country}%`);
        paramIndex++;
      }

      if (parsedParams.city) {
        whereConditions.push(`p.city ILIKE $${paramIndex}`);
        queryParams.push(`%${parsedParams.city}%`);
        paramIndex++;
      }

      if (parsedParams.property_type) {
        whereConditions.push(`p.property_type = $${paramIndex}`);
        queryParams.push(parsedParams.property_type);
        paramIndex++;
      }

      if (parsedParams.guest_count) {
        whereConditions.push(`p.guest_count >= $${paramIndex}`);
        queryParams.push(parsedParams.guest_count);
        paramIndex++;
      }

      if (parsedParams.price_min) {
        whereConditions.push(`p.base_price_per_night >= $${paramIndex}`);
        queryParams.push(parsedParams.price_min);
        paramIndex++;
      }

      if (parsedParams.price_max) {
        whereConditions.push(`p.base_price_per_night <= $${paramIndex}`);
        queryParams.push(parsedParams.price_max);
        paramIndex++;
      }

      if (parsedParams.min_bedrooms) {
        whereConditions.push(`p.bedrooms >= $${paramIndex}`);
        queryParams.push(parsedParams.min_bedrooms);
        paramIndex++;
      }

      if (parsedParams.max_bedrooms) {
        whereConditions.push(`p.bedrooms <= $${paramIndex}`);
        queryParams.push(parsedParams.max_bedrooms);
        paramIndex++;
      }

      if (parsedParams.min_bathrooms) {
        whereConditions.push(`p.bathrooms >= $${paramIndex}`);
        queryParams.push(parsedParams.min_bathrooms);
        paramIndex++;
      }

      if (parsedParams.max_bathrooms) {
        whereConditions.push(`p.bathrooms <= $${paramIndex}`);
        queryParams.push(parsedParams.max_bathrooms);
        paramIndex++;
      }

      if (parsedParams.instant_booking !== undefined) {
        whereConditions.push(`p.instant_booking = $${paramIndex}`);
        queryParams.push(parsedParams.instant_booking);
        paramIndex++;
      }

      if (parsedParams.distance_beach) {
        whereConditions.push(`p.distance_beach <= $${paramIndex}`);
        queryParams.push(parsedParams.distance_beach);
        paramIndex++;
      }

      if (parsedParams.distance_airport) {
        whereConditions.push(`p.distance_airport <= $${paramIndex}`);
        queryParams.push(parsedParams.distance_airport);
        paramIndex++;
      }

      if (parsedParams.min_rating) {
        whereConditions.push(`p.average_rating >= $${paramIndex}`);
        queryParams.push(parsedParams.min_rating);
        paramIndex++;
      }

      if (parsedParams.amenities && parsedParams.amenities.length > 0) {
        whereConditions.push(`p.amenities @> $${paramIndex}`);
        queryParams.push(JSON.stringify(parsedParams.amenities));
        paramIndex++;
      }

      // Availability check if dates provided
      if (parsedParams.check_in_date && parsedParams.check_out_date) {
        whereConditions.push(`
          NOT EXISTS (
            SELECT 1 FROM property_availability pa 
            WHERE pa.property_id = p.property_id 
            AND pa.date >= $${paramIndex} 
            AND pa.date < $${paramIndex + 1}
            AND (pa.is_available = false OR pa.is_blocked = true)
          )
        `);
        queryParams.push(parsedParams.check_in_date, parsedParams.check_out_date);
        paramIndex += 2;
      }

      // Build ORDER BY clause
      let orderByClause = 'ORDER BY ';
      switch (parsedParams.sort_by) {
        case 'price':
          orderByClause += 'p.base_price_per_night';
          break;
        case 'rating':
          orderByClause += 'p.average_rating';
          break;
        case 'distance_beach':
          orderByClause += 'p.distance_beach';
          break;
        default:
          orderByClause += 'p.created_at';
      }
      orderByClause += parsedParams.sort_order === 'asc' ? ' ASC' : ' DESC';

      const searchQuery = `
        SELECT 
          p.*,
          u.first_name, u.last_name, u.is_superhost, u.profile_photo_url as owner_photo,
          pp.photo_url as cover_photo_url,
          COALESCE(p.average_rating, 0) as average_rating,
          COALESCE(p.review_count, 0) as review_count
        FROM properties p
        JOIN users u ON p.owner_id = u.user_id
        LEFT JOIN property_photos pp ON p.property_id = pp.property_id AND pp.is_cover_photo = true
        WHERE ${whereConditions.join(' AND ')}
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(parsedParams.limit, parsedParams.offset);

      const result = await client.query(searchQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM properties p
        JOIN users u ON p.owner_id = u.user_id
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const properties = result.rows.map(row => ({
        ...row,
        amenities: row.amenities ? (typeof row.amenities === 'string' ? (row.amenities.startsWith('[') || row.amenities.startsWith('{') ? JSON.parse(row.amenities) : [row.amenities]) : row.amenities) : [],
        house_rules: row.house_rules ? (typeof row.house_rules === 'string' ? (row.house_rules.startsWith('[') || row.house_rules.startsWith('{') ? JSON.parse(row.house_rules) : [row.house_rules]) : row.house_rules) : []
      }));

      res.json({
        properties,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/properties - Creates new property listing
*/
app.post('/api/properties', authenticateToken, async (req, res) => {
  try {
    const validatedData = createPropertyInputSchema.parse(req.body);
    
    const client = await pool.connect();
    
    try {
      const property_id = generateId();
      const timestamp = getCurrentTimestamp();
      
      // Insert new property
      const result = await client.query(`
        INSERT INTO properties (
          property_id, owner_id, title, description, property_type, country, city, region,
          neighborhood, address, latitude, longitude, bedrooms, bathrooms, guest_count,
          property_size, base_price_per_night, cleaning_fee, extra_guest_fee, security_deposit,
          pet_fee, currency, minimum_stay, maximum_stay, check_in_time, check_out_time,
          cancellation_policy, house_rules, amenities, instant_booking, distance_beach,
          distance_airport, is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
        )
        RETURNING *
      `, [
        property_id, validatedData.owner_id, validatedData.title, validatedData.description,
        validatedData.property_type, validatedData.country, validatedData.city, validatedData.region,
        validatedData.neighborhood, validatedData.address, validatedData.latitude, validatedData.longitude,
        validatedData.bedrooms, validatedData.bathrooms, validatedData.guest_count, validatedData.property_size,
        validatedData.base_price_per_night, validatedData.cleaning_fee, validatedData.extra_guest_fee,
        validatedData.security_deposit, validatedData.pet_fee, validatedData.currency, validatedData.minimum_stay,
        validatedData.maximum_stay, validatedData.check_in_time, validatedData.check_out_time,
        validatedData.cancellation_policy, JSON.stringify(validatedData.house_rules || []),
        JSON.stringify(validatedData.amenities || []), validatedData.instant_booking,
        validatedData.distance_beach, validatedData.distance_airport, true, timestamp, timestamp
      ]);
      
      const property = result.rows[0];
      property.amenities = property.amenities ? JSON.parse(property.amenities) : [];
      property.house_rules = property.house_rules ? JSON.parse(property.house_rules) : [];
      
      res.status(201).json(property);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create property error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/properties/:property_id - Get detailed property information
*/
app.get('/api/properties/:property_id', async (req, res) => {
  try {
    const { property_id } = req.params;
    const { check_in_date, check_out_date } = req.query;
    
    const client = await pool.connect();
    
    try {
      // Get property details with owner information
      const result = await client.query(`
        SELECT 
          p.*,
          u.first_name, u.last_name, u.is_superhost, u.profile_photo_url as owner_photo,
          u.languages_spoken as host_language,
          pp.photo_url as cover_photo_url
        FROM properties p
        JOIN users u ON p.owner_id = u.user_id
        LEFT JOIN property_photos pp ON p.property_id = pp.property_id AND pp.is_cover_photo = true
        WHERE p.property_id = $1 AND p.is_active = true
      `, [property_id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
      }
      
      const property = result.rows[0];
      property.amenities = property.amenities ? JSON.parse(property.amenities) : [];
      property.house_rules = property.house_rules ? JSON.parse(property.house_rules) : [];
      property.host_language = property.host_language ? JSON.parse(property.host_language) : [];
      
      // If dates provided, include availability and pricing
      if (check_in_date && check_out_date) {
        const availabilityResult = await client.query(`
          SELECT date, is_available, price_per_night
          FROM property_availability
          WHERE property_id = $1 AND date >= $2 AND date < $3
          ORDER BY date
        `, [property_id, check_in_date, check_out_date]);
        
        property.availability = availabilityResult.rows;
      }
      
      res.json(property);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/bookings - Creates new booking with pricing calculation
*/
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const validatedData = createBookingInputSchema.parse(req.body);

    const client = await pool.connect();
    
    try {
      // Get property details for pricing calculation
      const propertyResult = await client.query('SELECT * FROM properties WHERE property_id = $1 AND is_active = true', [validatedData.property_id]);
      if (propertyResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
      }

      const property = propertyResult.rows[0];

      // Check availability for the requested dates
      const availabilityResult = await client.query(`
        SELECT date FROM property_availability
        WHERE property_id = $1 AND date >= $2 AND date < $3 AND (is_available = false OR is_blocked = true)
      `, [validatedData.property_id, validatedData.check_in_date, validatedData.check_out_date]);

      if (availabilityResult.rows.length > 0) {
        return res.status(400).json(createErrorResponse('Property is not available for selected dates', null, 'PROPERTY_NOT_AVAILABLE'));
      }

      // Calculate pricing
      const checkInDate = new Date(validatedData.check_in_date);
      const checkOutDate = new Date(validatedData.check_out_date);
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (nights < property.minimum_stay) {
        return res.status(400).json(createErrorResponse(`Minimum stay is ${property.minimum_stay} nights`, null, 'MINIMUM_STAY_NOT_MET'));
      }

      if (property.maximum_stay && nights > property.maximum_stay) {
        return res.status(400).json(createErrorResponse(`Maximum stay is ${property.maximum_stay} nights`, null, 'MAXIMUM_STAY_EXCEEDED'));
      }

      const basePrice = property.base_price_per_night * nights;
      const cleaningFee = property.cleaning_fee || 0;
      const serviceFee = basePrice * 0.1; // 10% service fee
      const taxesAndFees = basePrice * 0.06; // 6% taxes
      const extraGuestFee = validatedData.guest_count > property.guest_count ? 
        (validatedData.guest_count - property.guest_count) * (property.extra_guest_fee || 0) * nights : 0;
      
      const totalPrice = basePrice + cleaningFee + serviceFee + taxesAndFees + extraGuestFee;

      // Create booking
      const booking_id = generateId();
      const timestamp = getCurrentTimestamp();

      const result = await client.query(`
        INSERT INTO bookings (
          booking_id, property_id, guest_id, check_in_date, check_out_date, guest_count, adults, children, infants,
          nights, base_price, cleaning_fee, service_fee, taxes_and_fees, total_price, currency, special_requests,
          booking_status, payment_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *
      `, [
        booking_id, validatedData.property_id, validatedData.guest_id, validatedData.check_in_date,
        validatedData.check_out_date, validatedData.guest_count, validatedData.adults, validatedData.children,
        validatedData.infants, nights, basePrice, cleaningFee, serviceFee, taxesAndFees, totalPrice,
        property.currency, validatedData.special_requests, 'pending', 'pending', timestamp, timestamp
      ]);

      const booking = result.rows[0];

      // Mark dates as unavailable
      for (let d = new Date(checkInDate); d < checkOutDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const availability_id = generateId();
        
        await client.query(`
          INSERT INTO property_availability (availability_id, property_id, date, is_available, created_at, updated_at)
          VALUES ($1, $2, $3, false, $4, $5)
          ON CONFLICT (property_id, date) DO UPDATE SET is_available = false, updated_at = $5
        `, [availability_id, validatedData.property_id, dateStr, timestamp, timestamp]);
      }

      // Emit real-time events
      io.emit('booking_created', {
        booking_id: booking.booking_id,
        property_id: booking.property_id,
        guest_id: booking.guest_id,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        total_price: booking.total_price,
        currency: booking.currency,
        booking_status: booking.booking_status,
        created_at: booking.created_at
      });

      // Notify property owner
      io.to(`user_${property.owner_id}`).emit('new_booking_received', {
        booking_id: booking.booking_id,
        property_title: property.title,
        guest_name: `${req.user.first_name} ${req.user.last_name}`,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        total_price: booking.total_price
      });

      res.status(201).json(booking);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create booking error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/bookings - Gets user bookings with filtering options
*/
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { guest_id, host_id, booking_status, property_id, limit = 10, offset = 0 } = req.query;
    
    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;
      
      // Build WHERE conditions
      if (guest_id) {
        whereConditions.push(`b.guest_id = $${paramIndex}`);
        queryParams.push(guest_id);
        paramIndex++;
      }
      
      if (host_id) {
        whereConditions.push(`p.owner_id = $${paramIndex}`);
        queryParams.push(host_id);
        paramIndex++;
      }
      
      if (booking_status) {
        whereConditions.push(`b.booking_status = $${paramIndex}`);
        queryParams.push(booking_status);
        paramIndex++;
      }
      
      if (property_id) {
        whereConditions.push(`b.property_id = $${paramIndex}`);
        queryParams.push(property_id);
        paramIndex++;
      }
      
      // Add permission check - users can only see their own bookings
      if (req.user.user_type !== 'admin') {
        whereConditions.push(`(b.guest_id = $${paramIndex} OR p.owner_id = $${paramIndex})`);
        queryParams.push(req.user.user_id);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const query = `
        SELECT 
          b.*,
          p.title as property_title, p.address as property_address, p.city as property_city, 
          p.country as property_country, p.base_price_per_night,
          u.first_name as guest_first_name, u.last_name as guest_last_name
        FROM bookings b
        JOIN properties p ON b.property_id = p.property_id
        JOIN users u ON b.guest_id = u.user_id
        ${whereClause}
        ORDER BY b.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(parseInt(limit), parseInt(offset));
      
      const result = await client.query(query, queryParams);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM bookings b
        JOIN properties p ON b.property_id = p.property_id
        JOIN users u ON b.guest_id = u.user_id
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));
      
      res.json({
        bookings: result.rows,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/bookings/:booking_id - Gets detailed booking information
*/
app.get('/api/bookings/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          b.*,
          p.title as property_title, p.address as property_address, p.city as property_city,
          p.country as property_country, p.check_in_time, p.check_out_time,
          pp.photo_url as property_cover_photo,
          u.user_id as guest_user_id, u.first_name as guest_first_name, u.last_name as guest_last_name,
          u.email as guest_email, u.phone_number as guest_phone,
          h.user_id as host_user_id, h.first_name as host_first_name, h.last_name as host_last_name,
          h.email as host_email, h.phone_number as host_phone
        FROM bookings b
        JOIN properties p ON b.property_id = p.property_id
        JOIN users u ON b.guest_id = u.user_id
        JOIN users h ON p.owner_id = h.user_id
        LEFT JOIN property_photos pp ON p.property_id = pp.property_id AND pp.is_cover_photo = true
        WHERE b.booking_id = $1
      `, [booking_id]);

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
      }

      const row = result.rows[0];

      // Check access permissions
      if (req.user.user_type !== 'admin' && req.user.user_id !== row.guest_user_id && req.user.user_id !== row.host_user_id) {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      // Get payments
      const paymentsResult = await client.query('SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at', [booking_id]);

      const booking = {
        ...row,
        property: {
          property_id: row.property_id,
          title: row.property_title,
          address: row.property_address,
          city: row.property_city,
          country: row.property_country,
          check_in_time: row.check_in_time,
          check_out_time: row.check_out_time,
          cover_photo_url: row.property_cover_photo
        },
        guest: {
          user_id: row.guest_user_id,
          first_name: row.guest_first_name,
          last_name: row.guest_last_name,
          email: row.guest_email,
          phone_number: row.guest_phone
        },
        host: {
          user_id: row.host_user_id,
          first_name: row.host_first_name,
          last_name: row.host_last_name,
          email: row.host_email,
          phone_number: row.host_phone
        },
        payments: paymentsResult.rows
      };

      // Clean up duplicate fields
      delete booking.property_title;
      delete booking.property_address;
      delete booking.property_city;
      delete booking.property_country;
      delete booking.check_in_time;
      delete booking.check_out_time;
      delete booking.property_cover_photo;
      delete booking.guest_user_id;
      delete booking.guest_first_name;
      delete booking.guest_last_name;
      delete booking.guest_email;
      delete booking.guest_phone;
      delete booking.host_user_id;
      delete booking.host_first_name;
      delete booking.host_last_name;
      delete booking.host_email;
      delete booking.host_phone;

      res.json(booking);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  PUT /api/bookings/:booking_id - Updates booking status and details
*/
app.put('/api/bookings/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;
    const validatedData = updateBookingInputSchema.parse({ booking_id, ...req.body });

    const client = await pool.connect();
    
    try {
      // Get booking details and check permissions
      const bookingResult = await client.query(`
        SELECT b.*, p.owner_id 
        FROM bookings b
        JOIN properties p ON b.property_id = p.property_id
        WHERE b.booking_id = $1
      `, [booking_id]);

      if (bookingResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
      }

      const booking = bookingResult.rows[0];

      // Check permissions (guest, host, or admin can update)
      if (req.user.user_type !== 'admin' && req.user.user_id !== booking.guest_id && req.user.user_id !== booking.owner_id) {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      const updateableFields = ['booking_status', 'payment_status', 'cancellation_reason', 'check_in_instructions', 'access_code'];

      updateableFields.forEach(field => {
        if (validatedData[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(validatedData[field]);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
      }

      // Handle cancellation
      if (validatedData.booking_status === 'cancelled') {
        updateFields.push(`cancelled_at = $${paramIndex}`);
        updateValues.push(getCurrentTimestamp());
        paramIndex++;
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      updateValues.push(getCurrentTimestamp());
      updateValues.push(booking_id);

      const result = await client.query(`
        UPDATE bookings SET ${updateFields.join(', ')}
        WHERE booking_id = $${paramIndex + 1}
        RETURNING *
      `, updateValues);

      // If booking is cancelled, free up the dates
      if (validatedData.booking_status === 'cancelled') {
        const checkInDate = new Date(booking.check_in_date);
        const checkOutDate = new Date(booking.check_out_date);
        
        for (let d = new Date(checkInDate); d < checkOutDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          await client.query(`
            UPDATE property_availability 
            SET is_available = true, updated_at = $1
            WHERE property_id = $2 AND date = $3
          `, [getCurrentTimestamp(), booking.property_id, dateStr]);
        }

        // Emit availability update
        io.emit(`property_${booking.property_id}_availability_updated`, {
          property_id: booking.property_id,
          date_range: { start_date: booking.check_in_date, end_date: booking.check_out_date },
          is_available: true,
          updated_at: getCurrentTimestamp()
        });
      }

      // Emit booking status update
      io.emit(`booking_${booking_id}_status_updated`, {
        booking_id: result.rows[0].booking_id,
        booking_status: result.rows[0].booking_status,
        payment_status: result.rows[0].payment_status,
        updated_at: result.rows[0].updated_at
      });

      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update booking error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  DELETE /api/bookings/:booking_id - Cancels booking
*/
app.delete('/api/bookings/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { cancellation_reason } = req.body;

    const client = await pool.connect();
    
    try {
      // Get booking details
      const bookingResult = await client.query(`
        SELECT b.*, p.owner_id 
        FROM bookings b
        JOIN properties p ON b.property_id = p.property_id
        WHERE b.booking_id = $1
      `, [booking_id]);

      if (bookingResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
      }

      const booking = bookingResult.rows[0];

      // Check permissions
      if (req.user.user_type !== 'admin' && req.user.user_id !== booking.guest_id && req.user.user_id !== booking.owner_id) {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      if (booking.booking_status === 'cancelled') {
        return res.status(400).json(createErrorResponse('Booking is already cancelled', null, 'BOOKING_ALREADY_CANCELLED'));
      }

      // Cancel booking
      const timestamp = getCurrentTimestamp();
      await client.query(`
        UPDATE bookings 
        SET booking_status = 'cancelled', cancellation_reason = $1, cancelled_at = $2, updated_at = $3
        WHERE booking_id = $4
      `, [cancellation_reason || 'Cancelled by user', timestamp, timestamp, booking_id]);

      // Free up dates
      const checkInDate = new Date(booking.check_in_date);
      const checkOutDate = new Date(booking.check_out_date);
      
      for (let d = new Date(checkInDate); d < checkOutDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        await client.query(`
          UPDATE property_availability 
          SET is_available = true, updated_at = $1
          WHERE property_id = $2 AND date = $3
        `, [timestamp, booking.property_id, dateStr]);
      }

      // Emit cancellation event
      io.emit('booking_cancelled', {
        booking_id,
        cancellation_reason: cancellation_reason || 'Cancelled by user',
        cancelled_at: timestamp,
        refund_amount: booking.total_price * 0.8 // Mock 80% refund
      });

      res.json({
        message: 'Booking cancelled successfully'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// PAYMENT ENDPOINTS
// ============================================================================

/*
  POST /api/payments - Processes payment for booking
  @@need:external-api: Payment gateway integration for processing credit cards, PayPal, and bank transfers
*/
app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    const validatedData = createPaymentInputSchema.parse(req.body);

    const client = await pool.connect();
    
    try {
      // Verify booking exists and user has permission
      const bookingResult = await client.query('SELECT * FROM bookings WHERE booking_id = $1', [validatedData.booking_id]);
      if (bookingResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
      }

      const booking = bookingResult.rows[0];
      if (req.user.user_id !== booking.guest_id && req.user.user_type !== 'admin') {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      // Mock payment processing (replace with actual payment gateway)
      const mockPaymentSuccess = true;
      const mockTransactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const payment_id = generateId();
      const timestamp = getCurrentTimestamp();

      const result = await client.query(`
        INSERT INTO payments (
          payment_id, booking_id, amount, currency, payment_method, payment_status,
          transaction_id, payment_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        payment_id, validatedData.booking_id, validatedData.amount, validatedData.currency,
        validatedData.payment_method, mockPaymentSuccess ? 'completed' : 'failed',
        mockPaymentSuccess ? mockTransactionId : null,
        mockPaymentSuccess ? timestamp : null, timestamp, timestamp
      ]);

      // Update booking payment status
      if (mockPaymentSuccess) {
        await client.query(`
          UPDATE bookings SET payment_status = 'completed', booking_status = 'confirmed', updated_at = $1
          WHERE booking_id = $2
        `, [timestamp, validatedData.booking_id]);

        // Emit payment completed event
        io.emit('payment_completed', {
          payment_id: result.rows[0].payment_id,
          booking_id: validatedData.booking_id,
          amount: validatedData.amount,
          currency: validatedData.currency,
          payment_method: validatedData.payment_method,
          transaction_id: mockTransactionId,
          payment_date: timestamp
        });

        // Emit booking confirmed event
        io.emit('booking_confirmed', {
          booking_id: validatedData.booking_id,
          confirmation_date: timestamp,
          check_in_instructions: 'Check-in instructions will be sent 24 hours before arrival'
        });
      } else {
        // Emit payment failed event
        io.emit('payment_failed', {
          payment_id: result.rows[0].payment_id,
          booking_id: validatedData.booking_id,
          amount: validatedData.amount,
          currency: validatedData.currency,
          payment_method: validatedData.payment_method,
          failure_reason: 'Mock payment failure for testing',
          failed_at: timestamp
        });
      }

      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create payment error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/payments/:payment_id - Gets payment details
*/
app.get('/api/payments/:payment_id', authenticateToken, async (req, res) => {
  try {
    const { payment_id } = req.params;

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT p.*, b.guest_id, pr.owner_id
        FROM payments p
        JOIN bookings b ON p.booking_id = b.booking_id
        JOIN properties pr ON b.property_id = pr.property_id
        WHERE p.payment_id = $1
      `, [payment_id]);

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Payment not found', null, 'PAYMENT_NOT_FOUND'));
      }

      const payment = result.rows[0];

      // Check permissions
      if (req.user.user_type !== 'admin' && req.user.user_id !== payment.guest_id && req.user.user_id !== payment.owner_id) {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      delete payment.guest_id;
      delete payment.owner_id;

      res.json(payment);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  PUT /api/payments/:payment_id - Updates payment status
*/
app.put('/api/payments/:payment_id', authenticateToken, async (req, res) => {
  try {
    const { payment_id } = req.params;

    // Only admins should be able to update payment status directly
    if (req.user.user_type !== 'admin') {
      return res.status(403).json(createErrorResponse('Permission denied - admin access required', null, 'PERMISSION_DENIED'));
    }

    const validatedData = updatePaymentInputSchema.parse({ payment_id, ...req.body });

    const client = await pool.connect();
    
    try {
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      const updateableFields = ['payment_status', 'transaction_id', 'payment_date', 'refund_amount', 'refund_date'];

      updateableFields.forEach(field => {
        if (validatedData[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(validatedData[field]);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      updateValues.push(getCurrentTimestamp());
      updateValues.push(payment_id);

      const result = await client.query(`
        UPDATE payments SET ${updateFields.join(', ')}
        WHERE payment_id = $${paramIndex + 1}
        RETURNING *
      `, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Payment not found', null, 'PAYMENT_NOT_FOUND'));
      }

      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update payment error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// MESSAGING AND CONVERSATION ENDPOINTS
// ============================================================================

/*
  GET /api/conversations - Gets user's conversations with filtering
*/
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { conversation_type, is_active, limit = 10, offset = 0 } = req.query;

    const client = await pool.connect();
    
    try {
      let whereConditions = [`(c.guest_id = $1 OR c.host_id = $1)`];
      let queryParams = [req.user.user_id];
      let paramIndex = 2;

      if (conversation_type) {
        whereConditions.push(`c.conversation_type = $${paramIndex}`);
        queryParams.push(conversation_type);
        paramIndex++;
      }

      if (is_active !== undefined) {
        whereConditions.push(`c.is_active = $${paramIndex}`);
        queryParams.push(is_active === 'true');
        paramIndex++;
      }

      const conversationsQuery = `
        SELECT 
          c.*,
          p.title as property_title, p.city as property_city, p.country as property_country,
          pp.photo_url as property_cover_photo,
          g.user_id as guest_user_id, g.first_name as guest_first_name, g.last_name as guest_last_name, g.profile_photo_url as guest_photo,
          h.user_id as host_user_id, h.first_name as host_first_name, h.last_name as host_last_name, h.profile_photo_url as host_photo,
          m.message_text as last_message_text, m.created_at as last_message_created_at, m.sender_id as last_message_sender_id
        FROM conversations c
        LEFT JOIN properties p ON c.property_id = p.property_id
        LEFT JOIN property_photos pp ON p.property_id = pp.property_id AND pp.is_cover_photo = true
        JOIN users g ON c.guest_id = g.user_id
        JOIN users h ON c.host_id = h.user_id
        LEFT JOIN messages m ON c.conversation_id = m.conversation_id AND m.created_at = c.last_message_at
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(String(limit), String(offset));

      const result = await client.query(conversationsQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM conversations c
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const conversations = result.rows.map(row => ({
        ...row,
        property: row.property_title ? {
          property_id: row.property_id,
          title: row.property_title,
          city: row.property_city,
          country: row.property_country,
          cover_photo_url: row.property_cover_photo
        } : null,
        guest: {
          user_id: row.guest_user_id,
          first_name: row.guest_first_name,
          last_name: row.guest_last_name,
          profile_photo_url: row.guest_photo
        },
        host: {
          user_id: row.host_user_id,
          first_name: row.host_first_name,
          last_name: row.host_last_name,
          profile_photo_url: row.host_photo
        },
        last_message: row.last_message_text ? {
          message_text: row.last_message_text,
          created_at: row.last_message_created_at,
          sender_id: row.last_message_sender_id
        } : null
      }));

      // Clean up duplicate fields
      conversations.forEach(conv => {
        delete conv.property_title;
        delete conv.property_city;
        delete conv.property_country;
        delete conv.property_cover_photo;
        delete conv.guest_user_id;
        delete conv.guest_first_name;
        delete conv.guest_last_name;
        delete conv.guest_photo;
        delete conv.host_user_id;
        delete conv.host_first_name;
        delete conv.host_last_name;
        delete conv.host_photo;
        delete conv.last_message_text;
        delete conv.last_message_created_at;
        delete conv.last_message_sender_id;
      });

      res.json({
        conversations,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/conversations - Creates new conversation
*/
app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const validatedData = createConversationInputSchema.parse(req.body);

    // User must be either the guest or host in the conversation
    if (req.user.user_id !== validatedData.guest_id && req.user.user_id !== validatedData.host_id) {
      return res.status(403).json(createErrorResponse('Permission denied - must be participant in conversation', null, 'PERMISSION_DENIED'));
    }

    const client = await pool.connect();
    
    try {
      const conversation_id = generateId();
      const timestamp = getCurrentTimestamp();

      const result = await client.query(`
        INSERT INTO conversations (
          conversation_id, property_id, booking_id, guest_id, host_id, conversation_type, subject, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
        RETURNING *
      `, [
        conversation_id, validatedData.property_id, validatedData.booking_id, validatedData.guest_id,
        validatedData.host_id, validatedData.conversation_type, validatedData.subject, timestamp, timestamp
      ]);

      // Emit conversation started event
      io.to(`user_${validatedData.guest_id}`).to(`user_${validatedData.host_id}`).emit('conversation_started', {
        conversation_id: result.rows[0].conversation_id,
        property_id: validatedData.property_id,
        booking_id: validatedData.booking_id,
        guest_id: validatedData.guest_id,
        host_id: validatedData.host_id,
        conversation_type: validatedData.conversation_type,
        subject: validatedData.subject,
        created_at: result.rows[0].created_at
      });

      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create conversation error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/conversations/:conversation_id - Gets conversation details
*/
app.get('/api/conversations/:conversation_id', authenticateToken, async (req, res) => {
  try {
    const { conversation_id } = req.params;

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          c.*,
          p.title as property_title, p.city as property_city, p.country as property_country,
          pp.photo_url as property_cover_photo,
          g.user_id as guest_user_id, g.first_name as guest_first_name, g.last_name as guest_last_name, g.profile_photo_url as guest_photo,
          h.user_id as host_user_id, h.first_name as host_first_name, h.last_name as host_last_name, h.profile_photo_url as host_photo
        FROM conversations c
        LEFT JOIN properties p ON c.property_id = p.property_id
        LEFT JOIN property_photos pp ON p.property_id = pp.property_id AND pp.is_cover_photo = true
        JOIN users g ON c.guest_id = g.user_id
        JOIN users h ON c.host_id = h.user_id
        WHERE c.conversation_id = $1
      `, [conversation_id]);

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Conversation not found', null, 'CONVERSATION_NOT_FOUND'));
      }

      const row = result.rows[0];

      // Check permissions
      if (req.user.user_id !== row.guest_user_id && req.user.user_id !== row.host_user_id && req.user.user_type !== 'admin') {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      const conversation = {
        ...row,
        property: row.property_title ? {
          property_id: row.property_id,
          title: row.property_title,
          city: row.property_city,
          country: row.property_country,
          cover_photo_url: row.property_cover_photo
        } : null,
        guest: {
          user_id: row.guest_user_id,
          first_name: row.guest_first_name,
          last_name: row.guest_last_name,
          profile_photo_url: row.guest_photo
        },
        host: {
          user_id: row.host_user_id,
          first_name: row.host_first_name,
          last_name: row.host_last_name,
          profile_photo_url: row.host_photo
        }
      };

      // Clean up duplicate fields
      delete conversation.property_title;
      delete conversation.property_city;
      delete conversation.property_country;
      delete conversation.property_cover_photo;
      delete conversation.guest_user_id;
      delete conversation.guest_first_name;
      delete conversation.guest_last_name;
      delete conversation.guest_photo;
      delete conversation.host_user_id;
      delete conversation.host_first_name;
      delete conversation.host_last_name;
      delete conversation.host_photo;

      res.json(conversation);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get conversation by ID error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/conversations/:conversation_id/messages - Gets conversation messages
*/
app.get('/api/conversations/:conversation_id/messages', authenticateToken, async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const { limit = 50, offset = 0, before_message_id } = req.query;

    const client = await pool.connect();
    
    try {
      // Check conversation access
      const conversationResult = await client.query(
        'SELECT guest_id, host_id FROM conversations WHERE conversation_id = $1',
        [conversation_id]
      );

      if (conversationResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Conversation not found', null, 'CONVERSATION_NOT_FOUND'));
      }

      const conversation = conversationResult.rows[0];
      if (req.user.user_id !== conversation.guest_id && req.user.user_id !== conversation.host_id && req.user.user_type !== 'admin') {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      let messagesQuery = `
        SELECT 
          m.*,
          u.first_name as sender_first_name, u.last_name as sender_last_name, u.profile_photo_url as sender_photo
        FROM messages m
        JOIN users u ON m.sender_id = u.user_id
        WHERE m.conversation_id = $1
      `;

      let queryParams = [conversation_id];
      let paramIndex = 2;

      if (before_message_id) {
        // Get messages before a specific message for pagination
        const beforeMessageResult = await client.query('SELECT created_at FROM messages WHERE message_id = $1', [before_message_id]);
        if (beforeMessageResult.rows.length > 0) {
          messagesQuery += ` AND m.created_at < $${paramIndex}`;
          queryParams.push(beforeMessageResult.rows[0].created_at);
          paramIndex++;
        }
      }

      messagesQuery += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(String(limit), String(offset));

      const result = await client.query(messagesQuery, queryParams);

      // Get total count
      const countResult = await client.query('SELECT COUNT(*) FROM messages WHERE conversation_id = $1', [conversation_id]);

      // Process results
      const messages = result.rows.map(row => ({
        ...row,
        attachments: row.attachments ? JSON.parse(row.attachments) : [],
        sender: {
          user_id: row.sender_id,
          first_name: row.sender_first_name,
          last_name: row.sender_last_name,
          profile_photo_url: row.sender_photo
        }
      }));

      // Clean up duplicate fields
      messages.forEach(msg => {
        delete msg.sender_first_name;
        delete msg.sender_last_name;
        delete msg.sender_photo;
      });

      res.json({
        messages: messages.reverse(), // Reverse to show oldest first
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/messages - Sends new message in conversation
*/
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const validatedData = createMessageInputSchema.parse(req.body);

    const client = await pool.connect();
    
    try {
      // Verify conversation access
      const conversationResult = await client.query(
        'SELECT guest_id, host_id FROM conversations WHERE conversation_id = $1 AND is_active = true',
        [validatedData.conversation_id]
      );

      if (conversationResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Conversation not found or inactive', null, 'CONVERSATION_NOT_FOUND'));
      }

      const conversation = conversationResult.rows[0];
      if (req.user.user_id !== conversation.guest_id && req.user.user_id !== conversation.host_id) {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      const message_id = generateId();
      const timestamp = getCurrentTimestamp();

      const result = await client.query(`
        INSERT INTO messages (
          message_id, conversation_id, sender_id, message_text, attachments, is_read, message_type, is_automated, created_at
        ) VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8)
        RETURNING *
      `, [
        message_id, validatedData.conversation_id, validatedData.sender_id, validatedData.message_text,
        validatedData.attachments ? JSON.stringify(validatedData.attachments) : '[]',
        validatedData.message_type, validatedData.is_automated, timestamp
      ]);

      // Update conversation last_message_at
      await client.query(
        'UPDATE conversations SET last_message_at = $1, updated_at = $2 WHERE conversation_id = $3',
        [timestamp, timestamp, validatedData.conversation_id]
      );

      const message = result.rows[0];
      message.attachments = message.attachments ? JSON.parse(message.attachments) : [];

      // Emit real-time message events
      const recipientId = req.user.user_id === conversation.guest_id ? conversation.host_id : conversation.guest_id;

      // Send to conversation participants
      io.to(`conversation_${validatedData.conversation_id}`).emit('message_sent', {
        message_id: message.message_id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        message_text: message.message_text,
        attachments: message.attachments,
        message_type: message.message_type,
        is_automated: message.is_automated,
        created_at: message.created_at
      });

      // Send to recipient specifically
      io.to(`user_${recipientId}`).emit('message_received', {
        message_id: message.message_id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        recipient_id: recipientId,
        message_text: message.message_text,
        attachments: message.attachments,
        message_type: message.message_type,
        created_at: message.created_at
      });

      res.status(201).json(message);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Send message error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  PUT /api/messages/:message_id - Updates message (mark as read)
*/
app.put('/api/messages/:message_id', authenticateToken, async (req, res) => {
  try {
    const { message_id } = req.params;
    const validatedData = updateMessageInputSchema.parse({ message_id, ...req.body });

    const client = await pool.connect();
    
    try {
      // Verify message exists and user has access
      const messageResult = await client.query(`
        SELECT m.*, c.guest_id, c.host_id 
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.conversation_id
        WHERE m.message_id = $1
      `, [message_id]);

      if (messageResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Message not found', null, 'MESSAGE_NOT_FOUND'));
      }

      const message = messageResult.rows[0];
      
      // Only the recipient (not sender) can mark as read
      if (req.user.user_id === message.sender_id) {
        return res.status(403).json(createErrorResponse('Cannot mark own message as read', null, 'PERMISSION_DENIED'));
      }

      if (req.user.user_id !== message.guest_id && req.user.user_id !== message.host_id) {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      const timestamp = getCurrentTimestamp();

      const result = await client.query(`
        UPDATE messages SET is_read = $1, read_at = $2
        WHERE message_id = $3
        RETURNING *
      `, [validatedData.is_read || true, validatedData.read_at || timestamp, message_id]);

      // Emit read receipt
      io.to(`conversation_${message.conversation_id}`).emit('message_read', {
        message_id: message.message_id,
        conversation_id: message.conversation_id,
        reader_id: req.user.user_id,
        read_at: result.rows[0].read_at
      });

      res.json({
        message: 'Message marked as read'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update message error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// LOCATION AND WEATHER ENDPOINTS
// ============================================================================

/*
  GET /api/locations - Gets hot climate destinations
*/
app.get('/api/locations', async (req, res) => {
  try {
    const {
      query, country, climate_type, is_hot_destination, is_featured,
      limit = 10, offset = 0, sort_by = 'property_count', sort_order = 'desc'
    } = req.query;

    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (query) {
        whereConditions.push(`(city ILIKE $${paramIndex} OR country ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        queryParams.push(`%${query}%`);
        paramIndex++;
      }

      if (country) {
        whereConditions.push(`country ILIKE $${paramIndex}`);
        queryParams.push(`%${country}%`);
        paramIndex++;
      }

      if (climate_type) {
        whereConditions.push(`climate_type = $${paramIndex}`);
        queryParams.push(climate_type);
        paramIndex++;
      }

      if (is_hot_destination !== undefined) {
        whereConditions.push(`is_hot_destination = $${paramIndex}`);
        queryParams.push(is_hot_destination === 'true');
        paramIndex++;
      }

      if (is_featured !== undefined) {
        whereConditions.push(`is_featured = $${paramIndex}`);
        queryParams.push(is_featured === 'true');
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      let orderByClause = 'ORDER BY ';
      switch (sort_by) {
        case 'city':
          orderByClause += 'city';
          break;
        case 'created_at':
          orderByClause += 'created_at';
          break;
        default:
          orderByClause += 'property_count';
      }
      orderByClause += sort_order === 'asc' ? ' ASC' : ' DESC';

      const locationsQuery = `
        SELECT * FROM locations
        ${whereClause}
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(String(limit), String(offset));

      const result = await client.query(locationsQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM locations
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const locations = result.rows.map(row => {
        try {
          row.languages = row.languages ? (typeof row.languages === 'string' ? (row.languages.startsWith('[') || row.languages.startsWith('{') ? JSON.parse(row.languages) : [row.languages]) : row.languages) : [];
          row.best_visit_months = row.best_visit_months ? (typeof row.best_visit_months === 'string' ? (row.best_visit_months.startsWith('[') || row.best_visit_months.startsWith('{') ? JSON.parse(row.best_visit_months) : [row.best_visit_months]) : row.best_visit_months) : [];
        } catch (e) {
          row.languages = [];
          row.best_visit_months = [];
        }
        return row;
      });

      res.json({
        locations,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/locations/:location_id - Gets location details
*/
app.get('/api/locations/:location_id', async (req, res) => {
  try {
    const { location_id } = req.params;

    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM locations WHERE location_id = $1', [location_id]);

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Location not found', null, 'LOCATION_NOT_FOUND'));
      }

      const location = result.rows[0];
      location.languages = location.languages ? JSON.parse(location.languages) : [];
      location.best_visit_months = location.best_visit_months ? JSON.parse(location.best_visit_months) : [];

      res.json(location);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get location by ID error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/locations/:location_id/weather - Gets weather data for location
  @@need:external-api: Weather service API to fetch real-time weather data and forecasts for locations
*/
app.get('/api/locations/:location_id/weather', async (req, res) => {
  try {
    const { location_id } = req.params;
    const { forecast_days = 7, include_historical = false } = req.query;

    const client = await pool.connect();
    
    try {
      // Get location details
      const locationResult = await client.query('SELECT * FROM locations WHERE location_id = $1', [location_id]);
      if (locationResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Location not found', null, 'LOCATION_NOT_FOUND'));
      }

      const location = locationResult.rows[0];

      // Get weather data from database
      const weatherQuery = `
        SELECT * FROM weather_data
        WHERE location_id = $1
        ORDER BY date DESC
        LIMIT 30
      `;

      const weatherResult = await client.query(weatherQuery, [location_id]);

      // Mock current weather and forecast (replace with actual API call)
      const mockCurrentWeather = {
        temperature_avg: location.average_temperature || 28.5,
        humidity: 75.2,
        wind_speed: 12.5,
        uv_index: 8.5,
        weather_condition: 'Sunny',
        sunshine_hours: 9.5
      };

      const mockForecast = [];
      for (let i = 0; i < parseInt(String(forecast_days)); i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        mockForecast.push({
          date: date.toISOString().split('T')[0],
          temperature_min: (location.average_temperature || 28) - 3 + Math.random() * 2,
          temperature_max: (location.average_temperature || 28) + 5 + Math.random() * 3,
          temperature_avg: (location.average_temperature || 28) + Math.random() * 2,
          weather_condition: ['Sunny', 'Partly Cloudy', 'Clear'][Math.floor(Math.random() * 3)],
          rainfall: Math.random() * 5
        });
      }

      const response: any = {
        current: {
          temperature_avg: mockCurrentWeather.temperature_avg,
          humidity: mockCurrentWeather.humidity,
          wind_speed: mockCurrentWeather.wind_speed,
          uv_index: mockCurrentWeather.uv_index,
          weather_condition: mockCurrentWeather.weather_condition,
          sunshine_hours: mockCurrentWeather.sunshine_hours
        },
        forecast: mockForecast,
        best_visit_months: []
      };

      if (include_historical === 'true') {
        response.historical = [];
      }

      res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get location weather error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/locations/:location_id/attractions - Gets local attractions
*/
app.get('/api/locations/:location_id/attractions', async (req, res) => {
  try {
    const { location_id } = req.params;
    const { category, is_featured, limit = 10, offset = 0 } = req.query;

    const client = await pool.connect();
    
    try {
      let whereConditions = [`location_id = $1`];
      let queryParams: any[] = [location_id];
      let paramIndex = 2;

      if (category) {
        whereConditions.push(`category = $${paramIndex}`);
        queryParams.push(String(category));
        paramIndex++;
      }

      if (is_featured !== undefined) {
        whereConditions.push(`is_featured = $${paramIndex}`);
        queryParams.push(is_featured === 'true');
        paramIndex++;
      }

      const attractionsQuery = `
        SELECT * FROM local_attractions
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY is_featured DESC, rating DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(String(limit), String(offset));

      const result = await client.query(attractionsQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM local_attractions
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const attractions = result.rows.map(row => {
        try {
          row.opening_hours = row.opening_hours ? (typeof row.opening_hours === 'string' ? (row.opening_hours.startsWith('{') || row.opening_hours.startsWith('[') ? JSON.parse(row.opening_hours) : {}) : row.opening_hours) : {};
          row.image_urls = row.image_urls ? (typeof row.image_urls === 'string' ? (row.image_urls.startsWith('[') || row.image_urls.startsWith('{') ? JSON.parse(row.image_urls) : [row.image_urls]) : row.image_urls) : [];
        } catch (e) {
          row.opening_hours = {};
          row.image_urls = [];
        }
        return row;
      });

      res.json({
        attractions,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get location attractions error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// REVIEW ENDPOINTS
// ============================================================================

/*
  GET /api/properties/:property_id/reviews - Gets property reviews
*/
app.get('/api/properties/:property_id/reviews', async (req, res) => {
  try {
    const { property_id } = req.params;
    const { min_rating, limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = req.query;

    const client = await pool.connect();
    
    try {
      let whereConditions = ['r.property_id = $1', 'r.is_visible = true'];
      let queryParams = [property_id];
      let paramIndex = 2;

      if (min_rating) {
        whereConditions.push(`r.overall_rating >= $${paramIndex}`);
        queryParams.push(String(min_rating));
        paramIndex++;
      }

      let orderByClause = 'ORDER BY ';
      switch (sort_by) {
        case 'overall_rating':
          orderByClause += 'r.overall_rating';
          break;
        default:
          orderByClause += 'r.created_at';
      }
      orderByClause += sort_order === 'asc' ? ' ASC' : ' DESC';

      const reviewsQuery = `
        SELECT 
          r.*,
          u.first_name as reviewer_first_name, u.last_name as reviewer_last_name,
          u.profile_photo_url as reviewer_photo, u.created_at as reviewer_member_since
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.user_id
        WHERE ${whereConditions.join(' AND ')}
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(String(limit), String(offset));

      const result = await client.query(reviewsQuery, queryParams);

      // Get total count and average rating
      const countQuery = `
        SELECT COUNT(*), AVG(overall_rating) as avg_rating
        FROM reviews r
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const reviews = result.rows.map(row => ({
        ...row,
        review_photos: row.review_photos ? JSON.parse(row.review_photos) : [],
        reviewer: {
          user_id: row.reviewer_id,
          first_name: row.reviewer_first_name,
          last_name: row.reviewer_last_name,
          profile_photo_url: row.reviewer_photo,
          member_since: row.reviewer_member_since
        }
      }));

      // Clean up duplicate fields
      reviews.forEach(review => {
        delete review.reviewer_first_name;
        delete review.reviewer_last_name;
        delete review.reviewer_photo;
        delete review.reviewer_member_since;
      });

      res.json({
        reviews,
        total: parseInt(countResult.rows[0].count),
        average_rating: parseFloat(countResult.rows[0].avg_rating) || 0
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get property reviews error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/reviews - Gets reviews with filtering
*/
app.get('/api/reviews', async (req, res) => {
  try {
    const { 
      property_id, reviewer_id, min_rating, max_rating, is_visible = true,
      limit = 10, offset = 0, sort_by = 'created_at', sort_order = 'desc' 
    } = req.query;

    // Coerce query parameters
    const parsedParams = {
      property_id: property_id ? String(property_id) : undefined,
      reviewer_id: reviewer_id ? String(reviewer_id) : undefined,
      min_rating: min_rating ? parseInt(String(min_rating)) || undefined : undefined,
      max_rating: max_rating ? parseInt(String(max_rating)) || undefined : undefined,
      is_visible: is_visible ? String(is_visible).toLowerCase() === 'true' : true,
      limit: Math.min(100, Math.max(1, parseInt(String(limit)) || 10)),
      offset: Math.max(0, parseInt(String(offset)) || 0),
      sort_by: sort_by ? String(sort_by) : 'created_at',
      sort_order: sort_order ? String(sort_order) : 'desc'
    };

    const client = await pool.connect();
    
    try {
      let whereConditions = ['r.is_visible = $1'];
      let queryParams: any[] = [parsedParams.is_visible];
      let paramIndex = 2;

      if (parsedParams.property_id) {
        whereConditions.push(`r.property_id = $${paramIndex}`);
        queryParams.push(parsedParams.property_id);
        paramIndex++;
      }

      if (parsedParams.reviewer_id) {
        whereConditions.push(`r.reviewer_id = $${paramIndex}`);
        queryParams.push(parsedParams.reviewer_id);
        paramIndex++;
      }

      if (parsedParams.min_rating) {
        whereConditions.push(`r.overall_rating >= $${paramIndex}`);
        queryParams.push(parsedParams.min_rating);
        paramIndex++;
      }

      if (parsedParams.max_rating) {
        whereConditions.push(`r.overall_rating <= $${paramIndex}`);
        queryParams.push(parsedParams.max_rating);
        paramIndex++;
      }

      let orderByClause = 'ORDER BY ';
      switch (parsedParams.sort_by) {
        case 'overall_rating':
          orderByClause += 'r.overall_rating';
          break;
        default:
          orderByClause += 'r.created_at';
      }
      orderByClause += parsedParams.sort_order === 'asc' ? ' ASC' : ' DESC';

      const reviewsQuery = `
        SELECT 
          r.*,
          u.first_name as reviewer_first_name, u.last_name as reviewer_last_name,
          u.profile_photo_url as reviewer_photo, u.created_at as reviewer_member_since
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.user_id
        WHERE ${whereConditions.join(' AND ')}
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(parsedParams.limit, parsedParams.offset);

      const result = await client.query(reviewsQuery, queryParams);

      // Get total count and average rating
      const countQuery = `
        SELECT COUNT(*), AVG(overall_rating) as avg_rating
        FROM reviews r
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const reviews = result.rows.map(row => ({
        ...row,
        review_photos: row.review_photos ? JSON.parse(row.review_photos) : [],
        reviewer: {
          user_id: row.reviewer_id,
          first_name: row.reviewer_first_name,
          last_name: row.reviewer_last_name,
          profile_photo_url: row.reviewer_photo,
          member_since: row.reviewer_member_since
        }
      }));

      // Clean up duplicate fields
      reviews.forEach(review => {
        delete review.reviewer_first_name;
        delete review.reviewer_last_name;
        delete review.reviewer_photo;
        delete review.reviewer_member_since;
      });

      res.json({
        reviews,
        total: parseInt(countResult.rows[0].count),
        average_rating: parseFloat(countResult.rows[0].avg_rating) || 0
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/reviews - Submits property review
*/
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const validatedData = createReviewInputSchema.parse(req.body);

    const client = await pool.connect();
    
    try {
      // Verify booking exists and user is the guest
      const bookingResult = await client.query(
        'SELECT * FROM bookings WHERE booking_id = $1 AND guest_id = $2 AND booking_status = $3',
        [validatedData.booking_id, req.user.user_id, 'completed']
      );

      if (bookingResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Completed booking not found', null, 'BOOKING_NOT_FOUND'));
      }

      // Check if review already exists
      const existingReview = await client.query(
        'SELECT review_id FROM reviews WHERE booking_id = $1',
        [validatedData.booking_id]
      );

      if (existingReview.rows.length > 0) {
        return res.status(409).json(createErrorResponse('Review already submitted for this booking', null, 'REVIEW_ALREADY_EXISTS'));
      }

      const review_id = generateId();
      const timestamp = getCurrentTimestamp();

      const result = await client.query(`
        INSERT INTO reviews (
          review_id, booking_id, property_id, reviewer_id, overall_rating, cleanliness_rating,
          accuracy_rating, communication_rating, location_rating, checkin_rating, value_rating,
          review_text, review_photos, is_anonymous, is_visible, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, $15, $16)
        RETURNING *
      `, [
        review_id, validatedData.booking_id, validatedData.property_id, validatedData.reviewer_id,
        validatedData.overall_rating, validatedData.cleanliness_rating, validatedData.accuracy_rating,
        validatedData.communication_rating, validatedData.location_rating, validatedData.checkin_rating,
        validatedData.value_rating, validatedData.review_text,
        validatedData.review_photos ? JSON.stringify(validatedData.review_photos) : '[]',
        validatedData.is_anonymous, timestamp, timestamp
      ]);

      // Update property average rating
      const ratingResult = await client.query(
        'SELECT AVG(overall_rating) as avg_rating, COUNT(*) as count FROM reviews WHERE property_id = $1 AND is_visible = true',
        [validatedData.property_id]
      );

      await client.query(
        'UPDATE properties SET average_rating = $1, review_count = $2, updated_at = $3 WHERE property_id = $4',
        [parseFloat(ratingResult.rows[0].avg_rating), parseInt(ratingResult.rows[0].count), timestamp, validatedData.property_id]
      );

      const review = result.rows[0];
      review.review_photos = review.review_photos ? JSON.parse(review.review_photos) : [];

      // Emit review submitted event
      io.emit(`property_${validatedData.property_id}_review_submitted`, {
        review_id: review.review_id,
        booking_id: review.booking_id,
        property_id: review.property_id,
        reviewer_id: review.reviewer_id,
        overall_rating: review.overall_rating,
        review_text: review.review_text,
        created_at: review.created_at
      });

      res.status(201).json(review);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create review error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/reviews/:review_id - Gets review details
*/
app.get('/api/reviews/:review_id', async (req, res) => {
  try {
    const { review_id } = req.params;

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          r.*,
          u.first_name as reviewer_first_name, u.last_name as reviewer_last_name,
          u.profile_photo_url as reviewer_photo,
          p.title as property_title, p.city as property_city, p.country as property_country
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.user_id
        JOIN properties p ON r.property_id = p.property_id
        WHERE r.review_id = $1 AND r.is_visible = true
      `, [review_id]);

      if (result.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Review not found', null, 'REVIEW_NOT_FOUND'));
      }

      const row = result.rows[0];

      const review = {
        ...row,
        review_photos: row.review_photos ? JSON.parse(row.review_photos) : [],
        reviewer: {
          user_id: row.reviewer_id,
          first_name: row.reviewer_first_name,
          last_name: row.reviewer_last_name,
          profile_photo_url: row.reviewer_photo
        },
        property: {
          property_id: row.property_id,
          title: row.property_title,
          city: row.property_city,
          country: row.property_country
        }
      };

      // Clean up duplicate fields
      delete review.reviewer_first_name;
      delete review.reviewer_last_name;
      delete review.reviewer_photo;
      delete review.property_title;
      delete review.property_city;
      delete review.property_country;

      res.json(review);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get review by ID error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  PUT /api/reviews/:review_id - Updates review (host response)
*/
app.put('/api/reviews/:review_id', authenticateToken, async (req, res) => {
  try {
    const { review_id } = req.params;
    const validatedData = updateReviewInputSchema.parse({ review_id, ...req.body });

    const client = await pool.connect();
    
    try {
      // Get review and check if user is the property host
      const reviewResult = await client.query(`
        SELECT r.*, p.owner_id
        FROM reviews r
        JOIN properties p ON r.property_id = p.property_id
        WHERE r.review_id = $1
      `, [review_id]);

      if (reviewResult.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Review not found', null, 'REVIEW_NOT_FOUND'));
      }

      const review = reviewResult.rows[0];

      // Only property host or admin can respond to reviews
      if (req.user.user_id !== review.owner_id && req.user.user_type !== 'admin') {
        return res.status(403).json(createErrorResponse('Permission denied - only property host can respond', null, 'PERMISSION_DENIED'));
      }

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (validatedData.host_response !== undefined) {
        updateFields.push(`host_response = $${paramIndex}`);
        updateValues.push(validatedData.host_response);
        paramIndex++;
        
        updateFields.push(`host_response_date = $${paramIndex}`);
        updateValues.push(getCurrentTimestamp());
        paramIndex++;
      }

      if (validatedData.is_visible !== undefined) {
        updateFields.push(`is_visible = $${paramIndex}`);
        updateValues.push(validatedData.is_visible);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      updateValues.push(getCurrentTimestamp());
      updateValues.push(review_id);

      const result = await client.query(`
        UPDATE reviews SET ${updateFields.join(', ')}
        WHERE review_id = $${paramIndex + 1}
        RETURNING *
      `, updateValues);

      const updatedReview = result.rows[0];
      updatedReview.review_photos = updatedReview.review_photos ? JSON.parse(updatedReview.review_photos) : [];

      // Emit review response event
      if (validatedData.host_response) {
        io.emit(`review_${review_id}_response_added`, {
          review_id: updatedReview.review_id,
          host_response: updatedReview.host_response,
          host_response_date: updatedReview.host_response_date
        });
      }

      res.json(updatedReview);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update review error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// ADDITIONAL ENDPOINTS
// ============================================================================

/*
  GET /api/currency-rates - Gets current currency exchange rates
  @@need:external-api: Currency exchange rate API to get real-time conversion rates
*/
app.get('/api/currency-rates', async (req, res) => {
  try {
    const { base_currency = 'USD', target_currencies } = req.query;

    // Mock currency rates (replace with actual API call)
    const mockRates = {
      'USD': {
        'EUR': 0.925,
        'GBP': 0.785,
        'MXN': 17.25,
        'THB': 34.50,
        'IDR': 15650.00
      },
      'EUR': {
        'USD': 1.081,
        'GBP': 0.849,
        'MXN': 18.65,
        'THB': 37.30,
        'IDR': 16920.00
      }
    };

    const baseRates = mockRates[String(base_currency)] || mockRates['USD'];
    let rates = baseRates;

    if (target_currencies) {
      const targetArray = Array.isArray(target_currencies) ? target_currencies : [target_currencies];
      rates = {};
      targetArray.forEach(currency => {
        if (baseRates[currency]) {
          rates[currency] = baseRates[currency];
        }
      });
    }

    res.json({
      base_currency,
      rates,
      rate_date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Get currency rates error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/system-alerts - Gets active system alerts
*/
app.get('/api/system-alerts', async (req, res) => {
  try {
    const {
      alert_type, severity, is_active = true, affected_location,
      limit = 10, offset = 0
    } = req.query;

    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (alert_type) {
        whereConditions.push(`alert_type = $${paramIndex}`);
        queryParams.push(alert_type);
        paramIndex++;
      }

      if (severity) {
        whereConditions.push(`severity = $${paramIndex}`);
        queryParams.push(severity);
        paramIndex++;
      }

      if (is_active !== undefined) {
        whereConditions.push(`is_active = $${paramIndex}`);
        queryParams.push(is_active === 'true');
        paramIndex++;
      }

      if (affected_location) {
        whereConditions.push(`affected_locations @> $${paramIndex}`);
        queryParams.push(JSON.stringify([affected_location]));
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const alertsQuery = `
        SELECT * FROM system_alerts
        ${whereClause}
        ORDER BY severity DESC, created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(String(limit), String(offset));

      const result = await client.query(alertsQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM system_alerts
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const alerts = result.rows.map(row => {
        row.affected_locations = row.affected_locations ? JSON.parse(row.affected_locations) : [];
        return row;
      });

      res.json({
        alerts,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get system alerts error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/market-data - Gets investment market data
*/
app.get('/api/market-data', authenticateToken, async (req, res) => {
  try {
    const { location_id, property_type, month, limit = 10, offset = 0 } = req.query;

    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (location_id) {
        whereConditions.push(`md.location_id = $${paramIndex}`);
        queryParams.push(location_id);
        paramIndex++;
      }

      if (property_type) {
        whereConditions.push(`md.property_type = $${paramIndex}`);
        queryParams.push(property_type);
        paramIndex++;
      }

      if (month) {
        whereConditions.push(`md.month = $${paramIndex}`);
        queryParams.push(month);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const marketQuery = `
        SELECT 
          md.*,
          l.city, l.country, l.climate_type, l.destination_slug
        FROM market_data md
        JOIN locations l ON md.location_id = l.location_id
        ${whereClause}
        ORDER BY md.investment_score DESC, md.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(String(limit), String(offset));

      const result = await client.query(marketQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM market_data md
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const marketData = result.rows.map(row => ({
        ...row,
        legal_requirements: row.legal_requirements ? JSON.parse(row.legal_requirements) : [],
        location: {
          location_id: row.location_id,
          city: row.city,
          country: row.country,
          climate_type: row.climate_type,
          destination_slug: row.destination_slug
        }
      }));

      // Clean up duplicate fields
      marketData.forEach(data => {
        delete data.city;
        delete data.country;
        delete data.climate_type;
        delete data.destination_slug;
      });

      res.json({
        market_data: marketData,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get market data error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// WEBSOCKET REAL-TIME FUNCTIONALITY
// ============================================================================

/*
  WebSocket connection handling for real-time features
*/
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user authentication for socket
  socket.on('authenticate', async (token) => {
    try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;      const client = await pool.connect();
      
      try {
        const result = await client.query(
          'SELECT user_id, email, first_name, last_name FROM users WHERE user_id = $1 AND is_active = true',
          [decoded.user_id]
        );
        
        if (result.rows.length > 0) {
          socket.user = result.rows[0];
          socket.join(`user_${socket.user.user_id}`);
          
          // Emit user online status
          socket.broadcast.emit('user_online', {
            user_id: socket.user.user_id,
            timestamp: getCurrentTimestamp()
          });
          
          socket.emit('authenticated', { user: socket.user });
        } else {
          socket.emit('authentication_failed', { message: 'Invalid token' });
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.emit('authentication_failed', { message: 'Authentication failed' });
    }
  });

  // Handle joining conversation rooms
  socket.on('join_conversation', (conversation_id) => {
    if (socket.user) {
      socket.join(`conversation_${conversation_id}`);
      console.log(`User ${socket.user.user_id} joined conversation ${conversation_id}`);
    }
  });

  // Handle leaving conversation rooms
  socket.on('leave_conversation', (conversation_id) => {
    if (socket.user) {
      socket.leave(`conversation_${conversation_id}`);
      console.log(`User ${socket.user.user_id} left conversation ${conversation_id}`);
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    if (socket.user) {
      socket.to(`conversation_${data.conversation_id}`).emit('typing_indicator', {
        conversation_id: data.conversation_id,
        user_id: socket.user.user_id,
        is_typing: true,
        timestamp: getCurrentTimestamp()
      });
    }
  });

  socket.on('typing_stop', (data) => {
    if (socket.user) {
      socket.to(`conversation_${data.conversation_id}`).emit('typing_indicator', {
        conversation_id: data.conversation_id,
        user_id: socket.user.user_id,
        is_typing: false,
        timestamp: getCurrentTimestamp()
      });
    }
  });

  // Handle real-time message sending
  socket.on('send_message', async (data) => {
    if (!socket.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const validatedData = createMessageInputSchema.parse({
        ...data,
        sender_id: socket.user.user_id
      });

      const client = await pool.connect();
      
      try {
        // Verify conversation access
        const conversationResult = await client.query(
          'SELECT guest_id, host_id FROM conversations WHERE conversation_id = $1 AND is_active = true',
          [validatedData.conversation_id]
        );

        if (conversationResult.rows.length === 0) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        const conversation = conversationResult.rows[0];
        if (socket.user.user_id !== conversation.guest_id && socket.user.user_id !== conversation.host_id) {
          socket.emit('error', { message: 'Permission denied' });
          return;
        }

        const message_id = generateId();
        const timestamp = getCurrentTimestamp();

        const result = await client.query(`
          INSERT INTO messages (
            message_id, conversation_id, sender_id, message_text, attachments, is_read, message_type, is_automated, created_at
          ) VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8)
          RETURNING *
        `, [
          message_id, validatedData.conversation_id, validatedData.sender_id, validatedData.message_text,
          validatedData.attachments ? JSON.stringify(validatedData.attachments) : '[]',
          validatedData.message_type, validatedData.is_automated, timestamp
        ]);

        // Update conversation last_message_at
        await client.query(
          'UPDATE conversations SET last_message_at = $1, updated_at = $2 WHERE conversation_id = $3',
          [timestamp, timestamp, validatedData.conversation_id]
        );

        const message = result.rows[0];
        message.attachments = message.attachments ? JSON.parse(message.attachments) : [];

        // Emit to conversation participants
        io.to(`conversation_${validatedData.conversation_id}`).emit('message_sent', {
          message_id: message.message_id,
          conversation_id: message.conversation_id,
          sender_id: message.sender_id,
          message_text: message.message_text,
          attachments: message.attachments,
          message_type: message.message_type,
          is_automated: message.is_automated,
          created_at: message.created_at
        });

        // Send to recipient specifically
        const recipientId = socket.user.user_id === conversation.guest_id ? conversation.host_id : conversation.guest_id;
        io.to(`user_${recipientId}`).emit('message_received', {
          message_id: message.message_id,
          conversation_id: message.conversation_id,
          sender_id: message.sender_id,
          recipient_id: recipientId,
          message_text: message.message_text,
          attachments: message.attachments,
          message_type: message.message_type,
          created_at: message.created_at
        });

      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Socket send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.user) {
      // Emit user offline status
      socket.broadcast.emit('user_offline', {
        user_id: socket.user.user_id,
        last_seen: getCurrentTimestamp()
      });
    }
    console.log('User disconnected:', socket.id);
  });
});

// ============================================================================
// SAVED SEARCHES ENDPOINTS
// ============================================================================

/*
  GET /api/saved-searches - Gets user's saved searches
*/
app.get('/api/saved-searches', authenticateToken, async (req, res) => {
  try {
    const { user_id, is_active = true, limit = 10, offset = 0 } = req.query;

    // Coerce query parameters
    const parsedParams = {
      user_id: user_id ? String(user_id) : req.user.user_id,
      is_active: is_active ? String(is_active).toLowerCase() === 'true' : true,
      limit: Math.min(100, Math.max(1, parseInt(String(limit)) || 10)),
      offset: Math.max(0, parseInt(String(offset)) || 0)
    };

    // Users can only see their own saved searches unless admin
    if (req.user.user_type !== 'admin' && parsedParams.user_id !== req.user.user_id) {
      return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM saved_searches 
        WHERE user_id = $1 AND is_active = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `, [parsedParams.user_id, parsedParams.is_active, parsedParams.limit, parsedParams.offset]);

      const countResult = await client.query(`
        SELECT COUNT(*) FROM saved_searches 
        WHERE user_id = $1 AND is_active = $2
      `, [parsedParams.user_id, parsedParams.is_active]);

      res.json({
        saved_searches: result.rows,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get saved searches error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  POST /api/saved-searches - Creates a new saved search
*/
app.post('/api/saved-searches', authenticateToken, async (req, res) => {
  try {
    const validatedData = createSavedSearchInputSchema.parse(req.body);
    
    // Ensure the user_id matches the authenticated user (unless admin)
    if (req.user.user_id !== validatedData.user_id && req.user.user_type !== 'admin') {
      return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
    }

    const client = await pool.connect();
    
    try {
      const search_id = generateId();
      const timestamp = getCurrentTimestamp();

      const result = await client.query(`
        INSERT INTO saved_searches (
          search_id, user_id, search_name, destination, check_in_date, check_out_date,
          guest_count, property_type, price_min, price_max, amenities, instant_booking,
          distance_beach, distance_airport, host_language, sort_by, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        search_id, validatedData.user_id, validatedData.search_name, validatedData.destination,
        validatedData.check_in_date, validatedData.check_out_date, validatedData.guest_count,
        validatedData.property_type, validatedData.price_min, validatedData.price_max,
        validatedData.amenities ? JSON.stringify(validatedData.amenities) : null,
        validatedData.instant_booking, validatedData.distance_beach, validatedData.distance_airport,
        validatedData.host_language, validatedData.sort_by, validatedData.is_active,
        timestamp, timestamp
      ]);

      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create saved search error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  DELETE /api/saved-searches/:search_id - Deletes a saved search
*/
app.delete('/api/saved-searches/:search_id', authenticateToken, async (req, res) => {
  try {
    const { search_id } = req.params;

    const client = await pool.connect();
    
    try {
      // Check ownership
      const ownerCheck = await client.query('SELECT user_id FROM saved_searches WHERE search_id = $1', [search_id]);
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Saved search not found', null, 'SEARCH_NOT_FOUND'));
      }

      if (ownerCheck.rows[0].user_id !== req.user.user_id && req.user.user_type !== 'admin') {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }

      await client.query('DELETE FROM saved_searches WHERE search_id = $1', [search_id]);

      res.status(204).send();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete saved search error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

/*
  GET /api/notifications - Gets user notifications with filtering options
*/
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { user_id, notification_type, is_read, limit = 10, offset = 0 } = req.query;
    
    // Users can only see their own notifications (unless admin)
    const targetUserId = req.user.user_type === 'admin' && user_id ? user_id : req.user.user_id;
    
    const client = await pool.connect();
    
    try {
      let whereConditions = ['n.user_id = $1'];
      let queryParams = [targetUserId];
      let paramIndex = 2;
      
      if (notification_type) {
        whereConditions.push(`n.notification_type = $${paramIndex}`);
        queryParams.push(notification_type);
        paramIndex++;
      }
      
      if (is_read !== undefined) {
        whereConditions.push(`n.is_read = $${paramIndex}`);
        queryParams.push(is_read === 'true');
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      const query = `
        SELECT n.*, u.first_name, u.last_name, u.profile_photo_url
        FROM notifications n
        LEFT JOIN users u ON n.related_user_id = u.user_id
        WHERE ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(parseInt(limit), parseInt(offset));
      
      const result = await client.query(query, queryParams);
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM notifications n WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));
      
      res.json({
        notifications: result.rows,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// CURRENCY EXCHANGE ENDPOINTS
// ============================================================================

/*
  GET /api/currency-rates - Gets current currency exchange rates
*/
app.get('/api/currency-rates', async (req, res) => {
  try {
    const { base_currency = 'USD', target_currencies } = req.query;
    
    // Mock currency rates for development
    const mockRates = {
      USD: { EUR: 0.925, MXN: 17.25, THB: 34.5, GBP: 0.79, CAD: 1.35 },
      EUR: { USD: 1.08, MXN: 18.65, THB: 37.3, GBP: 0.85, CAD: 1.46 },
      MXN: { USD: 0.058, EUR: 0.054, THB: 2.0, GBP: 0.046, CAD: 0.078 }
    };
    
    const rates = mockRates[base_currency] || mockRates.USD;
    
    let filteredRates = rates;
    if (target_currencies) {
      const targets = Array.isArray(target_currencies) ? target_currencies : target_currencies.split(',');
      filteredRates = {};
      targets.forEach(currency => {
        if (rates[currency]) {
          filteredRates[currency] = rates[currency];
        }
      });
    }
    
    res.json({
      base_currency,
      rates: filteredRates,
      rate_date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Get currency rates error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// SYSTEM ALERTS ENDPOINTS
// ============================================================================

/*
  GET /api/system-alerts - Gets active system alerts
*/
app.get('/api/system-alerts', async (req, res) => {
  try {
    const { severity, is_active = true, limit = 10, offset = 0 } = req.query;
    
    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;
      
      if (is_active !== undefined) {
        whereConditions.push(`is_active = $${paramIndex}`);
        queryParams.push(is_active === 'true');
        paramIndex++;
      }
      
      if (severity) {
        whereConditions.push(`severity = $${paramIndex}`);
        queryParams.push(severity);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const query = `
        SELECT * FROM system_alerts
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(parseInt(limit), parseInt(offset));
      
      const result = await client.query(query, queryParams);
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM system_alerts ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));
      
      res.json({
        alerts: result.rows,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get system alerts error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// LOCATION ENDPOINTS
// ============================================================================

/*
  GET /api/locations - Gets location data with filtering
*/
app.get('/api/locations', async (req, res) => {
  try {
    const { country, is_featured, climate_type = 'hot', limit = 10, offset = 0 } = req.query;
    
    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;
      
      if (country) {
        whereConditions.push(`country ILIKE $${paramIndex}`);
        queryParams.push(`%${country}%`);
        paramIndex++;
      }
      
      if (is_featured !== undefined) {
        whereConditions.push(`is_featured = $${paramIndex}`);
        queryParams.push(is_featured === 'true');
        paramIndex++;
      }
      
      if (climate_type) {
        whereConditions.push(`climate_type = $${paramIndex}`);
        queryParams.push(climate_type);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const query = `
        SELECT * FROM locations
        ${whereClause}
        ORDER BY is_featured DESC, city ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(parseInt(limit), parseInt(offset));
      
      const result = await client.query(query, queryParams);
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM locations ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));
      
      res.json({
        locations: result.rows,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/locations/:location_id/weather - Gets weather data for a location
*/
app.get('/api/locations/:location_id/weather', async (req, res) => {
  try {
    const { location_id } = req.params;
    const { forecast_days = 7 } = req.query;
    
    // Mock weather data for development
    const mockWeatherData = {
      location_id,
      current: {
        temperature_avg: 26.5,
        humidity: 78.2,
        wind_speed: 12.5,
        uv_index: 8.5,
        weather_condition: 'Sunny',
        sunshine_hours: 9.5
      },
      forecast: Array.from({ length: parseInt(forecast_days) }, (_, i) => ({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        temperature_high: 28 + Math.random() * 4,
        temperature_low: 22 + Math.random() * 4,
        humidity: 70 + Math.random() * 20,
        wind_speed: 10 + Math.random() * 10,
        weather_condition: ['Sunny', 'Partly Cloudy', 'Cloudy'][Math.floor(Math.random() * 3)],
        precipitation_chance: Math.random() * 30
      }))
    };
    
    res.json(mockWeatherData);
  } catch (error) {
    console.error('Get weather error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/locations/:location_id/attractions - Gets local attractions
*/
app.get('/api/locations/:location_id/attractions', async (req, res) => {
  try {
    const { location_id } = req.params;
    const { category, limit = 10, offset = 0 } = req.query;
    
    const client = await pool.connect();
    
    try {
      let whereConditions = ['location_id = $1'];
      let queryParams = [location_id];
      let paramIndex = 2;
      
      if (category) {
        whereConditions.push(`category = $${paramIndex}`);
        queryParams.push(category);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      const query = `
        SELECT * FROM attractions
        WHERE ${whereClause}
        ORDER BY rating DESC, name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(parseInt(limit), parseInt(offset));
      
      const result = await client.query(query, queryParams);
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM attractions WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));
      
      res.json({
        attractions: result.rows,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get attractions error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// INVESTMENT ANALYTICS ENDPOINTS
// ============================================================================

/*
  GET /api/market-data - Gets market analysis data (host access required)
*/
app.get('/api/market-data', authenticateToken, async (req, res) => {
  try {
    // Only hosts and admins can access market data
    if (req.user.user_type !== 'host' && req.user.user_type !== 'admin') {
      return res.status(403).json(createErrorResponse('Permission denied - host access required', null, 'PERMISSION_DENIED'));
    }
    
    const { location_id, property_type, limit = 10, offset = 0 } = req.query;
    
    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;
      
      if (location_id) {
        whereConditions.push(`location_id = $${paramIndex}`);
        queryParams.push(location_id);
        paramIndex++;
      }
      
      if (property_type) {
        whereConditions.push(`property_type = $${paramIndex}`);
        queryParams.push(property_type);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const query = `
        SELECT * FROM investment_analytics
        ${whereClause}
        ORDER BY analysis_date DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(parseInt(limit), parseInt(offset));
      
      const result = await client.query(query, queryParams);
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM investment_analytics ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));
      
      res.json({
        market_data: result.rows,
        total: parseInt(countResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get market data error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  GET /api/properties/:property_id/analytics - Gets property investment analytics
*/
app.get('/api/properties/:property_id/analytics', authenticateToken, async (req, res) => {
  try {
    const { property_id } = req.params;
    
    const client = await pool.connect();
    
    try {
      // Check if user owns the property
      const propertyCheck = await client.query('SELECT owner_id FROM properties WHERE property_id = $1', [property_id]);
      if (propertyCheck.rows.length === 0) {
        return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
      }
      
      if (propertyCheck.rows[0].owner_id !== req.user.user_id && req.user.user_type !== 'admin') {
        return res.status(403).json(createErrorResponse('Permission denied', null, 'PERMISSION_DENIED'));
      }
      
      // Mock analytics data for development
      const mockAnalytics = {
        property_id,
        revenue_analysis: {
          monthly_revenue: 3500,
          yearly_projection: 42000,
          occupancy_rate: 0.75,
          average_daily_rate: 185
        },
        market_comparison: {
          market_average_rate: 165,
          performance_vs_market: 1.12,
          ranking_percentile: 78
        },
        investment_metrics: {
          roi_percentage: 8.5,
          payback_period_years: 12,
          cash_flow_monthly: 1200
        }
      };
      
      res.json(mockAnalytics);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get property analytics error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ============================================================================
// HEALTH CHECK AND ERROR HANDLING
// ============================================================================

/*
  GET /api/health - Health check endpoint
*/
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: getCurrentTimestamp(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json(createErrorResponse('Internal server error', error, 'UNHANDLED_ERROR'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json(createErrorResponse('API endpoint not found', null, 'ENDPOINT_NOT_FOUND'));
});

// Catch-all route for SPA routing (serves index.html for non-API routes)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for testing
export { app, pool };

// Start the server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 SunVillas server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready for real-time features`);
    console.log(`🌐 API endpoints available at http://localhost:${PORT}/api`);
  });
}