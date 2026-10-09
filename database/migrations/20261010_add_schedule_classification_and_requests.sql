-- Existing vet-record schedules are clinical due-date reminders. The default
-- deliberately preserves that meaning; only explicitly created appointments
-- may use schedule_kind='appointment'.
ALTER TABLE vet_records
    ADD COLUMN schedule_kind ENUM('reminder', 'appointment') NOT NULL DEFAULT 'reminder' AFTER follow_up_plan,
    ADD COLUMN appointment_at DATETIME NULL AFTER schedule_kind,
    ADD COLUMN reminder_snoozed_until DATETIME NULL AFTER appointment_at,
    ADD INDEX idx_vet_schedule_kind_status (schedule_kind, schedule_status),
    ADD INDEX idx_vet_reminder_snooze (reminder_snoozed_until);

CREATE TABLE IF NOT EXISTS appointment_change_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    record_id INT NOT NULL,
    owner_id INT NOT NULL,
    clinic_user_id INT NOT NULL,
    request_type ENUM('reschedule', 'cancel') NOT NULL,
    reason VARCHAR(500) NOT NULL,
    original_schedule DATETIME NOT NULL,
    proposed_schedule DATETIME NULL,
    status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (record_id) REFERENCES vet_records(record_id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_appointment_request_owner (owner_id, status, created_at),
    INDEX idx_appointment_request_clinic (clinic_user_id, status, created_at),
    INDEX idx_appointment_request_record (record_id, status)
);

ALTER TABLE pet_care_schedules
    ADD COLUMN scheduled_time TIME NULL AFTER scheduled_date,
    ADD COLUMN series_id CHAR(36) NULL AFTER repeat_type,
    ADD COLUMN recurrence_anchor_date DATE NULL AFTER series_id,
    ADD COLUMN series_status ENUM('Active', 'Cancelled') NOT NULL DEFAULT 'Active' AFTER recurrence_anchor_date,
    ADD INDEX idx_pet_care_series (series_id, series_status);

UPDATE pet_care_schedules
SET series_id = UUID(), recurrence_anchor_date = scheduled_date
WHERE series_id IS NULL;
