const cron = require("node-cron");

const db = require("../config/db");

const {
  sendExpoPushNotification,
} = require("./pushService");





function getReminderDetails(daysDifference) {
  switch (daysDifference) {
    case -1:
      return {
        type: "due_tomorrow",
        notificationType:
          "health_reminder",
        title:
          "Upcoming Pet Health Schedule",
        message:
          "has a veterinary schedule due tomorrow.",
      };

    case 0:
      return {
        type: "due_today",
        notificationType:
          "health_reminder",
        title:
          "Pet Health Schedule Due Today",
        message:
          "has a veterinary schedule due today.",
      };

    case 1:
      return {
        type: "overdue_1d",
        notificationType:
          "health_reminder",
        title:
          "Pet Health Schedule Overdue",
        message:
          "has a veterinary schedule that is 1 day overdue.",
      };

    case 3:
      return {
        type: "overdue_3d",
        notificationType:
          "health_reminder",
        title:
          "Pet Health Reminder",
        message:
          "has a veterinary schedule that is 3 days overdue.",
      };

    case 7:
      return {
        type: "overdue_7d",
        notificationType:
          "health_reminder",
        title:
          "Important Pet Health Reminder",
        message:
          "has a veterinary schedule that is 7 days overdue.",
      };

    default:
      return null;
  }
}





async function reminderAlreadySent(
  recordId,
  userId,
  reminderType
) {
  const [rows] = await db.query(
    `
    SELECT reminder_log_id
    FROM reminder_logs
    WHERE record_id = ?
      AND user_id = ?
      AND reminder_type = ?
      AND status = 'sent'
    LIMIT 1
    `,
    [
      recordId,
      userId,
      reminderType,
    ]
  );

  return rows.length > 0;
}





async function saveReminderLog({
  recordId,
  userId,
  reminderType,
  expoTicketId,
  status,
}) {
  await db.query(
    `
    INSERT INTO reminder_logs (
      record_id,
      user_id,
      reminder_type,
      reminder_date,
      expo_ticket_id,
      status
    )
    VALUES (
      ?,
      ?,
      ?,
      DATE(
        CONVERT_TZ(
          UTC_TIMESTAMP(),
          '+00:00',
          '+08:00'
        )
      ),
      ?,
      ?
    )

    ON DUPLICATE KEY UPDATE
      expo_ticket_id =
        VALUES(expo_ticket_id),

      status =
        VALUES(status)
    `,
    [
      recordId,
      userId,
      reminderType,
      expoTicketId || null,
      status,
    ]
  );
}





async function saveInboxNotification({
  userId,
  petId,
  type,
  title,
  message,
}) {
  await db.query(
    `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      pet_id,
      authorization_id,
      is_read
    )
    VALUES (?, ?, ?, ?, ?, NULL, FALSE)
    `,
    [
      userId,
      type,
      title,
      message,
      petId,
    ]
  );
}





async function getSchedulesForReminder() {
  const [rows] = await db.query(
    `
    SELECT
      vr.record_id,
      vr.pet_id,
      vr.service_type,
      vr.next_due_date,

      p.pet_name,
      p.owner_id,

      u.full_name AS owner_name,

      DATEDIFF(
        DATE(
          CONVERT_TZ(
            UTC_TIMESTAMP(),
            '+00:00',
            '+08:00'
          )
        ),
        vr.next_due_date
      ) AS days_difference

    FROM vet_records vr

    INNER JOIN pets p
      ON p.pet_id = vr.pet_id

    INNER JOIN users u
      ON u.user_id = p.owner_id

    WHERE
      vr.next_due_date IS NOT NULL

      AND DATEDIFF(
        DATE(
          CONVERT_TZ(
            UTC_TIMESTAMP(),
            '+00:00',
            '+08:00'
          )
        ),
        vr.next_due_date
      ) IN (-1, 0, 1, 3, 7)

    ORDER BY
      vr.next_due_date ASC
    `
  );

  return rows;
}





