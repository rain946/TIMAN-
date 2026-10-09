import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type AlertButton,
  type AlertOptions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { timanColors, timanRadii, timanShadow } from "@/components/timan/theme";

type DialogRequest = {
  id: number;
  key: string;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

type DialogListener = (request: DialogRequest) => void;
type IoniconName = ComponentProps<typeof Ionicons>["name"];

let nextDialogId = 1;
let listener: DialogListener | null = null;
let deliveredRequest: DialogRequest | null = null;
const requestQueue: DialogRequest[] = [];
const pendingKeys = new Set<string>();

function deliverNextDialog() {
  if (!listener || deliveredRequest || requestQueue.length === 0) {
    return;
  }

  deliveredRequest = requestQueue.shift() ?? null;
  if (deliveredRequest) {
    listener(deliveredRequest);
  }
}

function subscribeToDialogs(nextListener: DialogListener) {
  listener = nextListener;
  deliverNextDialog();

  return () => {
    if (listener === nextListener) {
      listener = null;
    }
  };
}

function finishDialog(request: DialogRequest) {
  pendingKeys.delete(request.key);

  if (deliveredRequest?.id === request.id) {
    deliveredRequest = null;
  }

  deliverNextDialog();
}

/**
 * Drop-in replacement for React Native's app-owned Alert API.
 * Keeping the same call shape lets screens retain their existing callbacks.
 */
export const AppAlert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    const normalizedButtons = buttons?.length
      ? buttons
      : [{ text: "OK" } satisfies AlertButton];
    const key = `${title}\u0000${message ?? ""}`;

    // Ignore rapid duplicate requests while the same dialog is active or queued.
    if (pendingKeys.has(key)) {
      return;
    }

    const request: DialogRequest = {
      id: nextDialogId++,
      key,
      title,
      message,
      buttons: normalizedButtons,
      options,
    };

    pendingKeys.add(key);
    requestQueue.push(request);
    deliverNextDialog();
  },
};

function isPhotoSourceDialog(request: DialogRequest) {
  const labels = request.buttons.map((button) => button.text?.toLowerCase() ?? "");

  return (
    labels.some((label) => label.includes("take photo")) &&
    labels.some((label) => label.includes("gallery"))
  );
}

function getDialogAppearance(request: DialogRequest): {
  icon: IoniconName;
  color: string;
  background: string;
} {
  const searchableText = `${request.title} ${request.message ?? ""}`.toLowerCase();
  const hasDestructiveAction = request.buttons.some(
    (button) => button.style === "destructive"
  );

  if (hasDestructiveAction || /delete|remove|archive/.test(searchableText)) {
    return { icon: "trash-outline", color: "#C94B4B", background: "#FCE8E6" };
  }

  if (/success|saved|created|updated|restored|approved|safe/.test(searchableText)) {
    return { icon: "checkmark-circle-outline", color: timanColors.primary, background: timanColors.lightMint };
  }

  if (/error|failed|invalid|unable|expired|missing|required|denied/.test(searchableText)) {
    return { icon: "alert-circle-outline", color: "#C94B4B", background: "#FCE8E6" };
  }

  if (/log out|logout/.test(searchableText)) {
    return { icon: "log-out-outline", color: timanColors.primary, background: timanColors.lightMint };
  }

  if (/warning|are you sure|confirm|cancel/.test(searchableText)) {
    return { icon: "warning-outline", color: "#B46A10", background: "#FCE8C5" };
  }

  return { icon: "information-circle-outline", color: timanColors.primary, background: timanColors.lightMint };
}

function getPhotoActionIcon(label?: string): IoniconName {
  const normalizedLabel = label?.toLowerCase() ?? "";

  if (normalizedLabel.includes("take photo")) {
    return "camera-outline";
  }

  return "images-outline";
}

