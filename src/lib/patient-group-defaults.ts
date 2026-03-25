interface PatientGroupChoice {
  id: string;
  is_default: boolean;
}

export const getPreferredPatientGroupId = (
  groups: PatientGroupChoice[],
  lastUsedGroupId: string | null
) => {
  if (lastUsedGroupId && groups.some((group) => group.id === lastUsedGroupId)) {
    return lastUsedGroupId;
  }

  return groups.find((group) => group.is_default)?.id ?? null;
};
