const asStringArray = (value) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export const normalizeProfile = (profile = {}) => ({
  name: String(profile.name || "Open Source Candidate").trim(),
  publicSignature: String(profile.publicSignature || profile.name || "Candidate").trim(),
  headline: String(profile.headline || "").trim(),
  location: String(profile.location || "").trim(),
  workRights: asStringArray(profile.workRights),
  preferredLocations: asStringArray(profile.preferredLocations),
  degrees: asStringArray(profile.degrees),
  skills: asStringArray(profile.skills),
  experienceSignals: asStringArray(profile.experienceSignals),
  targetRoles: asStringArray(profile.targetRoles)
});

export const mergeProfiles = (publicProfile, localProfile = null) => {
  const normalizedPublic = normalizeProfile(publicProfile);
  if (!localProfile) {
    return {
      ...normalizedPublic,
      profileSource: "public-seed"
    };
  }

  const normalizedLocal = normalizeProfile({
    ...normalizedPublic,
    ...localProfile
  });

  return {
    ...normalizedPublic,
    ...normalizedLocal,
    profileSource: "private-local"
  };
};
