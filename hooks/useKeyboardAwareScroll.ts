import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  TextInput,
} from "react-native";

const VISIBILITY_MARGIN = 32;
const LAYOUT_SETTLE_DELAY_MS = 80;

export function useKeyboardAwareScroll(
  normalBottomPadding: number
) {
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<TextInput>(null);
  const scrollOffsetRef = useRef(0);
  const normalScrollOffsetRef = useRef(0);
  const keyboardTopRef = useRef(Number.POSITIVE_INFINITY);
  const keyboardVisibleRef = useRef(false);
  const [extraScrollSpace, setExtraScrollSpace] =
    useState(0);
  const settleTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const revealFocusedInput = useCallback(() => {
    const input = focusedInputRef.current;
    const scrollView = scrollViewRef.current;
    const nativeScrollView =
      scrollView?.getNativeScrollRef();

    if (!input || !scrollView || !nativeScrollView) {
      return;
    }

    input.measureInWindow(
      (_inputX, inputY, _inputWidth, inputHeight) => {
        nativeScrollView.measureInWindow(
          (
            _scrollX,
            scrollY,
            _scrollWidth,
            scrollHeight
          ) => {
            const inputBottom = inputY + inputHeight;
            const viewportBottom = scrollY + scrollHeight;
            const effectiveBottom = Math.min(
              viewportBottom,
              keyboardTopRef.current
            );
            const overlap =
              inputBottom +
              VISIBILITY_MARGIN -
              effectiveBottom;

            if (overlap > 0) {
              const scrollDistance =
                overlap + VISIBILITY_MARGIN / 2;

              setExtraScrollSpace((current) =>
                Math.max(current, scrollDistance)
              );

              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  scrollView.scrollTo({
                    y:
                      scrollOffsetRef.current +
                      scrollDistance,
                    animated: true,
                  });
                });
              });
            }
          }
        );
      }
    );
  }, []);

  const scheduleReveal = useCallback(() => {
    clearSettleTimer();
    settleTimerRef.current = setTimeout(
      revealFocusedInput,
      LAYOUT_SETTLE_DELAY_MS
    );
  }, [clearSettleTimer, revealFocusedInput]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      (event: KeyboardEvent) => {
        keyboardVisibleRef.current = true;
        keyboardTopRef.current =
          event.endCoordinates.screenY;
        scheduleReveal();
      }
    );

    const hideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        clearSettleTimer();
        keyboardVisibleRef.current = false;
        keyboardTopRef.current =
          Number.POSITIVE_INFINITY;
        focusedInputRef.current = null;
        setExtraScrollSpace(0);

        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollTo({
            y: normalScrollOffsetRef.current,
            animated: false,
          });
        });
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      clearSettleTimer();
    };
  }, [clearSettleTimer, scheduleReveal]);

  const handleInputFocus = useCallback(
    (input: TextInput | null) => {
      focusedInputRef.current = input;

      if (!keyboardVisibleRef.current) {
        normalScrollOffsetRef.current =
          scrollOffsetRef.current;
      } else {
        scheduleReveal();
      }
    },
    [scheduleReveal]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current =
        event.nativeEvent.contentOffset.y;
    },
    []
  );

  return {
    scrollViewRef,
    handleInputFocus,
    handleScroll,
    keyboardContentContainerStyle: {
      paddingBottom:
        normalBottomPadding + extraScrollSpace,
    },
  };
}
