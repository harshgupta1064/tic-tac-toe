import {
  UserProfile,
  COLLECTION_USERS,
  USER_PROFILE_KEY,
} from "../models/types";

function defaultProfile(userId: string, username: string): UserProfile {
  return {
    userId,
    username,
    wins:          0,
    losses:        0,
    draws:         0,
    currentStreak: 0,
    bestStreak:    0,
    rank:          0,
    totalGames:    0,
    updatedAt:     Date.now(),
  };
}

export function readProfile(
  nk: nkruntime.Nakama,
  userId: string,
  username: string
): UserProfile {
  try {
    const reads = nk.storageRead([{
      collection: COLLECTION_USERS,
      key:        USER_PROFILE_KEY,
      userId,
    } as any]);
    if (reads && reads.length > 0) {
      const raw = reads[0].value as any;
      const stored = (typeof raw === "string" ? JSON.parse(raw) : raw) as UserProfile;
      stored.username = username || stored.username;
      return stored;
    }
  } catch {}
  return defaultProfile(userId, username);
}

export function writeProfile(
  nk: nkruntime.Nakama,
  profile: UserProfile
): void {
  profile.updatedAt  = Date.now();
  profile.totalGames = profile.wins + profile.losses + profile.draws;
  nk.storageWrite([{
    collection:      COLLECTION_USERS,
    key:             USER_PROFILE_KEY,
    userId:          profile.userId,
    value:           profile as any,
    permissionRead:  2,
    permissionWrite: 1,
  } as any]);
}

export function readProfiles(
  nk: nkruntime.Nakama,
  userIds: string[]
): UserProfile[] {
  if (!userIds.length) return [];
  try {
    const reads = userIds.map((uid) => ({
      collection: COLLECTION_USERS,
      key:        USER_PROFILE_KEY,
      userId:     uid,
    }));
    const results = nk.storageRead(reads as any);
    return (results || []).map((r: any) => {
      const raw = r.value as any;
      return (typeof raw === "string" ? JSON.parse(raw) : raw) as UserProfile;
    });
  } catch {}
  return [];
}
