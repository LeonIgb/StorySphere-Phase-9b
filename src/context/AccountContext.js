import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { accountKey, allUserKeys, DEMO_USER_ID } from '../data/storageKeys';
import { demoSeed } from '../data/currentUser';
import { authProvider } from '../services/authService';
import { setMyProfile } from '../services/storyService';
import { bumpCatalog } from '../services/catalog';
import { directory } from '../services/profileService';
import { getStorageMode, loadJSON, removeKey, saveJSON } from '../utils/storage';
import {
  DEFAULT_PREFS,
  applyProfileEdit,
  followersShown,
  makeHandle,
  newAccountDoc,
  publicProfileView,
  sanitizeAccountDoc,
  toggleId,
} from '../utils/account';

// Who is signed in, their profile, preferences and follow lists.
//
// Sign-in goes through services/authService.js (a local, NOT secure prototype; swap it for a
// real backend). Everything else here is per account: the account document is saved under
// accountKey(user.id), and the app remounts the other providers when the user changes
// (see App.js), so two accounts never see each other's library, history or stories.
const AccountContext = createContext(null);

const demoDoc = () => ({
  profile: { ...demoSeed.profile },
  prefs: { ...DEFAULT_PREFS },
  social: { following: [...demoSeed.social.following], followers: [...demoSeed.social.followers] },
});

async function loadDoc(user) {
  const fallback = user.isDemo
    ? demoDoc()
    : newAccountDoc({ displayName: user.email ? user.email.split('@')[0] : 'Reader', role: 'reader', userId: user.id });
  const saved = await loadJSON(accountKey(user.id), null);
  return saved ? sanitizeAccountDoc(saved, fallback) : fallback;
}

