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
    profile_photo_url VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EXPLICIT, OPT-IN LOCATIONS USED ONLY FOR NEARBY LOST-PET ALERTS

CREATE TABLE IF NOT EXISTS nearby_alert_preferences (
    user_id INT PRIMARY KEY,
    nearby_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    alert_latitude DECIMAL(10, 8) NULL,
    alert_longitude DECIMAL(11, 8) NULL,
    location_updated_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_nearby_alert_preferences_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_nearby_alert_preference_coordinates
        CHECK (
            (alert_latitude IS NULL AND alert_longitude IS NULL)
            OR
            (
                alert_latitude IS NOT NULL
                AND alert_longitude IS NOT NULL
                AND
                alert_latitude BETWEEN -90 AND 90
                AND alert_longitude BETWEEN -180 AND 180
            )
        ),

    INDEX idx_nearby_alert_eligibility (
        nearby_alerts_enabled,
        location_updated_at
    )
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
    archived_at DATETIME NULL,
    archive_reason ENUM('Deceased', 'Missing / Not Found', 'Other') NULL,
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

    service_type VARCHAR(100) NOT NULL,

    diagnosis VARCHAR(255) NULL,
    treatment VARCHAR(255) NULL,
    medication VARCHAR(255) NULL,
    notes TEXT NULL,
    next_due_date DATE NULL,
    next_service_type VARCHAR(100) NULL,
    follow_up_plan TEXT NULL,
    schedule_status ENUM(
        'Pending',
        'Completed',
        'Cancelled'
    ) NOT NULL DEFAULT 'Pending',
    completed_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    rescheduled_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id)
        ON DELETE CASCADE,

    FOREIGN KEY (clinic_user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- CONFIGURABLE VACCINATION PROTOCOLS
-- Seed rows below are TIMAN demonstration configuration only. They are not
-- universal veterinary medical advice and may be changed or disabled by an
-- authorized database administrator.

CREATE TABLE IF NOT EXISTS vaccination_protocols (
    protocol_id INT AUTO_INCREMENT PRIMARY KEY,
    species VARCHAR(50) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    dose_sequence SMALLINT UNSIGNED NULL,
    rule_sequence_key SMALLINT UNSIGNED
        GENERATED ALWAYS AS (COALESCE(dose_sequence, 0)) STORED,
    minimum_age_value SMALLINT UNSIGNED NULL,
    recommended_age_value SMALLINT UNSIGNED NULL,
    age_unit ENUM('day', 'week', 'month', 'year') NULL,
    interval_value SMALLINT UNSIGNED NULL,
    interval_unit ENUM('day', 'week', 'month', 'year') NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_vaccination_protocol_dose
        CHECK (dose_sequence IS NULL OR dose_sequence > 0),
    CONSTRAINT chk_vaccination_protocol_minimum_age
        CHECK (minimum_age_value IS NULL OR minimum_age_value > 0),
    CONSTRAINT chk_vaccination_protocol_recommended_age
        CHECK (recommended_age_value IS NULL OR recommended_age_value > 0),
    CONSTRAINT chk_vaccination_protocol_age_unit
        CHECK (
            (minimum_age_value IS NULL AND recommended_age_value IS NULL AND age_unit IS NULL)
            OR
            ((minimum_age_value IS NOT NULL OR recommended_age_value IS NOT NULL) AND age_unit IS NOT NULL)
        ),
    CONSTRAINT chk_vaccination_protocol_interval
        CHECK (
            (interval_value IS NULL AND interval_unit IS NULL)
            OR
            (interval_value > 0 AND interval_unit IS NOT NULL)
        ),

    INDEX idx_vaccination_protocol_lookup (
        species,
        service_type,
        is_active
    ),
    UNIQUE KEY unique_vaccination_protocol_rule (
        species,
        service_type,
        rule_sequence_key
    )
);

INSERT IGNORE INTO vaccination_protocols (
    species,
    service_type,
    dose_sequence,
    minimum_age_value,
    recommended_age_value,
    age_unit,
    interval_value,
    interval_unit,
    is_active
)
VALUES
    ('Dog', 'Vaccination - Rabies', 1, 12, 12, 'week', 1, 'year', TRUE),
    ('Dog', 'Vaccination - Rabies', NULL, NULL, NULL, NULL, 1, 'year', TRUE),
    ('Dog', 'Vaccination - DHPP', 1, 6, 8, 'week', 3, 'week', TRUE),
    ('Dog', 'Vaccination - DHPP', 2, 9, 11, 'week', 3, 'week', TRUE),
    ('Dog', 'Vaccination - DHPP', 3, 12, 14, 'week', 1, 'year', TRUE),
    ('Dog', 'Vaccination - DHPP', NULL, NULL, NULL, NULL, 1, 'year', TRUE),
    ('Cat', 'Vaccination - Rabies', 1, 12, 12, 'week', 1, 'year', TRUE),
    ('Cat', 'Vaccination - Rabies', NULL, NULL, NULL, NULL, 1, 'year', TRUE),
    ('Cat', 'Vaccination - FVRCP', 1, 6, 8, 'week', 3, 'week', TRUE),
    ('Cat', 'Vaccination - FVRCP', 2, 9, 11, 'week', 3, 'week', TRUE),
    ('Cat', 'Vaccination - FVRCP', 3, 12, 14, 'week', 1, 'year', TRUE),
    ('Cat', 'Vaccination - FVRCP', NULL, NULL, NULL, NULL, 1, 'year', TRUE);

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

    current_condition ENUM('Safe', 'Not Safe', 'Unknown') NOT NULL,

    owner_message TEXT NOT NULL,

    last_seen_latitude DECIMAL(10, 8) NULL,
    last_seen_longitude DECIMAL(11, 8) NULL,
    last_nearby_alert_at DATETIME NULL,
    last_alert_latitude DECIMAL(10, 8) NULL,
    last_alert_longitude DECIMAL(11, 8) NULL,

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

-- OWNER PERSONAL PET CARE SCHEDULES

CREATE TABLE IF NOT EXISTS pet_care_schedules (
    care_schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    pet_id INT NOT NULL,
    care_type VARCHAR(100) NOT NULL,
    scheduled_date DATE NOT NULL,
    repeat_type ENUM('None', 'Weekly', 'Monthly') NOT NULL DEFAULT 'None',
    notes VARCHAR(500) NULL,
    status ENUM('Pending', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
    previous_schedule_id INT NULL,
    completed_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(pet_id) ON DELETE CASCADE,
    FOREIGN KEY (previous_schedule_id)
        REFERENCES pet_care_schedules(care_schedule_id)
        ON DELETE SET NULL,

    UNIQUE KEY unique_next_care_occurrence (previous_schedule_id),
    INDEX idx_pet_care_owner_status_date (owner_id, status, scheduled_date),
    INDEX idx_pet_care_pet (pet_id)
);

CREATE TABLE IF NOT EXISTS pet_care_reminder_logs (
    care_reminder_log_id INT AUTO_INCREMENT PRIMARY KEY,
    care_schedule_id INT NOT NULL,
    owner_id INT NOT NULL,
    reminder_type ENUM('due_tomorrow', 'due_today', 'overdue_1d', 'overdue_3d', 'overdue_7d') NOT NULL,
    reminder_date DATE NOT NULL,
    expo_ticket_id VARCHAR(255) NULL,
    status ENUM('sent', 'failed') NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (care_schedule_id)
        REFERENCES pet_care_schedules(care_schedule_id)
        ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE,

    UNIQUE KEY unique_care_reminder (
        care_schedule_id,
        reminder_type,
        reminder_date
    )
);