function isDestructiveAction(button: AlertButton) {
  return (
    button.style === "destructive" ||
    /delete|remove|archive|revoke|decline|log out|logout/i.test(button.text ?? "")
  );
}

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const actionLockedRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();

  useEffect(() => subscribeToDialogs(setRequest), []);

  const closeDialog = useCallback(
    (callback?: () => void) => {
      if (!request || actionLockedRef.current) {
        return;
      }

      const closingRequest = request;
      actionLockedRef.current = true;
      setIsClosing(true);
      setRequest(null);

      // Let the modal disappear before camera/gallery or navigation is launched.
      setTimeout(() => {
        try {
          callback?.();
        } finally {
          finishDialog(closingRequest);
          actionLockedRef.current = false;
          setIsClosing(false);
        }
      }, 220);
    },
    [request]
  );

  const dismissDialog = useCallback(() => {
    if (!request || request.options?.cancelable === false) {
      return;
    }

    // Backdrop/back dismissal never invokes an action button.
    closeDialog(request.options?.onDismiss);
  }, [closeDialog, request]);

  const appearance = useMemo(
    () => (request ? getDialogAppearance(request) : null),
    [request]
  );
  const photoSourceDialog = request ? isPhotoSourceDialog(request) : false;
  const actionButtons = request?.buttons.filter(
    (button) => button.style !== "cancel"
  ) ?? [];
  const cancelButton = request?.buttons.find((button) => button.style === "cancel");
  const stackButtons = (request?.buttons.length ?? 0) > 2 || fontScale > 1.15;
  const contentMaxHeight = Math.max(220, height * 0.72);

  return (
    <>
      {children}

      <Modal
        animationType={photoSourceDialog ? "slide" : "fade"}
        onRequestClose={dismissDialog}
        statusBarTranslucent
        transparent
        visible={request !== null}
      >
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={dismissDialog}
          style={[
            styles.modalRoot,
            photoSourceDialog ? styles.sheetRoot : styles.dialogRoot,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Dismiss dialog"
            accessibilityRole="button"
            disabled={request?.options?.cancelable === false || isClosing}
            onPress={dismissDialog}
            style={styles.backdrop}
          />

          {request && photoSourceDialog ? (
            <View style={styles.sheetGroup}>
              <View style={styles.sheet}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeading}>
                  <View style={styles.photoIconBadge}>
                    <Ionicons color={timanColors.primary} name="paw-outline" size={25} />
                  </View>
                  <View style={styles.headingCopy}>
                    <Text maxFontSizeMultiplier={1.5} style={styles.title}>
                      {request.title}
                    </Text>
                    {request.message ? (
                      <Text maxFontSizeMultiplier={1.6} style={styles.message}>
                        {request.message}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.photoActions}>
                  {actionButtons.map((button, index) => (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isClosing}
                      key={`${button.text ?? "action"}-${index}`}
                      onPress={() => closeDialog(button.onPress)}
                      style={({ pressed }) => [
                        styles.photoAction,
                        pressed && styles.photoActionPressed,
                        isClosing && styles.actionDisabled,
                      ]}
                    >
                      <View style={styles.photoActionIcon}>
                        <Ionicons
                          color={timanColors.primary}
                          name={getPhotoActionIcon(button.text)}
                          size={24}
                        />
                      </View>
                      <Text maxFontSizeMultiplier={1.5} style={styles.photoActionText}>
                        {button.text}
                      </Text>
                      <Ionicons color={timanColors.muted} name="chevron-forward" size={20} />
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={isClosing}
                onPress={() => closeDialog(cancelButton?.onPress)}
                style={({ pressed }) => [
                  styles.cancelAction,
                  pressed && styles.cancelActionPressed,
                  isClosing && styles.actionDisabled,
                ]}
              >
                <Text maxFontSizeMultiplier={1.5} style={styles.cancelActionText}>
                  {cancelButton?.text ?? "Cancel"}
                </Text>
              </Pressable>
            </View>
          ) : request && appearance ? (
            <View style={[styles.dialog, { maxHeight: contentMaxHeight }]}>
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.dialogContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.iconBadge, { backgroundColor: appearance.background }]}>
                  <Ionicons color={appearance.color} name={appearance.icon} size={28} />
                </View>
                <Text maxFontSizeMultiplier={1.5} style={styles.title}>
                  {request.title}
                </Text>
                {request.message ? (
                  <Text maxFontSizeMultiplier={1.7} style={styles.dialogMessage}>
                    {request.message}
                  </Text>
                ) : null}
              </ScrollView>

              <View style={[styles.actions, stackButtons && styles.actionsStacked]}>
                {request.buttons.map((button, index) => {
                  const destructive = isDestructiveAction(button);
                  const cancel = button.style === "cancel";

                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isClosing}
                      key={`${button.text ?? "action"}-${index}`}
                      onPress={() => closeDialog(button.onPress)}
                      style={({ pressed }) => [
                        styles.dialogAction,
                        stackButtons && styles.dialogActionStacked,
                        cancel && styles.secondaryAction,
                        destructive && styles.destructiveAction,
                        pressed && !cancel && styles.primaryActionPressed,
                        pressed && cancel && styles.secondaryActionPressed,
                        isClosing && styles.actionDisabled,
                      ]}
                    >
                      <Text
                        maxFontSizeMultiplier={1.5}
                        style={[
                          styles.dialogActionText,
                          cancel && styles.secondaryActionText,
                        ]}
                      >
                        {button.text ?? "OK"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    paddingHorizontal: 18,
  },
  dialogRoot: {
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRoot: {
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24, 39, 33, 0.48)",
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    backgroundColor: timanColors.cream,
    padding: 22,
    ...timanShadow,
    elevation: 10,
  },
  dialogContent: {
    alignItems: "center",
  },
  iconBadge: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    marginBottom: 14,
  },
  title: {
    color: timanColors.dark,
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 27,
  },
  dialogMessage: {
    color: timanColors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  message: {
    color: timanColors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  actionsStacked: {
    flexDirection: "column-reverse",
  },
  dialogAction: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: timanRadii.control,
    backgroundColor: timanColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dialogActionStacked: {
    flex: 0,
    width: "100%",
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: timanColors.lightMint,
    backgroundColor: timanColors.white,
  },
  destructiveAction: {
    backgroundColor: "#C94B4B",
  },
  primaryActionPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  secondaryActionPressed: {
    backgroundColor: timanColors.lightMint,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  dialogActionText: {
    color: timanColors.white,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryActionText: {
    color: timanColors.primary,
  },
  sheetGroup: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: 10,
  },
  sheet: {
    borderRadius: 28,
    backgroundColor: timanColors.cream,
    paddingBottom: 12,
    paddingHorizontal: 18,
    ...timanShadow,
    elevation: 12,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "#B9CFC5",
    marginBottom: 18,
    marginTop: 10,
  },
  sheetHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 18,
  },
  photoIconBadge: {
    width: 50,
    height: 50,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    backgroundColor: timanColors.lightMint,
  },
  headingCopy: {
    flex: 1,
  },
  photoActions: {
    gap: 10,
  },
  photoAction: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#D8E8E0",
    borderRadius: timanRadii.card,
    backgroundColor: timanColors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  photoActionPressed: {
    borderColor: timanColors.secondary,
    backgroundColor: "#EAF5F0",
    transform: [{ scale: 0.99 }],
  },
  photoActionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: timanColors.lightMint,
  },
  photoActionText: {
    flex: 1,
    color: timanColors.dark,
    fontSize: 16,
    fontWeight: "700",
  },
  cancelAction: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: timanRadii.card,
    backgroundColor: timanColors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...timanShadow,
    elevation: 8,
  },
  cancelActionPressed: {
    backgroundColor: timanColors.lightMint,
  },
  cancelActionText: {
    color: timanColors.primary,
    fontSize: 16,
    fontWeight: "800",
  },
});
