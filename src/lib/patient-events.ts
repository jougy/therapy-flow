export const PATIENTS_UPDATED_EVENT = "pluri-health:patients-updated";

export const notifyPatientsUpdated = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(PATIENTS_UPDATED_EVENT));
};
