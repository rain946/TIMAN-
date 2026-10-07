ALTER TABLE vet_records
    ADD COLUMN next_service_type VARCHAR(100) NULL AFTER next_due_date,
    ADD COLUMN follow_up_plan TEXT NULL AFTER next_service_type;
