import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import morgan from 'morgan';
import pkg from 'pg';
const { Pool } = pkg;

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
} from './schema.js';

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

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        ssl: { rejectUnauthorized: false } 
      }
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
function createErrorResponse(message: any, error: any = null, errorCode: string | null = null) {
  const response: any = {
    success: false,
    message,
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
const authenticateToken = async (req: any, res: any, next: any) => {
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
    return res.status(403).json(createErrorResponse('Invalid or expired token', error, 'AUTH_TOKEN_INVALID'));
  }
};

/*
  Optional Authentication Middleware - Adds user info if token is provided but doesn't require it
*/
const optionalAuth = async (req: any, res: any, next: any) => {
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
        RETURNING user_id, email, first_name, last_name, phone_number, profile_photo_url, user_type, bio, languages_spoken, is_verified, is_superhost, currency, language, temperature_unit, created_at
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
      user.languages_spoken = user.languages_spoken ? JSON.parse(user.languages_spoken) : [];

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
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
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
        return res.status(401).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
      }

      const user = result.rows[0];

      // Direct password comparison (no hashing for development)
      if (password !== user.password_hash) {
        return res.status(401).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
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
      user.languages_spoken = user.languages_spoken ? JSON.parse(user.languages_spoken) : [];
      user.notification_settings = user.notification_settings ? JSON.parse(user.notification_settings) : {};

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
      message: 'Logout successful'
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
      user.languages_spoken = user.languages_spoken ? JSON.parse(user.languages_spoken) : [];
      user.notification_settings = user.notification_settings ? JSON.parse(user.notification_settings) : {};

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
    const { limit = '10', offset = '0' } = req.query;
    const limitNum = parseInt(limit as string) || 10;
    const offsetNum = parseInt(offset as string) || 0;

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
      `, [user_id, limitNum, offsetNum]);

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
      sort_by = 'created_at', sort_order = 'desc', limit = '10', offset = '0'
    } = req.query;
    
    const limitNum = parseInt(limit as string) || 10;
    const offsetNum = parseInt(offset as string) || 0;

    const client = await pool.connect();
    
    try {
      let whereConditions = ['p.is_active = true'];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // Build dynamic WHERE conditions
      if (query) {
        whereConditions.push(`(p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR p.city ILIKE $${paramIndex} OR p.country ILIKE $${paramIndex})`);
        queryParams.push(`%${query}%`);
        paramIndex++;
      }

      if (country) {
        whereConditions.push(`p.country ILIKE $${paramIndex}`);
        queryParams.push(`%${country as string}%`);
        paramIndex++;
      }

      if (city) {
        whereConditions.push(`p.city ILIKE $${paramIndex}`);
        queryParams.push(`%${city as string}%`);
        paramIndex++;
      }

      if (property_type) {
        whereConditions.push(`p.property_type = $${paramIndex}`);
        queryParams.push(property_type as string);
        paramIndex++;
      }

      if (guest_count) {
        whereConditions.push(`p.guest_count >= $${paramIndex}`);
        queryParams.push(parseInt(guest_count as string));
        paramIndex++;
      }

      if (price_min) {
        whereConditions.push(`p.base_price_per_night >= $${paramIndex}`);
        queryParams.push(parseFloat(price_min as string));
        paramIndex++;
      }

      if (price_max) {
        whereConditions.push(`p.base_price_per_night <= $${paramIndex}`);
        queryParams.push(parseFloat(price_max as string));
        paramIndex++;
      }

      if (min_bedrooms) {
        whereConditions.push(`p.bedrooms >= $${paramIndex}`);
        queryParams.push(parseInt(min_bedrooms as string));
        paramIndex++;
      }

      if (max_bedrooms) {
        whereConditions.push(`p.bedrooms <= $${paramIndex}`);
        queryParams.push(parseInt(max_bedrooms as string));
        paramIndex++;
      }

      if (min_bathrooms) {
        whereConditions.push(`p.bathrooms >= $${paramIndex}`);
        queryParams.push(parseFloat(min_bathrooms as string));
        paramIndex++;
      }

      if (max_bathrooms) {
        whereConditions.push(`p.bathrooms <= $${paramIndex}`);
        queryParams.push(parseFloat(max_bathrooms as string));
        paramIndex++;
      }

      if (instant_booking !== undefined) {
        whereConditions.push(`p.instant_booking = $${paramIndex}`);
        queryParams.push(instant_booking === 'true');
        paramIndex++;
      }

      if (distance_beach) {
        whereConditions.push(`p.distance_beach <= $${paramIndex}`);
        queryParams.push(parseFloat(distance_beach as string));
        paramIndex++;
      }

      if (distance_airport) {
        whereConditions.push(`p.distance_airport <= $${paramIndex}`);
        queryParams.push(parseFloat(distance_airport as string));
        paramIndex++;
      }

      if (min_rating) {
        whereConditions.push(`p.average_rating >= $${paramIndex}`);
        queryParams.push(parseFloat(min_rating as string));
        paramIndex++;
      }

      if (amenities && Array.isArray(amenities) && amenities.length > 0) {
        whereConditions.push(`p.amenities @> $${paramIndex}`);
        queryParams.push(JSON.stringify(amenities));
        paramIndex++;
      }

      // Availability check if dates provided
      if (check_in_date && check_out_date) {
        whereConditions.push(`
          NOT EXISTS (
            SELECT 1 FROM property_availability pa 
            WHERE pa.property_id = p.property_id 
            AND pa.date >= $${paramIndex} 
            AND pa.date < $${paramIndex + 1}
            AND (pa.is_available = false OR pa.is_blocked = true)
          )
        `);
        queryParams.push(check_in_date, check_out_date);
        paramIndex += 2;
      }

      // Build ORDER BY clause
      let orderByClause = 'ORDER BY ';
      switch (sort_by) {
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
      orderByClause += sort_order === 'asc' ? ' ASC' : ' DESC';

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

      queryParams.push(limitNum, offsetNum);

      const result = await client.query(searchQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM properties p
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const properties = result.rows.map(row => {
        if (row.languages) {
          row.languages = JSON.parse(row.languages);
        }
        if (row.best_visit_months) {
          row.best_visit_months = JSON.parse(row.best_visit_months);
        }
        return row;
      });

      res.json({
        properties,
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
    const { forecast_days = '7', include_historical = 'false' } = req.query;
    
    const forecastDaysNum = parseInt(forecast_days as string) || 7;

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
      for (let i = 0; i < forecastDaysNum; i++) {
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
        current: mockCurrentWeather,
        forecast: mockForecast,
        best_visit_months: location.best_visit_months ? JSON.parse(location.best_visit_months) : []
      };

      if (include_historical === 'true') {
        response.historical = weatherResult.rows;
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
    const { category, is_featured, limit = '10', offset = '0' } = req.query;
    
    const limitNum = parseInt(limit as string) || 10;
    const offsetNum = parseInt(offset as string) || 0;

    const client = await pool.connect();
    
    try {
      let whereConditions = [`location_id = $1`];
      let queryParams: any[] = [location_id];
      let paramIndex = 2;

      if (category) {
        whereConditions.push(`category = $${paramIndex}`);
        queryParams.push(category as string);
        paramIndex++;
      }

      if (is_featured !== undefined) {
        whereConditions.push(`is_featured = $${paramIndex}`);
        queryParams.push(is_featured === 'true' ? 'true' : 'false');
        paramIndex++;
      }

      const attractionsQuery = `
        SELECT * FROM local_attractions
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY is_featured DESC, rating DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limitNum.toString(), offsetNum.toString());

      const result = await client.query(attractionsQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM local_attractions
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      // Process results
      const attractions = result.rows.map(row => {
        row.opening_hours = row.opening_hours ? JSON.parse(row.opening_hours) : {};
        row.image_urls = row.image_urls ? JSON.parse(row.image_urls) : [];
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
    const { min_rating, limit = '10', offset = '0', sort_by = 'created_at', sort_order = 'desc' } = req.query;
    
    const limitNum = parseInt(limit as string) || 10;
    const offsetNum = parseInt(offset as string) || 0;

    const client = await pool.connect();
    
    try {
      let whereConditions = ['r.property_id = $1', 'r.is_visible = true'];
      let queryParams = [property_id];
      let paramIndex = 2;

      if (min_rating) {
        whereConditions.push(`r.overall_rating >= $${paramIndex}`);
        const ratingValue = Array.isArray(min_rating) ? min_rating[0] : min_rating;
        queryParams.push(parseInt(ratingValue as string).toString());
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

      queryParams.push(limitNum.toString(), offsetNum.toString());

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

    const baseCurrencyKey = Array.isArray(base_currency) ? base_currency[0] : base_currency;
    const baseRates = mockRates[baseCurrencyKey as string] || mockRates['USD'];
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
      limit = '10', offset = '0'
    } = req.query;
    
    const limitNum = parseInt(limit as string) || 10;
    const offsetNum = parseInt(offset as string) || 0;

    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams: any[] = [];
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

      queryParams.push(limitNum, offsetNum);

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
    const { location_id, property_type, month, limit = '10', offset = '0' } = req.query;
    
    const limitNum = parseInt(limit as string) || 10;
    const offsetNum = parseInt(offset as string) || 0;

    const client = await pool.connect();
    
    try {
      let whereConditions = [];
      let queryParams: any[] = [];
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

      queryParams.push(limitNum, offsetNum);

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
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const client = await pool.connect();
      
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

// Start the server
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 SunVillas server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time features`);
  console.log(`🌐 API endpoints available at http://localhost:${PORT}/api`);
});