async function getOwnerPushTokens(userId) {
  const [rows] = await db.query(
    `
    SELECT
      push_token_id,
      expo_push_token

    FROM push_tokens

    WHERE user_id = ?
      AND is_active = TRUE
    `,
    [userId]
  );

  return rows;
}





async function processHealthReminders() {
  console.log(
    "======================================"
  );

  console.log(
    "TIMAN: Checking health reminders..."
  );

  console.log(
    "Scheduler time:",
    new Date().toISOString()
  );

  try {
    const schedules =
      await getSchedulesForReminder();

    console.log(
      `TIMAN: ${schedules.length} schedule(s) require reminder checking.`
    );

    for (const schedule of schedules) {
      try {
        const reminder =
          getReminderDetails(
            Number(
              schedule.days_difference
            )
          );

        if (!reminder) {
          continue;
        }

        console.log(
          `TIMAN: Checking ${schedule.pet_name} - ${schedule.service_type} - ${reminder.type}`
        );


        const alreadySent =
          await reminderAlreadySent(
            schedule.record_id,
            schedule.owner_id,
            reminder.type
          );

        if (alreadySent) {
          console.log(
            `TIMAN: ${reminder.type} already sent for record ${schedule.record_id}.`
          );

          continue;
        }


        const body =
          `${schedule.pet_name} ${reminder.message} ` +
          `Service: ${schedule.service_type}.`;


        const tokens =
          await getOwnerPushTokens(
            schedule.owner_id
          );

        if (tokens.length === 0) {
          console.log(
            `TIMAN: No active push token for owner ${schedule.owner_id}.`
          );

          continue;
        }


        let notificationSent = false;
        let lastTicketId = null;

        for (const token of tokens) {
          const result =
            await sendExpoPushNotification({
              to:
                token.expo_push_token,

              title:
                reminder.title,

              body,

              data: {
                type:
                  "health-reminder",

                reminderType:
                  reminder.type,

                recordId:
                  schedule.record_id,

                petId:
                  schedule.pet_id,

                serviceType:
                  schedule.service_type,

                nextDueDate:
                  schedule.next_due_date,
              },
            });

          if (result.success) {
            notificationSent = true;

            lastTicketId =
              result.ticket?.id ||
              null;

            console.log(
              `TIMAN: Push accepted for ${schedule.pet_name}.`
            );
          } else {
            console.log(
              `TIMAN: Push failed for ${schedule.pet_name}:`,
              result.message ||
                result.error
            );
          }
        }


        if (notificationSent) {

          await saveInboxNotification({
            userId:
              schedule.owner_id,

            petId:
              schedule.pet_id,

            type:
              reminder.notificationType,

            title:
              reminder.title,

            message:
              body,
          });

          console.log(
            `TIMAN: Inbox notification saved for ${schedule.pet_name}.`
          );


          await saveReminderLog({
            recordId:
              schedule.record_id,

            userId:
              schedule.owner_id,

            reminderType:
              reminder.type,

            expoTicketId:
              lastTicketId,

            status:
              "sent",
          });

          console.log(
            `TIMAN: ${reminder.type} logged for ${schedule.pet_name}.`
          );
        }
      } catch (scheduleError) {
        console.error(
          `TIMAN REMINDER RECORD ERROR (${schedule.record_id}):`,
          scheduleError
        );
      }
    }

    console.log(
      "TIMAN: Health reminder check completed."
    );
  } catch (error) {
    console.error(
      "TIMAN REMINDER SCHEDULER ERROR:",
      error
    );
  }

  console.log(
    "======================================"
  );
}


function startReminderScheduler() {
  console.log(
    "TIMAN reminder scheduler started."
  );

  cron.schedule(
    "0 8 * * *",
    async () => {
      await processHealthReminders();
    },
    {
      timezone:
        "Asia/Manila",
    }
  );

  setTimeout(() => {
    processHealthReminders();
  }, 5000);
}

module.exports = {
  startReminderScheduler,
  processHealthReminders,
};