export function AccountProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [doc, setDoc] = useState(null);
  const [storageMode, setStorageMode] = useState(getStorageMode());
  const docRef = useRef(null);
  const userRef = useRef(null);

  const apply = useCallback((nextUser, nextDoc) => {
    userRef.current = nextUser;
    docRef.current = nextDoc;
    setUser(nextUser);
    setDoc(nextDoc);
  }, []);

  // Restore the session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let result = { ok: false };
      try {
        result = await authProvider.restoreSession();
      } catch (e) {
        result = { ok: false };
      }
      if (cancelled) return;
      if (result.ok && result.user) {
        const d = await loadDoc(result.user);
        if (cancelled) return;
        apply(result.user, d);
      }
      setStorageMode(getStorageMode());
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const persistDoc = useCallback(async (nextDoc) => {
    const u = userRef.current;
    if (!u) return;
    await saveJSON(accountKey(u.id), nextDoc);
    setStorageMode(getStorageMode());
  }, []);

  const commitDoc = useCallback(
    (nextDoc) => {
      docRef.current = nextDoc;
      setDoc(nextDoc);
      persistDoc(nextDoc);
    },
    [persistDoc]
  );

  // ---------------------------------------------------------------- auth actions
  const finishSignIn = useCallback(
    async (result, firstDoc) => {
      if (!result.ok) return result;
      let d = await loadDoc(result.user);
      if (firstDoc) {
        d = firstDoc;
        await saveJSON(accountKey(result.user.id), d);
      }
      apply(result.user, d);
      setStorageMode(getStorageMode());
      return result;
    },
    [apply]
  );

  const signUp = useCallback(
    async (form) => {
      const result = await authProvider.signUp(form);
      if (!result.ok) return result;
      const taken = directory.map((p) => p.handle);
      const first = newAccountDoc({
        displayName: form.displayName.trim(),
        role: form.role,
        handle: makeHandle(form.displayName, taken),
        userId: result.user.id,
      });
      return finishSignIn(result, first);
    },
    [finishSignIn]
  );

  const signIn = useCallback(async (form) => finishSignIn(await authProvider.signIn(form)), [finishSignIn]);
  const signInDemo = useCallback(async () => finishSignIn(await authProvider.signInDemo()), [finishSignIn]);

  const signOut = useCallback(async () => {
    await authProvider.signOut();
    apply(null, null);
  }, [apply]);

  const deleteAccount = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    apply(null, null); // unmounts per-account providers, which flush their last save
    await new Promise((resolve) => setTimeout(resolve, 80));
    await Promise.all(allUserKeys(u.id).map((k) => removeKey(k)));
    await authProvider.deleteAccount(u.id);
  }, [apply]);

  // ---------------------------------------------------------------- profile, prefs, follows
  const updateProfile = useCallback(
    (patch) => {
      const current = docRef.current;
      if (!current) return { ok: false, errors: {} };
      const result = applyProfileEdit(current.profile, patch);
      if (result.ok) commitDoc({ ...current, profile: result.profile });
      return result;
    },
    [commitDoc]
  );

  const setPref = useCallback(
    (key, value) => {
      const current = docRef.current;
      if (!current) return;
      commitDoc({ ...current, prefs: { ...current.prefs, [key]: value } });
    },
    [commitDoc]
  );

  const toggleFollow = useCallback(
    (personId) => {
      const current = docRef.current;
      if (!current || !personId || personId === 'me') return false;
      const following = toggleId(current.social.following, personId);
      commitDoc({ ...current, social: { ...current.social, following } });
      return following.includes(personId);
    },
    [commitDoc]
  );

  // Puts the demo account's profile, preferences and follow lists back to the seed.
  const resetDemo = useCallback(() => {
    if (!userRef.current || !userRef.current.isDemo) return;
    commitDoc(demoDoc());
  }, [commitDoc]);

  // ---------------------------------------------------------------- derived
  const profile = doc ? doc.profile : null;
  const prefs = doc ? doc.prefs : null;
  const social = doc ? doc.social : null;

  // The signed-in user as a directory entry (what other screens show).
  const me = useMemo(
    () =>
      profile
        ? {
            id: 'me',
            name: profile.displayName,
            handle: profile.handle,
            bio: profile.bio,
            color: profile.avatarColor,
            avatarUri: profile.avatarUri,
            role: profile.role,
            genres: profile.preferredGenres,
            followers: social.followers.length,
            verified: false,
          }
        : null,
    [profile, social]
  );

  // Keep the mock service in step with the profile so Home, Discover and creator pages agree.
  // (Runs on every profile change; a change refetches the screens through the catalog version.)
  const view = prefs ? publicProfileView(prefs) : null;
  useEffect(() => {
    if (!me) {
      setMyProfile(null);
      return;
    }
    setMyProfile({
      name: me.name,
      handle: me.handle,
      bio: view.showBio ? me.bio : '',
      color: me.color,
      avatarUri: me.avatarUri,
      genres: me.genres,
      followers: me.followers,
      role: me.role,
      hidden: !view.visible,
    });
    bumpCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, view && view.visible, view && view.showBio]);

  const isFollowing = useCallback((id) => Boolean(social) && social.following.includes(id), [social]);
  // Follower number to show for anyone. Yours is real (your list); others are base + you.
  const followerCountFor = useCallback(
    (person) => {
      if (!person) return 0;
      if (person.id === 'me') return social ? social.followers.length : 0;
      return followersShown(person, isFollowing(person.id));
    },
    [social, isFollowing]
  );

  const value = useMemo(
    () => ({
      ready,
      user,
      isDemo: Boolean(user && user.isDemo),
      isSignedIn: Boolean(user),
      storageMode,
      profile,
      prefs,
      social,
      me,
      publicView: view,
      signUp,
      signIn,
      signInDemo,
      signOut,
      deleteAccount,
      updateProfile,
      setPref,
      toggleFollow,
      isFollowing,
      followerCountFor,
      resetDemo,
    }),
    [
      ready, user, storageMode, profile, prefs, social, me, view, signUp, signIn, signInDemo, signOut,
      deleteAccount, updateProfile, setPref, toggleFollow, isFollowing, followerCountFor, resetDemo,
    ]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>');
  return ctx;
}

export { DEMO_USER_ID };
