USE timan_db;

-- Safe forward-only migration. This creates only the advisory protocol table
-- and demonstration configuration; it does not update vet_records or pets.
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

    INDEX idx_vaccination_protocol_lookup (species, service_type, is_active),
    UNIQUE KEY unique_vaccination_protocol_rule (species, service_type, rule_sequence_key)
);

-- These are configurable TIMAN demonstration records, not universal medical advice.
INSERT IGNORE INTO vaccination_protocols (
    species, service_type, dose_sequence,
    minimum_age_value, recommended_age_value, age_unit,
    interval_value, interval_unit, is_active
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
