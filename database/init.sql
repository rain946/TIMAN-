USE timan_db;


-- USERS


CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    address VARCHAR(255) NOT NULL,
    role ENUM('owner', 'clinic') NOT NULL,
    clinic_name VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- PETS


CREATE TABLE IF NOT EXISTS pets (
    pet_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    pet_name VARCHAR(100) NOT NULL,
    species VARCHAR(50) NOT NULL,
    breed VARCHAR(100) NULL,
    sex ENUM('Male', 'Female') NOT NULL,
    birth_date DATE NULL,
    color VARCHAR(100) NULL,
    identifying_marks VARCHAR(255) NULL,
    photo_url VARCHAR(255) NULL,
    qr_code VARCHAR(255) UNIQUE,
    pet_status ENUM('Safe', 'Missing', 'Found') DEFAULT 'Safe',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (owner_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- CLINIC AUTHORIZATIONS


CREATE TABLE IF NOT EXISTS clinic_authorizations (
    authorization_id INT AUTO_INCREMENT PRIMARY KEY,
    pet_id INT NOT NULL,
    clinic_user_id INT NOT NULL,

    status ENUM(
        'Pending',
        'Approved',
        'Declined',
        'Revoked'
    ) NOT NULL DEFAULT 'Pending',

    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,

    FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id)
        ON DELETE CASCADE,

    FOREIGN KEY (clinic_user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    UNIQUE KEY unique_pet_clinic (
        pet_id,
        clinic_user_id
    )
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,

    pet_id INT NULL,
    authorization_id INT NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notifications_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notifications_authorization
        FOREIGN KEY (authorization_id)
        REFERENCES clinic_authorizations(authorization_id)
        ON DELETE CASCADE,

    INDEX idx_notifications_user (
        user_id
    ),

    INDEX idx_notifications_user_read (
        user_id,
        is_read
    ),

    INDEX idx_notifications_created (
        created_at
    )
);


-- VETERINARY RECORDS

CREATE TABLE IF NOT EXISTS vet_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    pet_id INT NOT NULL,
    clinic_user_id INT NOT NULL,
    visit_date DATE NOT NULL,

    service_type ENUM(
        'Checkup',
        'Vaccination',
        'Deworming',
        'Treatment',
        'Surgery',
        'Other'
    ) NOT NULL,

    diagnosis VARCHAR(255) NULL,
    treatment VARCHAR(255) NULL,
    medication VARCHAR(255) NULL,
    notes TEXT NULL,
    next_due_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id)
        ON DELETE CASCADE,

    FOREIGN KEY (clinic_user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- PUSH TOKEN

CREATE TABLE IF NOT EXISTS push_tokens (
    push_token_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    expo_push_token VARCHAR(255) NOT NULL,
    device_platform VARCHAR(20) DEFAULT 'android',
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    UNIQUE KEY unique_push_token (
        expo_push_token
    )
);


-- REMINDER LOGS

CREATE TABLE IF NOT EXISTS reminder_logs (
    reminder_log_id INT AUTO_INCREMENT PRIMARY KEY,
    record_id INT NOT NULL,
    user_id INT NOT NULL,

    reminder_type ENUM(
        'due_tomorrow',
        'due_today',
        'overdue_1d',
        'overdue_3d',
        'overdue_7d'
    ) NOT NULL,

    reminder_date DATE NOT NULL,
    expo_ticket_id VARCHAR(255) NULL,

    status ENUM(
        'sent',
        'failed'
    ) NOT NULL DEFAULT 'sent',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (record_id)
        REFERENCES vet_records(record_id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    UNIQUE KEY unique_record_reminder (
        record_id,
        reminder_type,
        reminder_date
    )
);

-- LOST PET REPORTS

CREATE TABLE IF NOT EXISTS lost_pet_reports (
    lost_report_id INT AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,
    owner_id INT NOT NULL,

    current_condition ENUM('Safe', 'Not Safe') NOT NULL,

    owner_message TEXT NOT NULL,

    last_seen_latitude DECIMAL(10, 8) NULL,
    last_seen_longitude DECIMAL(11, 8) NULL,

    missing_since DATETIME DEFAULT CURRENT_TIMESTAMP,
    recovered_at DATETIME NULL,

    case_status ENUM('Active', 'Recovered')
        NOT NULL DEFAULT 'Active',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id)
        ON DELETE CASCADE,

    FOREIGN KEY (owner_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- QR SCAN HISTORY

CREATE TABLE IF NOT EXISTS qr_scan_history (
    scan_id INT AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,
    lost_report_id INT NOT NULL,

    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,

    location_shared BOOLEAN DEFAULT FALSE,

    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id)
        ON DELETE CASCADE,

    FOREIGN KEY (lost_report_id)
        REFERENCES lost_pet_reports(lost_report_id)
        ON DELETE CASCADE
);
