import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { API_URL } from "../config/api";
import { subscribeToNotificationRefresh } from "../services/notificationRefresh";

const ACTIVE_REFRESH_INTERVAL_MS = 20_000;

export function useUnreadNotificationCount(refreshKey: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const latestRequest = useRef(0);

  const loadUnreadCount = useCallback(async () => {
    const requestId = ++latestRequest.current;

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        if (requestId === latestRequest.current) {
          setUnreadCount(0);
        }
        return;
      }

      const response = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (requestId === latestRequest.current && response.ok && data.success) {
        setUnreadCount(Math.max(0, Number(data.unreadCount) || 0));
      }
    } catch (error) {
      console.log("LOAD UNREAD NOTIFICATION COUNT ERROR:", error);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
  }, [loadUnreadCount, refreshKey]);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationRefresh(() => {
      void loadUnreadCount();
    });
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          void loadUnreadCount();
        }
      },
    );
    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        void loadUnreadCount();
      }
    }, ACTIVE_REFRESH_INTERVAL_MS);

    return () => {
      unsubscribe();
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [loadUnreadCount]);

  return unreadCount;
}
