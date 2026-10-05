USE timan_db;

-- Safe forward migration for explicit nearby lost-pet alert preferences.
-- Existing users, pets, reports, scans, veterinary records, and protocols are
-- left unchanged.

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

ALTER TABLE lost_pet_reports
    MODIFY COLUMN current_condition
        ENUM('Safe', 'Not Safe', 'Unknown') NOT NULL;

SET @migration_sql = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'lost_pet_reports'
          AND column_name = 'last_nearby_alert_at'
    ),
    'SELECT 1',
    'ALTER TABLE lost_pet_reports ADD COLUMN last_nearby_alert_at DATETIME NULL AFTER last_seen_longitude'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'lost_pet_reports'
          AND column_name = 'last_alert_latitude'
    ),
    'SELECT 1',
    'ALTER TABLE lost_pet_reports ADD COLUMN last_alert_latitude DECIMAL(10, 8) NULL AFTER last_nearby_alert_at'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'lost_pet_reports'
          AND column_name = 'last_alert_longitude'
    ),
    'SELECT 1',
    'ALTER TABLE lost_pet_reports ADD COLUMN last_alert_longitude DECIMAL(11, 8) NULL AFTER last_alert_latitude'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
