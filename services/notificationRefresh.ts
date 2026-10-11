type NotificationRefreshListener = () => void;

const listeners = new Set<NotificationRefreshListener>();

export function notifyNotificationDataChanged() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToNotificationRefresh(
  listener: NotificationRefreshListener,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
