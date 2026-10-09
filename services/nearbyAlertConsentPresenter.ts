import { AppAlert as Alert } from "@/components/dialogs/AppDialog";

type ConsentPresenter = () => Promise<boolean>;

let consentPresenter: ConsentPresenter | null = null;

export function setNearbyAlertConsentPresenter(
  presenter: ConsentPresenter | null,
) {
  consentPresenter = presenter;
}

export function requestNearbyAlertConsent(): Promise<boolean> {
  if (consentPresenter) {
    return consentPresenter();
  }

  return new Promise((resolve) => {
    Alert.alert(
      "Missing Pet Alerts",
      "TIMAN can use your current location to notify you when a missing pet is reported nearby. Your location is only captured when you allow it and is not tracked in the background.",
      [
        { text: "Not Now", style: "cancel", onPress: () => resolve(false) },
        { text: "Allow", onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}
