-- Create all tables first
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    profile_photo_url VARCHAR(500),
    user_type VARCHAR(50) NOT NULL DEFAULT 'guest',
    bio TEXT,
    languages_spoken JSONB DEFAULT '[]'::jsonb,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_superhost BOOLEAN NOT NULL DEFAULT false,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    temperature_unit VARCHAR(20) NOT NULL DEFAULT 'celsius',
    notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    address TEXT,
    date_of_birth VARCHAR(20),
    government_id_number VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS properties (
    property_id VARCHAR(255) PRIMARY KEY,
    owner_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    property_type VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    neighborhood VARCHAR(100),
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    bedrooms INTEGER NOT NULL,
    bathrooms DECIMAL(3, 1) NOT NULL,
    guest_count INTEGER NOT NULL,
    property_size DECIMAL(10, 2),
    distance_beach DECIMAL(10, 2),
    distance_airport DECIMAL(10, 2),
    base_price_per_night DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    cleaning_fee DECIMAL(10, 2) DEFAULT 0,
    security_deposit DECIMAL(10, 2) DEFAULT 0,
    extra_guest_fee DECIMAL(10, 2) DEFAULT 0,
    pet_fee DECIMAL(10, 2) DEFAULT 0,
    amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
    house_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    check_in_time VARCHAR(10) NOT NULL DEFAULT '15:00',
    check_out_time VARCHAR(10) NOT NULL DEFAULT '11:00',
    minimum_stay INTEGER NOT NULL DEFAULT 1,
    maximum_stay INTEGER,
    instant_booking BOOLEAN NOT NULL DEFAULT false,
    host_language JSONB NOT NULL DEFAULT '[]'::jsonb,
    cancellation_policy VARCHAR(50) NOT NULL DEFAULT 'moderate',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    average_rating DECIMAL(3, 2),
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS property_photos (
    photo_id VARCHAR(255) PRIMARY KEY,
    property_id VARCHAR(255) NOT NULL,
    photo_url VARCHAR(500) NOT NULL,
    photo_order INTEGER NOT NULL,
    is_cover_photo BOOLEAN NOT NULL DEFAULT false,
    alt_text VARCHAR(500),
    created_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id VARCHAR(255) PRIMARY KEY,
    property_id VARCHAR(255) NOT NULL,
    guest_id VARCHAR(255) NOT NULL,
    check_in_date VARCHAR(20) NOT NULL,
    check_out_date VARCHAR(20) NOT NULL,
    guest_count INTEGER NOT NULL,
    adults INTEGER NOT NULL,
    children INTEGER NOT NULL DEFAULT 0,
    infants INTEGER NOT NULL DEFAULT 0,
    nights INTEGER NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    cleaning_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    service_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    taxes_and_fees DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    special_requests TEXT,
    booking_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    cancellation_reason TEXT,
    cancelled_at VARCHAR(50),
    check_in_instructions TEXT,
    access_code VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id VARCHAR(255) PRIMARY KEY,
    booking_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255),
    payment_date VARCHAR(50),
    refund_amount DECIMAL(10, 2) DEFAULT 0,
    refund_date VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id VARCHAR(255) PRIMARY KEY,
    booking_id VARCHAR(255) NOT NULL,
    property_id VARCHAR(255) NOT NULL,
    reviewer_id VARCHAR(255) NOT NULL,
    overall_rating INTEGER NOT NULL,
    cleanliness_rating INTEGER NOT NULL,
    accuracy_rating INTEGER NOT NULL,
    communication_rating INTEGER NOT NULL,
    location_rating INTEGER NOT NULL,
    checkin_rating INTEGER NOT NULL,
    value_rating INTEGER NOT NULL,
    review_text TEXT,
    review_photos JSONB DEFAULT '[]'::jsonb,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    host_response TEXT,
    host_response_date VARCHAR(50),
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
    conversation_id VARCHAR(255) PRIMARY KEY,
    property_id VARCHAR(255),
    booking_id VARCHAR(255),
    guest_id VARCHAR(255) NOT NULL,
    host_id VARCHAR(255) NOT NULL,
    conversation_type VARCHAR(50) NOT NULL DEFAULT 'inquiry',
    subject VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_message_at VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    message_id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    sender_id VARCHAR(255) NOT NULL,
    message_text TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at VARCHAR(50),
    message_type VARCHAR(50) NOT NULL DEFAULT 'text',
    is_automated BOOLEAN NOT NULL DEFAULT false,
    created_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS property_availability (
    availability_id VARCHAR(255) PRIMARY KEY,
    property_id VARCHAR(255) NOT NULL,
    date VARCHAR(20) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    price_per_night DECIMAL(10, 2),
    minimum_stay INTEGER,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    block_reason VARCHAR(500),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_searches (
    search_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    search_name VARCHAR(255) NOT NULL,
    destination VARCHAR(255),
    check_in_date VARCHAR(20),
    check_out_date VARCHAR(20),
    guest_count INTEGER,
    property_type VARCHAR(100),
    price_min DECIMAL(10, 2),
    price_max DECIMAL(10, 2),
    amenities JSONB DEFAULT '[]'::jsonb,
    instant_booking BOOLEAN,
    distance_beach DECIMAL(10, 2),
    distance_airport DECIMAL(10, 2),
    host_language VARCHAR(50),
    sort_by VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_favorites (
    favorite_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    property_id VARCHAR(255) NOT NULL,
    created_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
    location_id VARCHAR(255) PRIMARY KEY,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    destination_slug VARCHAR(255) UNIQUE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    climate_type VARCHAR(50) NOT NULL,
    average_temperature DECIMAL(5, 2),
    is_hot_destination BOOLEAN NOT NULL DEFAULT true,
    timezone VARCHAR(50) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    languages JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT,
    best_visit_months JSONB DEFAULT '[]'::jsonb,
    featured_image_url VARCHAR(500),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    property_count INTEGER NOT NULL DEFAULT 0,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_data (
    weather_id VARCHAR(255) PRIMARY KEY,
    location_id VARCHAR(255) NOT NULL,
    date VARCHAR(20) NOT NULL,
    temperature_min DECIMAL(5, 2) NOT NULL,
    temperature_max DECIMAL(5, 2) NOT NULL,
    temperature_avg DECIMAL(5, 2) NOT NULL,
    humidity DECIMAL(5, 2),
    wind_speed DECIMAL(5, 2),
    uv_index DECIMAL(3, 1),
    weather_condition VARCHAR(100) NOT NULL,
    rainfall DECIMAL(5, 2) DEFAULT 0,
    sunshine_hours DECIMAL(4, 2),
    is_forecast BOOLEAN NOT NULL DEFAULT false,
    created_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS local_attractions (
    attraction_id VARCHAR(255) PRIMARY KEY,
    location_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT NOT NULL,
    phone_number VARCHAR(50),
    website_url VARCHAR(500),
    opening_hours JSONB DEFAULT '{}'::jsonb,
    admission_fee DECIMAL(10, 2),
    rating DECIMAL(3, 2),
    image_urls JSONB DEFAULT '[]'::jsonb,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at VARCHAR(50),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    expires_at VARCHAR(50),
    created_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS property_inquiries (
    inquiry_id VARCHAR(255) PRIMARY KEY,
    property_id VARCHAR(255) NOT NULL,
    guest_id VARCHAR(255) NOT NULL,
    check_in_date VARCHAR(20),
    check_out_date VARCHAR(20),
    guest_count INTEGER,
    message TEXT NOT NULL,
    inquiry_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    host_response TEXT,
    response_date VARCHAR(50),
    special_offer_price DECIMAL(10, 2),
    expires_at VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS investment_analytics (
    analytics_id VARCHAR(255) PRIMARY KEY,
    property_id VARCHAR(255) NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    purchase_price DECIMAL(15, 2),
    purchase_date VARCHAR(20),
    current_value DECIMAL(15, 2),
    annual_rental_income DECIMAL(15, 2) NOT NULL DEFAULT 0,
    annual_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0,
    occupancy_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    rental_yield DECIMAL(5, 2),
    capital_appreciation DECIMAL(5, 2),
    total_return DECIMAL(5, 2),
    roi_percentage DECIMAL(5, 2),
    year INTEGER NOT NULL,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS market_data (
    market_id VARCHAR(255) PRIMARY KEY,
    location_id VARCHAR(255) NOT NULL,
    property_type VARCHAR(100) NOT NULL,
    average_price_per_sqm DECIMAL(10, 2) NOT NULL,
    average_rental_yield DECIMAL(5, 2) NOT NULL,
    price_growth_12m DECIMAL(5, 2) NOT NULL,
    price_growth_24m DECIMAL(5, 2) NOT NULL,
    rental_demand_score DECIMAL(3, 1) NOT NULL,
    investment_score DECIMAL(3, 1) NOT NULL,
    market_liquidity VARCHAR(50) NOT NULL,
    foreign_ownership_allowed BOOLEAN NOT NULL,
    property_tax_rate DECIMAL(5, 2),
    rental_tax_rate DECIMAL(5, 2),
    legal_requirements JSONB DEFAULT '[]'::jsonb,
    month VARCHAR(7) NOT NULL,
    created_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_verification (
    verification_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    verification_type VARCHAR(50) NOT NULL,
    document_url VARCHAR(500),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    verified_at VARCHAR(50),
    rejection_reason TEXT,
    expires_at VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS property_verification (
    verification_id VARCHAR(255) PRIMARY KEY,
    property_id VARCHAR(255) NOT NULL,
    verification_type VARCHAR(50) NOT NULL,
    document_url VARCHAR(500),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    verified_at VARCHAR(50),
    rejection_reason TEXT,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_modifications (
    modification_id VARCHAR(255) PRIMARY KEY,
    booking_id VARCHAR(255) NOT NULL,
    modification_type VARCHAR(50) NOT NULL,
    old_check_in_date VARCHAR(20),
    new_check_in_date VARCHAR(20),
    old_check_out_date VARCHAR(20),
    new_check_out_date VARCHAR(20),
    old_guest_count INTEGER,
    new_guest_count INTEGER,
    old_total_price DECIMAL(10, 2),
    new_total_price DECIMAL(10, 2),
    price_difference DECIMAL(10, 2),
    modification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    approved_at VARCHAR(50),
    rejection_reason TEXT,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
    contact_id VARCHAR(255) PRIMARY KEY,
    location_id VARCHAR(255) NOT NULL,
    contact_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    available_24_7 BOOLEAN NOT NULL DEFAULT true,
    languages_supported JSONB DEFAULT '[]'::jsonb,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS revenue_analytics (
    revenue_id VARCHAR(255) PRIMARY KEY,
    property_id VARCHAR(255) NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    month VARCHAR(7) NOT NULL,
    year INTEGER NOT NULL,
    total_bookings INTEGER NOT NULL DEFAULT 0,
    nights_booked INTEGER NOT NULL DEFAULT 0,
    gross_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
    net_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
    platform_fees DECIMAL(15, 2) NOT NULL DEFAULT 0,
    occupancy_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    average_daily_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
    revenue_per_available_night DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS currency_rates (
    rate_id VARCHAR(255) PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL,
    target_currency VARCHAR(10) NOT NULL,
    exchange_rate DECIMAL(15, 6) NOT NULL,
    rate_date VARCHAR(20) NOT NULL,
    created_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS system_alerts (
    alert_id VARCHAR(255) PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    affected_locations JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at VARCHAR(50),
    ends_at VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

-- Add foreign key constraints (only if they don't exist)
DO $$ 
BEGIN
    -- Properties constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_properties_owner') THEN
        ALTER TABLE properties ADD CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES users(user_id);
    END IF;
    
    -- Property photos constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_property_photos_property') THEN
        ALTER TABLE property_photos ADD CONSTRAINT fk_property_photos_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    
    -- Bookings constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bookings_property') THEN
        ALTER TABLE bookings ADD CONSTRAINT fk_bookings_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bookings_guest') THEN
        ALTER TABLE bookings ADD CONSTRAINT fk_bookings_guest FOREIGN KEY (guest_id) REFERENCES users(user_id);
    END IF;
    
    -- Payments constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payments_booking') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id);
    END IF;
    
    -- Reviews constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_reviews_booking') THEN
        ALTER TABLE reviews ADD CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_reviews_property') THEN
        ALTER TABLE reviews ADD CONSTRAINT fk_reviews_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_reviews_reviewer') THEN
        ALTER TABLE reviews ADD CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(user_id);
    END IF;
    
    -- Conversations constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_conversations_property') THEN
        ALTER TABLE conversations ADD CONSTRAINT fk_conversations_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_conversations_booking') THEN
        ALTER TABLE conversations ADD CONSTRAINT fk_conversations_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_conversations_guest') THEN
        ALTER TABLE conversations ADD CONSTRAINT fk_conversations_guest FOREIGN KEY (guest_id) REFERENCES users(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_conversations_host') THEN
        ALTER TABLE conversations ADD CONSTRAINT fk_conversations_host FOREIGN KEY (host_id) REFERENCES users(user_id);
    END IF;
    
    -- Messages constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_messages_conversation') THEN
        ALTER TABLE messages ADD CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_messages_sender') THEN
        ALTER TABLE messages ADD CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(user_id);
    END IF;
    
    -- Property availability constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_availability_property') THEN
        ALTER TABLE property_availability ADD CONSTRAINT fk_availability_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'unique_property_date') THEN
        ALTER TABLE property_availability ADD CONSTRAINT unique_property_date UNIQUE (property_id, date);
    END IF;
    
    -- Saved searches constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_saved_searches_user') THEN
        ALTER TABLE saved_searches ADD CONSTRAINT fk_saved_searches_user FOREIGN KEY (user_id) REFERENCES users(user_id);
    END IF;
    
    -- User favorites constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_favorites_user') THEN
        ALTER TABLE user_favorites ADD CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_favorites_property') THEN
        ALTER TABLE user_favorites ADD CONSTRAINT fk_favorites_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    
    -- Weather data constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_weather_location') THEN
        ALTER TABLE weather_data ADD CONSTRAINT fk_weather_location FOREIGN KEY (location_id) REFERENCES locations(location_id);
    END IF;
    
    -- Local attractions constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_attractions_location') THEN
        ALTER TABLE local_attractions ADD CONSTRAINT fk_attractions_location FOREIGN KEY (location_id) REFERENCES locations(location_id);
    END IF;
    
    -- Notifications constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_notifications_user') THEN
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id);
    END IF;
    
    -- Property inquiries constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inquiries_property') THEN
        ALTER TABLE property_inquiries ADD CONSTRAINT fk_inquiries_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_inquiries_guest') THEN
        ALTER TABLE property_inquiries ADD CONSTRAINT fk_inquiries_guest FOREIGN KEY (guest_id) REFERENCES users(user_id);
    END IF;
    
    -- Investment analytics constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_investment_property') THEN
        ALTER TABLE investment_analytics ADD CONSTRAINT fk_investment_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_investment_owner') THEN
        ALTER TABLE investment_analytics ADD CONSTRAINT fk_investment_owner FOREIGN KEY (owner_id) REFERENCES users(user_id);
    END IF;
    
    -- Market data constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_market_location') THEN
        ALTER TABLE market_data ADD CONSTRAINT fk_market_location FOREIGN KEY (location_id) REFERENCES locations(location_id);
    END IF;
    
    -- User verification constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_user_verification_user') THEN
        ALTER TABLE user_verification ADD CONSTRAINT fk_user_verification_user FOREIGN KEY (user_id) REFERENCES users(user_id);
    END IF;
    
    -- Property verification constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_property_verification_property') THEN
        ALTER TABLE property_verification ADD CONSTRAINT fk_property_verification_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    
    -- Booking modifications constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_modifications_booking') THEN
        ALTER TABLE booking_modifications ADD CONSTRAINT fk_modifications_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id);
    END IF;
    
    -- Emergency contacts constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_emergency_location') THEN
        ALTER TABLE emergency_contacts ADD CONSTRAINT fk_emergency_location FOREIGN KEY (location_id) REFERENCES locations(location_id);
    END IF;
    
    -- Revenue analytics constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_revenue_property') THEN
        ALTER TABLE revenue_analytics ADD CONSTRAINT fk_revenue_property FOREIGN KEY (property_id) REFERENCES properties(property_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_revenue_owner') THEN
        ALTER TABLE revenue_analytics ADD CONSTRAINT fk_revenue_owner FOREIGN KEY (owner_id) REFERENCES users(user_id);
    END IF;
END $$;

-- Seed data
INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone_number, profile_photo_url, user_type, bio, languages_spoken, is_verified, is_superhost, currency, language, temperature_unit, notification_settings, emergency_contact_name, emergency_contact_phone, address, date_of_birth, government_id_number, is_active, last_login_at, created_at, updated_at) VALUES
('user_001', 'john.host@example.com', 'password123', 'John', 'Anderson', '+1-555-0101', 'https://picsum.photos/seed/user001/400/400', 'host', 'Experienced host with over 50 properties. Love meeting travelers from around the world!', '["English", "Spanish", "French"]', true, true, 'USD', 'en', 'fahrenheit', '{"email": true, "sms": true, "push": true}', 'Jane Anderson', '+1-555-0102', '123 Main St, Miami, FL 33101', '1985-06-15', 'P123456789', true, '2024-01-15T10:30:00Z', '2023-01-01T00:00:00Z', '2024-01-15T10:30:00Z'),
('user_002', 'maria.garcia@example.com', 'password123', 'Maria', 'Garcia', '+34-600-123456', 'https://picsum.photos/seed/user002/400/400', 'host', 'Superhost in Barcelona. I provide authentic local experiences for my guests.', '["Spanish", "English", "Catalan"]', true, true, 'EUR', 'es', 'celsius', '{"email": true, "sms": false, "push": true}', 'Carlos Garcia', '+34-600-123457', 'Carrer de Balmes 150, Barcelona 08008', '1988-03-22', 'DNI12345678X', true, '2024-01-14T16:45:00Z', '2023-02-15T00:00:00Z', '2024-01-14T16:45:00Z'),
('user_003', 'sarah.guest@example.com', 'user123', 'Sarah', 'Johnson', '+1-555-0201', 'https://picsum.photos/seed/user003/400/400', 'guest', 'Digital nomad who loves exploring tropical destinations and working remotely.', '["English"]', true, false, 'USD', 'en', 'fahrenheit', '{"email": true, "sms": true, "push": false}', 'Michael Johnson', '+1-555-0202', '456 Oak Ave, San Francisco, CA 94102', '1992-11-08', 'DL987654321', true, '2024-01-15T08:20:00Z', '2023-03-10T00:00:00Z', '2024-01-15T08:20:00Z'),
('user_004', 'pierre.dubois@example.com', 'password123', 'Pierre', 'Dubois', '+33-6-12-34-56-78', 'https://picsum.photos/seed/user004/400/400', 'host', 'French property owner specializing in luxury villas on the Riviera.', '["French", "English", "Italian"]', true, false, 'EUR', 'fr', 'celsius', '{"email": true, "sms": true, "push": true}', 'Claire Dubois', '+33-6-12-34-56-79', '15 Promenade des Anglais, Nice 06000', '1975-09-12', 'FR123456789', true, '2024-01-13T14:15:00Z', '2023-04-20T00:00:00Z', '2024-01-13T14:15:00Z'),
('user_005', 'alex.traveler@example.com', 'user123', 'Alex', 'Chen', '+1-555-0301', 'https://picsum.photos/seed/user005/400/400', 'guest', 'Adventure seeker always looking for unique accommodations in exotic locations.', '["English", "Mandarin"]', false, false, 'USD', 'en', 'celsius', '{"email": true, "sms": false, "push": true}', 'Linda Chen', '+1-555-0302', '789 Pine St, Seattle, WA 98101', '1990-07-25', 'WA123456789', true, '2024-01-14T12:00:00Z', '2023-05-05T00:00:00Z', '2024-01-14T12:00:00Z'),
('user_006', 'emma.wilson@example.com', 'password123', 'Emma', 'Wilson', '+44-7700-900123', 'https://picsum.photos/seed/user006/400/400', 'host', 'UK property investor with portfolio across tropical destinations.', '["English"]', true, false, 'GBP', 'en', 'celsius', '{"email": true, "sms": true, "push": false}', 'James Wilson', '+44-7700-900124', '10 Downing Street, London SW1A 2AA', '1982-12-03', 'GB987654321', true, '2024-01-15T09:30:00Z', '2023-06-01T00:00:00Z', '2024-01-15T09:30:00Z'),
('user_007', 'carlos.host@example.com', 'admin123', 'Carlos', 'Rodriguez', '+52-55-1234-5678', 'https://picsum.photos/seed/user007/400/400', 'host', 'Luxury resort owner in Tulum with passion for sustainable tourism.', '["Spanish", "English"]', true, true, 'MXN', 'es', 'celsius', '{"email": true, "sms": true, "push": true}', 'Ana Rodriguez', '+52-55-1234-5679', 'Zona Hotelera, Tulum 77780', '1980-04-17', 'CURP123456789', true, '2024-01-15T11:45:00Z', '2023-07-15T00:00:00Z', '2024-01-15T11:45:00Z'),
('user_008', 'lisa.guest@example.com', 'user123', 'Lisa', 'Thompson', '+1-555-0401', 'https://picsum.photos/seed/user008/400/400', 'guest', 'Frequent business traveler who enjoys luxury accommodations and excellent service.', '["English"]', true, false, 'USD', 'en', 'fahrenheit', '{"email": true, "sms": false, "push": true}', 'David Thompson', '+1-555-0402', '321 Business Blvd, Chicago, IL 60601', '1987-01-30', 'IL123456789', true, '2024-01-14T18:20:00Z', '2023-08-10T00:00:00Z', '2024-01-14T18:20:00Z')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO locations (location_id, country, city, region, destination_slug, latitude, longitude, climate_type, average_temperature, is_hot_destination, timezone, currency, languages, description, best_visit_months, featured_image_url, is_featured, property_count, created_at, updated_at) VALUES
('loc_001', 'Mexico', 'Tulum', 'Quintana Roo', 'tulum-mexico', 20.2114185, -87.4653502, 'tropical', 26.5, true, 'America/Cancun', 'MXN', '["Spanish", "English"]', 'Ancient Mayan paradise with stunning beaches, cenotes, and eco-luxury resorts along the Caribbean coast.', '["November", "December", "January", "February", "March", "April"]', 'https://picsum.photos/seed/tulum/800/600', true, 0, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('loc_002', 'Thailand', 'Phuket', 'Phuket Province', 'phuket-thailand', 7.8804479, 98.3922504, 'tropical', 28.0, true, 'Asia/Bangkok', 'THB', '["Thai", "English"]', 'Tropical island paradise famous for pristine beaches, vibrant nightlife, and luxury resorts.', '["November", "December", "January", "February", "March"]', 'https://picsum.photos/seed/phuket/800/600', true, 0, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('loc_003', 'Spain', 'Ibiza', 'Balearic Islands', 'ibiza-spain', 38.9067339, 1.4205983, 'mediterranean', 22.5, true, 'Europe/Madrid', 'EUR', '["Spanish", "English", "German"]', 'Mediterranean island known for world-class beaches, vibrant nightlife, and luxury villas.', '["May", "June", "July", "August", "September", "October"]', 'https://picsum.photos/seed/ibiza/800/600', true, 0, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('loc_004', 'Indonesia', 'Bali', 'Bali Province', 'bali-indonesia', -8.4095178, 115.188916, 'tropical', 27.0, true, 'Asia/Makassar', 'IDR', '["Indonesian", "English"]', 'Tropical paradise combining ancient culture, stunning beaches, lush rice terraces, and spiritual retreats.', '["April", "May", "June", "July", "August", "September"]', 'https://picsum.photos/seed/bali/800/600', true, 0, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('loc_005', 'Greece', 'Mykonos', 'South Aegean', 'mykonos-greece', 37.4467354, 25.3289754, 'mediterranean', 21.8, true, 'Europe/Athens', 'EUR', '["Greek", "English"]', 'Iconic Greek island famous for whitewashed architecture, crystal-clear waters, and cosmopolitan atmosphere.', '["May", "June", "July", "August", "September"]', 'https://picsum.photos/seed/mykonos/800/600', true, 0, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('loc_006', 'Maldives', 'Male', 'Kaafu Atoll', 'maldives', 4.1755200, 73.5092300, 'tropical', 29.0, true, 'Indian/Maldives', 'MVR', '["Dhivehi", "English"]', 'Ultimate luxury destination with overwater bungalows, pristine coral reefs, and world-class diving.', '["November", "December", "January", "February", "March", "April"]', 'https://picsum.photos/seed/maldives/800/600', true, 0, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z')
ON CONFLICT (location_id) DO NOTHING;

INSERT INTO properties (property_id, owner_id, title, description, property_type, country, city, region, neighborhood, address, latitude, longitude, bedrooms, bathrooms, guest_count, property_size, distance_beach, distance_airport, base_price_per_night, currency, cleaning_fee, security_deposit, extra_guest_fee, pet_fee, amenities, house_rules, check_in_time, check_out_time, minimum_stay, maximum_stay, instant_booking, host_language, cancellation_policy, is_active, is_verified, average_rating, review_count, created_at, updated_at) VALUES
('prop_001', 'user_001', 'Luxury Beachfront Villa in Tulum', 'Stunning 4-bedroom villa with private beach access, infinity pool, and panoramic Caribbean views. Perfect for families or groups seeking luxury in paradise.', 'villa', 'Mexico', 'Tulum', 'Quintana Roo', 'Zona Hotelera', 'Carretera Tulum-Boca Paila Km 8.5, Tulum 77780', 20.1948842, -87.4661623, 4, 3.5, 8, 320.50, 0.1, 35.2, 450.00, 'USD', 75.00, 500.00, 50.00, 25.00, '["Private Pool", "Beach Access", "WiFi", "Air Conditioning", "Kitchen", "Parking", "Ocean View", "Balcony"]', '["No smoking", "No parties", "Check-in after 3 PM", "Check-out before 11 AM"]', '15:00', '11:00', 3, 14, true, '["English", "Spanish"]', 'moderate', true, true, 4.8, 47, '2023-01-15T00:00:00Z', '2024-01-15T00:00:00Z'),
('prop_002', 'user_002', 'Authentic Barcelona Penthouse', 'Spacious penthouse in the heart of Barcelona with rooftop terrace and stunning city views. Walking distance to Sagrada Familia and Park Güell.', 'apartment', 'Spain', 'Barcelona', 'Catalonia', 'Eixample', 'Carrer de Balmes 200, Barcelona 08006', 41.3947688, 2.1609157, 3, 2.0, 6, 140.00, 15.5, 12.8, 180.00, 'EUR', 50.00, 200.00, 25.00, 0.00, '["WiFi", "Air Conditioning", "Kitchen", "Balcony", "City View", "Elevator", "Washing Machine"]', '["No smoking", "No parties", "Quiet hours 10 PM - 8 AM"]', '16:00', '11:00', 2, 30, false, '["Spanish", "English", "Catalan"]', 'strict', true, true, 4.6, 23, '2023-02-20T00:00:00Z', '2024-01-14T00:00:00Z'),
('prop_003', 'user_004', 'French Riviera Luxury Villa', 'Magnificent 5-bedroom villa with private pool, tennis court, and breathtaking Mediterranean views. Ultimate luxury on the Côte d''Azur.', 'villa', 'France', 'Nice', 'Provence-Alpes-Côte d''Azur', 'Mont Boron', '25 Avenue de la Corniche, Nice 06300', 43.6968358, 7.2889160, 5, 4.0, 10, 450.75, 2.1, 8.5, 850.00, 'EUR', 150.00, 1000.00, 75.00, 50.00, '["Private Pool", "Tennis Court", "WiFi", "Air Conditioning", "Kitchen", "Parking", "Ocean View", "Garden", "Gym"]', '["No smoking", "No parties", "No pets", "Check-in after 4 PM"]', '16:00', '11:00', 7, 21, false, '["French", "English", "Italian"]', 'moderate', true, true, 4.9, 31, '2023-04-25T00:00:00Z', '2024-01-13T00:00:00Z'),
('prop_004', 'user_006', 'Tropical Paradise Villa Phuket', 'Exclusive 6-bedroom villa with private infinity pool, direct beach access, and personal chef service. Ultimate tropical luxury experience.', 'villa', 'Thailand', 'Phuket', 'Phuket Province', 'Kamala', '88/8 Moo 3, Kamala Beach, Phuket 83150', 7.9619407, 98.2858731, 6, 5.0, 12, 520.25, 0.0, 25.3, 750.00, 'USD', 100.00, 800.00, 60.00, 0.00, '["Private Pool", "Beach Access", "WiFi", "Air Conditioning", "Kitchen", "Chef Service", "Spa", "Gym", "Ocean View"]', '["No smoking", "Respect local customs", "Check-in after 3 PM"]', '15:00', '11:00', 5, 28, true, '["English"]', 'flexible', true, true, 4.9, 18, '2023-06-05T00:00:00Z', '2024-01-15T00:00:00Z'),
('prop_005', 'user_007', 'Eco-Luxury Treehouse Tulum', 'Unique elevated treehouse experience with panoramic jungle views, sustainable design, and modern amenities. Perfect romantic getaway.', 'treehouse', 'Mexico', 'Tulum', 'Quintana Roo', 'Aldea Zama', 'Calle 7 Sur, Aldea Zama, Tulum 77760', 20.2089756, -87.4305173, 1, 1.0, 2, 65.00, 1.8, 5.2, 220.00, 'USD', 40.00, 150.00, 0.00, 0.00, '["WiFi", "Air Conditioning", "Kitchen", "Jungle View", "Eco-Friendly", "Balcony", "Outdoor Shower"]', '["No smoking", "No parties", "Adults only", "Respect nature"]', '15:00', '11:00', 2, 7, true, '["Spanish", "English"]', 'moderate', true, true, 4.7, 12, '2023-07-20T00:00:00Z', '2024-01-15T00:00:00Z'),
('prop_006', 'user_001', 'Ibiza Party Villa with Pool', 'Modern 3-bedroom villa perfect for groups, featuring large pool, outdoor sound system, and close to best beach clubs. Party-friendly property.', 'villa', 'Spain', 'Ibiza', 'Balearic Islands', 'Playa d''en Bossa', 'Carrer de Madrid 15, Playa d''en Bossa, Ibiza 07817', 38.8719553, 1.4059806, 3, 2.5, 8, 180.00, 0.5, 8.2, 380.00, 'EUR', 80.00, 400.00, 40.00, 25.00, '["Private Pool", "WiFi", "Air Conditioning", "Kitchen", "Sound System", "Parking", "Near Beach", "Outdoor Dining"]', '["Parties allowed until 2 AM", "No smoking indoors", "Respect neighbors"]', '16:00', '11:00', 3, 14, false, '["English", "Spanish"]', 'moderate', true, true, 4.5, 28, '2023-08-12T00:00:00Z', '2024-01-15T00:00:00Z')
ON CONFLICT (property_id) DO NOTHING;

INSERT INTO property_photos (photo_id, property_id, photo_url, photo_order, is_cover_photo, alt_text, created_at) VALUES
('photo_001', 'prop_001', 'https://picsum.photos/seed/prop001-1/800/600', 1, true, 'Luxury villa exterior with infinity pool and ocean view', '2023-01-15T00:00:00Z'),
('photo_002', 'prop_001', 'https://picsum.photos/seed/prop001-2/800/600', 2, false, 'Master bedroom with ocean view', '2023-01-15T00:00:00Z'),
('photo_003', 'prop_001', 'https://picsum.photos/seed/prop001-3/800/600', 3, false, 'Modern kitchen with island', '2023-01-15T00:00:00Z'),
('photo_004', 'prop_001', 'https://picsum.photos/seed/prop001-4/800/600', 4, false, 'Private beach access', '2023-01-15T00:00:00Z'),
('photo_005', 'prop_002', 'https://picsum.photos/seed/prop002-1/800/600', 1, true, 'Barcelona penthouse rooftop terrace', '2023-02-20T00:00:00Z'),
('photo_006', 'prop_002', 'https://picsum.photos/seed/prop002-2/800/600', 2, false, 'Living room with city views', '2023-02-20T00:00:00Z'),
('photo_007', 'prop_002', 'https://picsum.photos/seed/prop002-3/800/600', 3, false, 'Modern bathroom', '2023-02-20T00:00:00Z'),
('photo_008', 'prop_003', 'https://picsum.photos/seed/prop003-1/800/600', 1, true, 'French Riviera villa with Mediterranean view', '2023-04-25T00:00:00Z'),
('photo_009', 'prop_003', 'https://picsum.photos/seed/prop003-2/800/600', 2, false, 'Tennis court and gardens', '2023-04-25T00:00:00Z'),
('photo_010', 'prop_003', 'https://picsum.photos/seed/prop003-3/800/600', 3, false, 'Luxury master suite', '2023-04-25T00:00:00Z'),
('photo_011', 'prop_004', 'https://picsum.photos/seed/prop004-1/800/600', 1, true, 'Phuket villa infinity pool and beach', '2023-06-05T00:00:00Z'),
('photo_012', 'prop_004', 'https://picsum.photos/seed/prop004-2/800/600', 2, false, 'Spa and wellness area', '2023-06-05T00:00:00Z'),
('photo_013', 'prop_005', 'https://picsum.photos/seed/prop005-1/800/600', 1, true, 'Tulum treehouse with jungle view', '2023-07-20T00:00:00Z'),
('photo_014', 'prop_005', 'https://picsum.photos/seed/prop005-2/800/600', 2, false, 'Outdoor shower and deck', '2023-07-20T00:00:00Z'),
('photo_015', 'prop_006', 'https://picsum.photos/seed/prop006-1/800/600', 1, true, 'Ibiza party villa pool area', '2023-08-12T00:00:00Z')
ON CONFLICT (photo_id) DO NOTHING;

INSERT INTO bookings (booking_id, property_id, guest_id, check_in_date, check_out_date, guest_count, adults, children, infants, nights, base_price, cleaning_fee, service_fee, taxes_and_fees, total_price, currency, special_requests, booking_status, payment_status, cancellation_reason, cancelled_at, check_in_instructions, access_code, created_at, updated_at) VALUES
('book_001', 'prop_001', 'user_003', '2024-02-15', '2024-02-22', 6, 4, 2, 0, 7, 3150.00, 75.00, 315.00, 189.00, 3729.00, 'USD', 'Late check-in around 8 PM, vegetarian meals preferred', 'confirmed', 'completed', null, null, 'Check-in at main gate, key in lockbox code 1234', '1234', '2024-01-10T14:30:00Z', '2024-01-12T09:15:00Z'),
('book_002', 'prop_002', 'user_005', '2024-03-01', '2024-03-08', 4, 4, 0, 0, 7, 1260.00, 50.00, 126.00, 75.60, 1511.60, 'EUR', 'Business trip, need good WiFi and quiet workspace', 'confirmed', 'completed', null, null, 'Building code 5678, apartment 4B', '5678', '2024-02-18T16:45:00Z', '2024-02-20T11:20:00Z'),
('book_003', 'prop_003', 'user_008', '2024-04-10', '2024-04-17', 8, 6, 2, 0, 7, 5950.00, 150.00, 595.00, 357.00, 7052.00, 'EUR', 'Celebrating anniversary, champagne and flowers appreciated', 'confirmed', 'pending', null, null, null, null, '2024-03-25T10:15:00Z', '2024-03-25T10:15:00Z'),
('book_004', 'prop_004', 'user_003', '2024-05-20', '2024-05-27', 10, 8, 2, 0, 7, 5250.00, 100.00, 525.00, 315.00, 6190.00, 'USD', 'Group yoga retreat, need early morning pool access', 'confirmed', 'completed', null, null, 'Private gate code 9876, villa staff will greet you', '9876', '2024-04-30T12:00:00Z', '2024-05-02T08:30:00Z'),
('book_005', 'prop_005', 'user_005', '2024-06-14', '2024-06-16', 2, 2, 0, 0, 2, 440.00, 40.00, 44.00, 26.40, 550.40, 'USD', 'Honeymoon trip, romantic setup requested', 'confirmed', 'completed', null, null, 'Follow jungle path signs, treehouse #7', 'TREE7', '2024-06-01T18:20:00Z', '2024-06-03T14:45:00Z'),
('book_006', 'prop_006', 'user_008', '2024-07-25', '2024-07-30', 6, 6, 0, 0, 5, 1900.00, 80.00, 190.00, 114.00, 2284.00, 'EUR', 'Birthday party group, music until late evening', 'cancelled', 'refunded', 'Travel plans changed due to work', '2024-07-15T09:30:00Z', null, null, '2024-07-10T13:15:00Z', '2024-07-15T09:30:00Z'),
('book_007', 'prop_001', 'user_008', '2024-08-05', '2024-08-12', 8, 6, 2, 0, 7, 3150.00, 75.00, 315.00, 189.00, 3729.00, 'USD', 'Family vacation, cribs for infants needed', 'completed', 'completed', null, null, 'Check-in at main gate, key in lockbox code 5555', '5555', '2024-07-20T11:45:00Z', '2024-08-13T10:00:00Z')
ON CONFLICT (booking_id) DO NOTHING;

INSERT INTO payments (payment_id, booking_id, amount, currency, payment_method, payment_status, transaction_id, payment_date, refund_amount, refund_date, created_at, updated_at) VALUES
('pay_001', 'book_001', 3729.00, 'USD', 'credit_card', 'completed', 'txn_cc_001_20240110', '2024-01-10T14:35:00Z', 0.00, null, '2024-01-10T14:35:00Z', '2024-01-10T14:35:00Z'),
('pay_002', 'book_002', 1511.60, 'EUR', 'paypal', 'completed', 'txn_pp_002_20240218', '2024-02-18T16:50:00Z', 0.00, null, '2024-02-18T16:50:00Z', '2024-02-18T16:50:00Z'),
('pay_003', 'book_003', 3526.00, 'EUR', 'bank_transfer', 'pending', null, null, 0.00, null, '2024-03-25T10:20:00Z', '2024-03-25T10:20:00Z'),
('pay_004', 'book_004', 6190.00, 'USD', 'credit_card', 'completed', 'txn_cc_004_20240430', '2024-04-30T12:05:00Z', 0.00, null, '2024-04-30T12:05:00Z', '2024-04-30T12:05:00Z'),
('pay_005', 'book_005', 550.40, 'USD', 'credit_card', 'completed', 'txn_cc_005_20240601', '2024-06-01T18:25:00Z', 0.00, null, '2024-06-01T18:25:00Z', '2024-06-01T18:25:00Z'),
('pay_006', 'book_006', 2284.00, 'EUR', 'credit_card', 'refunded', 'txn_cc_006_20240710', '2024-07-10T13:20:00Z', 1900.00, '2024-07-15T09:35:00Z', '2024-07-10T13:20:00Z', '2024-07-15T09:35:00Z'),
('pay_007', 'book_007', 3729.00, 'USD', 'debit_card', 'completed', 'txn_dc_007_20240720', '2024-07-20T11:50:00Z', 0.00, null, '2024-07-20T11:50:00Z', '2024-07-20T11:50:00Z')
ON CONFLICT (payment_id) DO NOTHING;

INSERT INTO reviews (review_id, booking_id, property_id, reviewer_id, overall_rating, cleanliness_rating, accuracy_rating, communication_rating, location_rating, checkin_rating, value_rating, review_text, review_photos, is_anonymous, host_response, host_response_date, is_visible, created_at, updated_at) VALUES
('rev_001', 'book_001', 'prop_001', 'user_003', 5, 5, 5, 5, 5, 5, 4, 'Absolutely stunning villa! The ocean views were breathtaking and the villa exceeded all expectations. John was an amazing host, very responsive and helpful. The private beach access was a dream come true. Only minor issue was the cleaning fee seemed a bit high, but overall fantastic experience!', '["https://picsum.photos/seed/review001-1/600/400", "https://picsum.photos/seed/review001-2/600/400"]', false, 'Thank you Sarah! So happy you enjoyed your stay. We take pride in maintaining our villa to the highest standards. Hope to welcome you back soon!', '2024-02-23T10:15:00Z', true, '2024-02-23T09:30:00Z', '2024-02-23T10:15:00Z'),
('rev_002', 'book_002', 'prop_002', 'user_005', 4, 4, 5, 5, 5, 4, 4, 'Great location in Barcelona, perfect for exploring the city. The rooftop terrace was amazing for morning coffee. WiFi was excellent for remote work. Maria was very helpful with local recommendations. Only downside was some noise from the street at night.', '["https://picsum.photos/seed/review002-1/600/400"]', false, 'Thanks Alex! Glad you enjoyed the terrace and found the location convenient. I apologize for the street noise - we are looking into better soundproofing options.', '2024-03-09T14:20:00Z', true, '2024-03-09T12:45:00Z', '2024-03-09T14:20:00Z'),
('rev_003', 'book_005', 'prop_005', 'user_005', 5, 5, 5, 5, 4, 5, 5, 'The most unique accommodation we''ve ever stayed in! The treehouse was beautifully designed and incredibly romantic. Perfect for our honeymoon. Carlos was attentive without being intrusive. The jungle sounds at night were magical. Highly recommend for couples!', '["https://picsum.photos/seed/review003-1/600/400", "https://picsum.photos/seed/review003-2/600/400", "https://picsum.photos/seed/review003-3/600/400"]', false, 'Congratulations on your marriage! I''m thrilled the treehouse provided the perfect setting for your honeymoon. Thank you for choosing our eco-sanctuary!', '2024-06-17T16:30:00Z', true, '2024-06-17T15:15:00Z', '2024-06-17T16:30:00Z'),
('rev_004', 'book_007', 'prop_001', 'user_008', 5, 5, 5, 4, 5, 5, 5, 'Second time staying at this amazing villa and it continues to impress! Perfect for our family vacation. Kids loved the pool and beach access. The villa is immaculately maintained and has everything you need. John is a superhost for a reason - excellent communication and hospitality.', '["https://picsum.photos/seed/review004-1/600/400"]', false, 'Thank you Lisa for being such wonderful returning guests! Your family is always welcome. So glad the kids had fun at the beach and pool!', '2024-08-14T11:45:00Z', true, '2024-08-14T10:20:00Z', '2024-08-14T11:45:00Z')
ON CONFLICT (review_id) DO NOTHING;

INSERT INTO conversations (conversation_id, property_id, booking_id, guest_id, host_id, conversation_type, subject, is_active, last_message_at, created_at, updated_at) VALUES
('conv_001', 'prop_001', 'book_001', 'user_003', 'user_001', 'booking', 'Tulum Villa Booking Inquiry', false, '2024-02-22T14:30:00Z', '2024-01-08T10:15:00Z', '2024-02-22T14:30:00Z'),
('conv_002', 'prop_002', 'book_002', 'user_005', 'user_002', 'booking', 'Barcelona Penthouse Business Trip', false, '2024-03-08T16:20:00Z', '2024-02-15T09:30:00Z', '2024-03-08T16:20:00Z'),
('conv_003', 'prop_003', null, 'user_008', 'user_004', 'inquiry', 'French Riviera Villa Availability', true, '2024-01-14T18:45:00Z', '2024-01-14T15:20:00Z', '2024-01-14T18:45:00Z'),
('conv_004', 'prop_004', 'book_004', 'user_003', 'user_006', 'booking', 'Phuket Yoga Retreat Booking', false, '2024-05-27T12:00:00Z', '2024-04-28T14:45:00Z', '2024-05-27T12:00:00Z'),
('conv_005', 'prop_005', 'book_005', 'user_005', 'user_007', 'booking', 'Honeymoon Treehouse Experience', false, '2024-06-16T20:15:00Z', '2024-05-30T11:30:00Z', '2024-06-16T20:15:00Z')
ON CONFLICT (conversation_id) DO NOTHING;

INSERT INTO messages (message_id, conversation_id, sender_id, message_text, attachments, is_read, read_at, message_type, is_automated, created_at) VALUES
('msg_001', 'conv_001', 'user_003', 'Hi John! I''m interested in booking your beautiful Tulum villa for February 15-22. We''re a group of 6 adults looking for a luxury beach vacation. Is the property available for those dates?', '[]', true, '2024-01-08T11:00:00Z', 'text', false, '2024-01-08T10:15:00Z'),
('msg_002', 'conv_001', 'user_001', 'Hello Sarah! Yes, the villa is available for those dates. I''d be happy to host your group! The villa is perfect for 6 guests with stunning ocean views and private beach access. The total would be $3,729 including all fees. Would you like me to send a booking request?', '[]', true, '2024-01-08T12:30:00Z', 'text', false, '2024-01-08T11:45:00Z'),
('msg_003', 'conv_001', 'user_003', 'That sounds perfect! Yes, please send the booking request. We''re particularly excited about the private beach and infinity pool. Is late check-in around 8 PM possible?', '[]', true, '2024-01-08T13:15:00Z', 'text', false, '2024-01-08T12:45:00Z'),
('msg_004', 'conv_001', 'user_001', 'Absolutely! Late check-in is no problem at all. I''ll provide you with the gate code and detailed instructions. Booking request sent! Looking forward to hosting you and your friends.', '[]', true, '2024-01-08T14:20:00Z', 'text', false, '2024-01-08T13:30:00Z'),
('msg_005', 'conv_002', 'user_005', 'Hello Maria! I need accommodation in Barcelona for a business trip March 1-8. Your penthouse looks perfect with the workspace setup. Is it available and does the WiFi support video calls?', '[]', true, '2024-02-15T10:15:00Z', 'text', false, '2024-02-15T09:30:00Z'),
('msg_006', 'conv_002', 'user_002', 'Hi Alex! Yes, the penthouse is available for your dates. The WiFi is fiber optic with 500mbps download speed, perfect for video calls. The terrace also makes a great outdoor office. Shall I send you a booking request?', '[]', true, '2024-02-15T11:30:00Z', 'text', false, '2024-02-15T10:45:00Z'),
('msg_007', 'conv_003', 'user_008', 'Bonjour Pierre! Your French Riviera villa looks absolutely stunning. Do you have availability for April 10-17? We''re a group of 8 celebrating an anniversary and would love the luxury experience.', '[]', true, '2024-01-14T16:00:00Z', 'text', false, '2024-01-14T15:20:00Z'),
('msg_008', 'conv_003', 'user_004', 'Bonjour Lisa! Thank you for your interest in our villa. Yes, we have availability for those dates. The villa is perfect for celebrations with its tennis court, pool, and stunning Mediterranean views. For 8 guests, the rate would be €7,052 total. Would you like more details about the amenities?', '[]', false, null, 'text', false, '2024-01-14T17:15:00Z'),
('msg_009', 'conv_003', 'user_008', 'That sounds wonderful! Could you tell me more about the tennis court and whether you provide any concierge services? We''d love to arrange some special touches for the anniversary celebration.', '[]', false, null, 'text', false, '2024-01-14T18:45:00Z')
ON CONFLICT (message_id) DO NOTHING;

INSERT INTO property_availability (availability_id, property_id, date, is_available, price_per_night, minimum_stay, is_blocked, block_reason, created_at, updated_at) VALUES
('avail_001', 'prop_001', '2024-02-01', true, 450.00, 3, false, null, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('avail_002', 'prop_001', '2024-02-15', false, 450.00, 3, false, null, '2024-01-01T00:00:00Z', '2024-01-10T14:30:00Z'),
('avail_003', 'prop_001', '2024-03-01', true, 475.00, 3, false, null, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('avail_004', 'prop_002', '2024-03-01', false, 180.00, 2, false, null, '2024-01-01T00:00:00Z', '2024-02-18T16:45:00Z'),
('avail_005', 'prop_002', '2024-04-01', true, 200.00, 2, false, null, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('avail_006', 'prop_003', '2024-04-10', false, 850.00, 7, false, null, '2024-01-01T00:00:00Z', '2024-03-25T10:15:00Z'),
('avail_007', 'prop_003', '2024-05-01', true, 950.00, 7, false, null, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('avail_008', 'prop_004', '2024-05-20', false, 750.00, 5, false, null, '2024-01-01T00:00:00Z', '2024-04-30T12:00:00Z'),
('avail_009', 'prop_004', '2024-06-01', true, 850.00, 5, false, null, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('avail_010', 'prop_005', '2024-06-14', false, 220.00, 2, false, null, '2024-01-01T00:00:00Z', '2024-06-01T18:20:00Z'),
('avail_011', 'prop_005', '2024-07-01', true, 250.00, 2, false, null, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
('avail_012', 'prop_006', '2024-07-25', true, 380.00, 3, true, 'Maintenance scheduled', '2024-01-01T00:00:00Z', '2024-07-15T09:30:00Z')
ON CONFLICT (availability_id) DO NOTHING;

INSERT INTO saved_searches (search_id, user_id, search_name, destination, check_in_date, check_out_date, guest_count, property_type, price_min, price_max, amenities, instant_booking, distance_beach, distance_airport, host_language, sort_by, is_active, created_at, updated_at) VALUES
('search_001', 'user_003', 'Beach Villas Tulum', 'Tulum, Mexico', '2024-03-15', '2024-03-22', 6, 'villa', 400.00, 800.00, '["Private Pool", "Beach Access", "WiFi"]', false, 1.0, null, 'English', 'price_low_to_high', true, '2024-01-20T14:30:00Z', '2024-01-20T14:30:00Z'),
('search_002', 'user_005', 'Business Travel Europe', null, null, null, 2, 'apartment', 150.00, 300.00, '["WiFi", "Kitchen", "Air Conditioning"]', true, null, 30.0, 'English', 'best_rated', true, '2024-02-10T11:15:00Z', '2024-02-10T11:15:00Z'),
('search_003', 'user_008', 'Luxury Family Villas', null, '2024-06-01', '2024-06-08', 8, 'villa', 600.00, 1200.00, '["Private Pool", "Kitchen", "Parking"]', false, 5.0, null, null, 'best_rated', true, '2024-03-05T16:45:00Z', '2024-03-05T16:45:00Z'),
('search_004', 'user_005', 'Romantic Getaways', null, null, null, 2, null, 200.00, 500.00, '["Ocean View", "Hot Tub", "Private Pool"]', false, 2.0, null, null, 'price_high_to_low', true, '2024-04-18T09:20:00Z', '2024-04-18T09:20:00Z')
ON CONFLICT (search_id) DO NOTHING;

INSERT INTO user_favorites (favorite_id, user_id, property_id, created_at) VALUES
('fav_001', 'user_003', 'prop_001', '2024-01-08T10:30:00Z'),
('fav_002', 'user_003', 'prop_005', '2024-01-15T14:20:00Z'),
('fav_003', 'user_005', 'prop_002', '2024-02-15T09:45:00Z'),
('fav_004', 'user_005', 'prop_004', '2024-03-01T11:15:00Z'),
('fav_005', 'user_008', 'prop_003', '2024-01-14T15:30:00Z'),
('fav_006', 'user_008', 'prop_001', '2024-07-22T13:45:00Z')
ON CONFLICT (favorite_id) DO NOTHING;

INSERT INTO weather_data (weather_id, location_id, date, temperature_min, temperature_max, temperature_avg, humidity, wind_speed, uv_index, weather_condition, rainfall, sunshine_hours, is_forecast, created_at) VALUES
('weather_001', 'loc_001', '2024-01-15', 22.5, 28.3, 25.4, 78.2, 12.5, 8.5, 'Sunny', 0.0, 9.5, false, '2024-01-15T06:00:00Z'),
('weather_002', 'loc_001', '2024-01-16', 23.1, 29.0, 26.1, 75.8, 14.2, 9.1, 'Partly Cloudy', 0.0, 8.2, true, '2024-01-15T18:00:00Z'),
('weather_003', 'loc_002', '2024-01-15', 25.8, 32.1, 28.9, 82.5, 8.7, 10.2, 'Sunny', 0.0, 10.5, false, '2024-01-15T06:00:00Z'),
('weather_004', 'loc_003', '2024-01-15', 18.2, 24.7, 21.5, 65.3, 15.8, 6.8, 'Partly Cloudy', 2.5, 6.8, false, '2024-01-15T06:00:00Z'),
('weather_005', 'loc_004', '2024-01-15', 24.5, 31.2, 27.8, 80.1, 11.3, 9.8, 'Sunny', 0.0, 9.8, false, '2024-01-15T06:00:00Z'),
('weather_006', 'loc_005', '2024-01-15', 16.8, 22.3, 19.6, 68.9, 18.5, 5.2, 'Windy', 0.0, 7.5, false, '2024-01-15T06:00:00Z'),
('weather_007', 'loc_006', '2024-01-15', 27.2, 31.8, 29.5, 79.8, 9.2, 11.5, 'Sunny', 0.0, 11.2, false, '2024-01-15T06:00:00Z')
ON CONFLICT (weather_id) DO NOTHING;

INSERT INTO local_attractions (attraction_id, location_id, name, description, category, latitude, longitude, address, phone_number, website_url, opening_hours, admission_fee, rating, image_urls, is_featured, created_at, updated_at) VALUES
('attr_001', 'loc_001', 'Tulum Archaeological Site', 'Ancient Mayan ruins perched on cliffs overlooking the Caribbean Sea. One of the most photographed archaeological sites in Mexico.', 'Historical Site', 20.2146685, -87.4294048, 'Carretera Federal, Tulum 77780, Mexico', '+52-984-802-5405', 'https://www.inah.gob.mx', '{"monday": "8:00-17:00", "tuesday": "8:00-17:00", "wednesday": "8:00-17:00", "thursday": "8:00-17:00", "friday": "8:00-17:00", "saturday": "8:00-17:00", "sunday": "8:00-17:00"}', 95.00, 4.4, '["https://picsum.photos/seed/attr001-1/600/400", "https://picsum.photos/seed/attr001-2/600/400"]', true, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('attr_002', 'loc_001', 'Cenote Dos Ojos', 'World-famous cenote system perfect for snorkeling and diving. Crystal clear waters and stunning stalactite formations.', 'Natural Wonder', 20.2222222, -87.3888889, 'Cenote Dos Ojos, Tulum 77780, Mexico', '+52-984-877-8535', null, '{"monday": "8:00-17:00", "tuesday": "8:00-17:00", "wednesday": "8:00-17:00", "thursday": "8:00-17:00", "friday": "8:00-17:00", "saturday": "8:00-17:00", "sunday": "8:00-17:00"}', 350.00, 4.6, '["https://picsum.photos/seed/attr002-1/600/400"]', true, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('attr_003', 'loc_002', 'Big Buddha Phuket', 'Massive 45-meter tall marble Buddha statue offering panoramic views of the island. Spiritual and cultural landmark.', 'Religious Site', 7.8234567, 98.3123456, 'Chalong, Mueang Phuket District, Phuket 83130, Thailand', '+66-76-381-226', null, '{"monday": "6:00-19:00", "tuesday": "6:00-19:00", "wednesday": "6:00-19:00", "thursday": "6:00-19:00", "friday": "6:00-19:00", "saturday": "6:00-19:00", "sunday": "6:00-19:00"}', 0.00, 4.3, '["https://picsum.photos/seed/attr003-1/600/400"]', true, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('attr_004', 'loc_003', 'Dalt Vila', 'UNESCO World Heritage fortress and old town of Ibiza. Historic ramparts with stunning sunset views.', 'Historical Site', 38.9056789, 1.4337890, 'Dalt Vila, 07800 Ibiza, Spain', '+34-971-392-929', 'https://www.ibiza.travel', '{"monday": "10:00-20:00", "tuesday": "10:00-20:00", "wednesday": "10:00-20:00", "thursday": "10:00-20:00", "friday": "10:00-20:00", "saturday": "10:00-20:00", "sunday": "10:00-20:00"}', 5.00, 4.5, '["https://picsum.photos/seed/attr004-1/600/400"]', true, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('attr_005', 'loc_004', 'Tanah Lot Temple', 'Iconic Hindu temple perched on a rock formation in the sea. Famous for spectacular sunset views.', 'Religious Site', -8.6211111, 115.0866667, 'Beraban, Kediri, Tabanan Regency, Bali 82121, Indonesia', '+62-361-812345', null, '{"monday": "7:00-19:00", "tuesday": "7:00-19:00", "wednesday": "7:00-19:00", "thursday": "7:00-19:00", "friday": "7:00-19:00", "saturday": "7:00-19:00", "sunday": "7:00-19:00"}', 60000.00, 4.4, '["https://picsum.photos/seed/attr005-1/600/400"]', true, '2023-01-01T00:00:00Z', '2024-01-15T00:00:00Z')
ON CONFLICT (attraction_id) DO NOTHING;

INSERT INTO notifications (notification_id, user_id, notification_type, title, message, data, is_read, read_at, priority, expires_at, created_at) VALUES
('notif_001', 'user_003', 'booking_confirmation', 'Booking Confirmed!', 'Your booking for Luxury Beachfront Villa in Tulum has been confirmed for February 15-22, 2024.', '{"booking_id": "book_001", "property_title": "Luxury Beachfront Villa in Tulum", "check_in": "2024-02-15", "check_out": "2024-02-22"}', true, '2024-01-10T15:00:00Z', 'high', null, '2024-01-10T14:35:00Z'),
('notif_002', 'user_001', 'new_booking', 'New Booking Received', 'You have received a new booking for your Tulum villa from Sarah Johnson.', '{"booking_id": "book_001", "guest_name": "Sarah Johnson", "property_id": "prop_001"}', true, '2024-01-10T15:30:00Z', 'high', null, '2024-01-10T14:35:00Z'),
('notif_003', 'user_005', 'review_reminder', 'Review Your Recent Stay', 'How was your stay at the Barcelona Penthouse? Your review helps other travelers.', '{"booking_id": "book_002", "property_title": "Authentic Barcelona Penthouse"}', false, null, 'normal', '2024-03-22T00:00:00Z', '2024-03-10T12:00:00Z'),
('notif_004', 'user_008', 'special_offer', 'Exclusive Offer: 20% Off', 'Limited time offer on your favorite French Riviera Villa. Book now and save!', '{"property_id": "prop_003", "discount_percentage": 20, "valid_until": "2024-02-29"}', false, null, 'normal', '2024-02-29T23:59:59Z', '2024-01-20T10:00:00Z'),
('notif_005', 'user_003', 'weather_alert', 'Weather Update for Your Trip', 'Sunny skies expected for your upcoming Tulum vacation! Perfect beach weather ahead.', '{"booking_id": "book_001", "location": "Tulum", "weather": "Sunny", "temperature": "26°C"}', true, '2024-02-14T08:30:00Z', 'normal', '2024-02-22T00:00:00Z', '2024-02-14T08:00:00Z')
ON CONFLICT (notification_id) DO NOTHING;

INSERT INTO property_inquiries (inquiry_id, property_id, guest_id, check_in_date, check_out_date, guest_count, message, inquiry_status, host_response, response_date, special_offer_price, expires_at, created_at, updated_at) VALUES
('inq_001', 'prop_003', 'user_008', '2024-04-10', '2024-04-17', 8, 'Hello Pierre! Your French Riviera villa looks absolutely stunning. We''re celebrating our 10th anniversary and would love to stay at your property. Do you have availability for April 10-17? We''d appreciate any special touches you could arrange for our celebration.', 'responded', 'Bonjour Lisa! Congratulations on your anniversary! I''d be delighted to host you. The villa is available for your dates. I can arrange champagne, flowers, and a private chef for one evening at no extra charge. Standard rate is €850/night.', '2024-01-14T17:15:00Z', 799.00, '2024-01-21T17:15:00Z', '2024-01-14T15:20:00Z', '2024-01-14T17:15:00Z'),
('inq_002', 'prop_004', 'user_005', '2024-09-15', '2024-09-22', 4, 'Hi Emma! I''m planning a yoga retreat in Phuket and your villa looks perfect. Do you allow yoga classes on the property? Would need space for about 10 people total including my group of 4.', 'pending', null, null, null, null, '2024-01-15T11:30:00Z', '2024-01-15T11:30:00Z'),
('inq_003', 'prop_006', 'user_003', '2024-08-10', '2024-08-15', 6, 'Hi John! Is your Ibiza party villa available for August 10-15? We''re a group of 6 friends celebrating a birthday. Are parties allowed and what are the noise restrictions?', 'responded', 'Hi Sarah! Yes, the villa is available for those dates. Parties are welcome until 2 AM and we have a great sound system. Perfect for birthday celebrations! The rate would be €380/night plus fees.', '2024-01-15T16:45:00Z', null, null, '2024-01-15T14:30:00Z', '2024-01-15T16:45:00Z')
ON CONFLICT (inquiry_id) DO NOTHING;

INSERT INTO investment_analytics (analytics_id, property_id, owner_id, purchase_price, purchase_date, current_value, annual_rental_income, annual_expenses, occupancy_rate, rental_yield, capital_appreciation, total_return, roi_percentage, year, created_at, updated_at) VALUES
('invest_001', 'prop_001', 'user_001', 850000.00, '2022-03-15', 920000.00, 156000.00, 45000.00, 75.5, 18.4, 8.2, 26.6, 13.1, 2023, '2024-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('invest_002', 'prop_002', 'user_002', 420000.00, '2021-11-08', 465000.00, 52200.00, 18500.00, 68.2, 12.4, 10.7, 23.1, 8.0, 2023, '2024-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('invest_003', 'prop_003', 'user_004', 1850000.00, '2020-06-22', 2100000.00, 285000.00, 95000.00, 72.3, 15.4, 13.5, 28.9, 10.3, 2023, '2024-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('invest_004', 'prop_004', 'user_006', 1200000.00, '2022-09-10', 1320000.00, 189000.00, 65000.00, 78.9, 15.8, 10.0, 25.8, 10.3, 2023, '2024-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('invest_005', 'prop_005', 'user_007', 180000.00, '2023-04-12', 195000.00, 45000.00, 12000.00, 82.1, 25.0, 8.3, 33.3, 18.3, 2023, '2024-01-01T00:00:00Z', '2024-01-15T00:00:00Z')
ON CONFLICT (analytics_id) DO NOTHING;

INSERT INTO market_data (market_id, location_id, property_type, average_price_per_sqm, average_rental_yield, price_growth_12m, price_growth_24m, rental_demand_score, investment_score, market_liquidity, foreign_ownership_allowed, property_tax_rate, rental_tax_rate, legal_requirements, month, created_at) VALUES
('market_001', 'loc_001', 'villa', 4250.00, 16.5, 12.3, 28.7, 8.5, 8.8, 'high', true, 0.5, 10.0, '["Tourist license required", "Environmental impact assessment"]', '2024-01', '2024-01-01T00:00:00Z'),
('market_002', 'loc_002', 'villa', 3800.00, 14.2, 8.9, 22.1, 9.2, 8.5, 'high', false, 0.0, 15.0, '["Work permit for property management", "Local partner required"]', '2024-01', '2024-01-01T00:00:00Z'),
('market_003', 'loc_003', 'villa', 6500.00, 12.8, 15.2, 35.6, 7.8, 8.1, 'very_high', true, 0.25, 24.0, '["Tourist license mandatory", "Noise regulations"]', '2024-01', '2024-01-01T00:00:00Z'),
('market_004', 'loc_004', 'villa', 2850.00, 18.5, 11.7, 26.3, 9.5, 9.1, 'high', false, 0.5, 10.0, '["Foreign investment approval", "Local tax registration"]', '2024-01', '2024-01-01T00:00:00Z'),
('market_005', 'loc_005', 'villa', 8200.00, 11.2, 9.8, 18.9, 7.5, 7.8, 'high', true, 0.35, 22.0, '["Building permits required", "Heritage site restrictions"]', '2024-01', '2024-01-01T00:00:00Z')
ON CONFLICT (market_id) DO NOTHING;

INSERT INTO user_verification (verification_id, user_id, verification_type, document_url, verification_status, verified_at, rejection_reason, expires_at, created_at, updated_at) VALUES
('verify_001', 'user_001', 'government_id', 'https://picsum.photos/seed/doc001/600/400', 'verified', '2023-01-15T10:30:00Z', null, '2028-01-15T10:30:00Z', '2023-01-10T09:15:00Z', '2023-01-15T10:30:00Z'),
('verify_002', 'user_002', 'government_id', 'https://picsum.photos/seed/doc002/600/400', 'verified', '2023-02-20T14:45:00Z', null, '2028-02-20T14:45:00Z', '2023-02-18T11:20:00Z', '2023-02-20T14:45:00Z'),
('verify_003', 'user_003', 'government_id', 'https://picsum.photos/seed/doc003/600/400', 'verified', '2023-03-15T16:20:00Z', null, '2028-03-15T16:20:00Z', '2023-03-12T13:30:00Z', '2023-03-15T16:20:00Z'),
('verify_004', 'user_005', 'government_id', 'https://picsum.photos/seed/doc005/600/400', 'pending', null, null, null, '2024-01-10T12:45:00Z', '2024-01-10T12:45:00Z'),
('verify_005', 'user_008', 'government_id', 'https://picsum.photos/seed/doc008/600/400', 'verified', '2023-08-15T11:15:00Z', null, '2028-08-15T11:15:00Z', '2023-08-12T09:30:00Z', '2023-08-15T11:15:00Z')
ON CONFLICT (verification_id) DO NOTHING;

INSERT INTO currency_rates (rate_id, base_currency, target_currency, exchange_rate, rate_date, created_at) VALUES
('rate_001', 'USD', 'EUR', 0.925000, '2024-01-15', '2024-01-15T12:00:00Z'),
('rate_002', 'USD', 'MXN', 17.250000, '2024-01-15', '2024-01-15T12:00:00Z'),
('rate_003', 'USD', 'THB', 34.500000, '2024-01-15', '2024-01-15T12:00:00Z'),
('rate_004', 'USD', 'IDR', 15650.000000, '2024-01-15', '2024-01-15T12:00:00Z'),
('rate_005', 'USD', 'GBP', 0.785000, '2024-01-15', '2024-01-15T12:00:00Z'),
('rate_006', 'EUR', 'USD', 1.081081, '2024-01-15', '2024-01-15T12:00:00Z'),
('rate_007', 'EUR', 'MXN', 18.648649, '2024-01-15', '2024-01-15T12:00:00Z')
ON CONFLICT (rate_id) DO NOTHING;

INSERT INTO system_alerts (alert_id, alert_type, title, message, severity, affected_locations, is_active, starts_at, ends_at, created_at, updated_at) VALUES
('alert_001', 'weather', 'Tropical Storm Warning', 'Tropical storm approaching the Caribbean coast. Properties in affected areas should prepare for strong winds and heavy rainfall.', 'high', '["loc_001"]', false, '2024-01-10T00:00:00Z', '2024-01-12T23:59:59Z', '2024-01-09T18:00:00Z', '2024-01-13T06:00:00Z'),
('alert_002', 'maintenance', 'Scheduled System Maintenance', 'Platform maintenance scheduled for tonight. Some features may be temporarily unavailable.', 'medium', '[]', false, '2024-01-15T02:00:00Z', '2024-01-15T06:00:00Z', '2024-01-14T10:00:00Z', '2024-01-15T06:30:00Z'),
('alert_003', 'security', 'Security Advisory', 'Enhanced security measures implemented. Please ensure your account uses two-factor authentication.', 'medium', '[]', true, '2024-01-01T00:00:00Z', null, '2024-01-01T00:00:00Z', '2024-01-15T00:00:00Z'),
('alert_004', 'travel', 'Travel Advisory - Thailand', 'Updated entry requirements for Thailand. Please check latest visa and health requirements before traveling.', 'normal', '["loc_002"]', true, '2024-01-10T00:00:00Z', '2024-03-31T23:59:59Z', '2024-01-10T08:00:00Z', '2024-01-10T08:00:00Z')
ON CONFLICT (alert_id) DO NOTHING;

-- Update property counts in locations (only if not already set)
UPDATE locations SET property_count = 2 WHERE location_id = 'loc_001' AND property_count = 0;
UPDATE locations SET property_count = 1 WHERE location_id = 'loc_002' AND property_count = 0;
UPDATE locations SET property_count = 1 WHERE location_id = 'loc_003' AND property_count = 0;
UPDATE locations SET property_count = 1 WHERE location_id = 'loc_004' AND property_count = 0;
UPDATE locations SET property_count = 1 WHERE location_id = 'loc_005' AND property_count = 0;