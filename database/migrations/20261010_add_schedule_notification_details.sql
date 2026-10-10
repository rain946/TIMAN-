ALTER TABLE vet_records
    ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER cancelled_at;

ALTER TABLE notifications
    ADD COLUMN record_id INT NULL AFTER authorization_id,
    ADD CONSTRAINT fk_notifications_record
        FOREIGN KEY (record_id) REFERENCES vet_records(record_id)
        ON DELETE SET NULL,
    ADD INDEX idx_notifications_record (record_id);

UPDATE notifications n
SET n.record_id = (
    SELECT vr.record_id
    FROM vet_records vr
    WHERE vr.pet_id = n.pet_id
      AND (
        (n.type = 'schedule_cancelled' AND vr.cancelled_at IS NOT NULL)
        OR
        (n.type = 'schedule_rescheduled' AND vr.rescheduled_at IS NOT NULL)
      )
    ORDER BY ABS(TIMESTAMPDIFF(
      SECOND,
      COALESCE(vr.cancelled_at, vr.rescheduled_at),
      n.created_at
    )) ASC
    LIMIT 1
)
WHERE n.record_id IS NULL
  AND n.type IN ('schedule_cancelled', 'schedule_rescheduled');

UPDATE vet_records vr
INNER JOIN notifications n ON n.record_id = vr.record_id
SET vr.cancellation_reason = TRIM(
  SUBSTRING(n.message, LOCATE('Reason:', n.message) + 7)
)
WHERE n.type = 'schedule_cancelled'
  AND n.message LIKE '%Reason:%'
  AND vr.cancellation_reason IS NULL;
