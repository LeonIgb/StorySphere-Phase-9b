// Authentication boundary (Phase 5).
//
// !!! THIS IS NOT SECURE AUTHENTICATION !!!
// The implementation below is a LOCAL PROTOTYPE. Accounts live in this device's storage, the
// password "hash" is a toy (see weakHash in utils/account.js) and anyone with the device can
// read or edit it. It exists so the sign-up, sign-in and profile flows can be built and tested
// without a server. Never use it for real people or real passwords.
//
// To connect a real backend later, replace `authProvider` with an object that has the same
// methods (each returns a Promise of { ok, user?, error?, errors? }) and nothing else in the app
// has to change:
//
//   restoreSession()                         -> { ok, user | null }
//   signUp({ displayName, email, password, confirm, role })
//   signIn({ email, password })
//   signInDemo()
//   signOut()
//   deleteAccount(userId)
//
// `user` is always { id, email, isDemo, createdAt }. Profile data is kept separately.

import { AUTH_KEY, DEMO_USER_ID } from '../data/storageKeys';
import { loadJSON, saveJSON } from '../utils/storage';
import { newId } from '../utils/creator';
import { newSalt, normalizeEmail, validateRegistration, validateSignIn, weakHash } from '../utils/account';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const LATENCY = 350;

const publicUser = (u) => ({ id: u.id, email: u.email || null, isDemo: Boolean(u.isDemo), createdAt: u.createdAt });
const DEMO_USER = { id: DEMO_USER_ID, email: null, isDemo: true, createdAt: '2026-01-15T09:00:00.000Z' };

async function readStore() {
  const raw = await loadJSON(AUTH_KEY, null);
  const store = raw && typeof raw === 'object' ? raw : {};
  return {
    users: Array.isArray(store.users) ? store.users.filter((u) => u && u.id && u.email && u.salt && u.hash) : [],
    session: store.session && typeof store.session.userId === 'string' ? store.session : null,
  };
}

const writeStore = (store) => saveJSON(AUTH_KEY, { version: 1, ...store });

export const localAuthProvider = {
  async restoreSession() {
    const store = await readStore();
    if (!store.session) return { ok: true, user: null };
    if (store.session.userId === DEMO_USER_ID) return { ok: true, user: DEMO_USER };
    const found = store.users.find((u) => u.id === store.session.userId);
    return { ok: true, user: found ? publicUser(found) : null };
  },

  async signUp({ displayName, email, password, confirm }) {
    await delay(LATENCY);
    const errors = validateRegistration({ displayName, email, password, confirm });
    if (Object.keys(errors).length) return { ok: false, errors, error: 'Check the highlighted fields.' };
    const store = await readStore();
    const mail = normalizeEmail(email);
    if (store.users.some((u) => u.email === mail)) {
      return { ok: false, errors: { email: 'An account with this email already exists on this device.' }, error: 'Email already used.' };
    }
    const salt = newSalt();
    const record = { id: newId('u'), email: mail, salt, hash: weakHash(salt, password), createdAt: new Date().toISOString() };
    await writeStore({ users: [...store.users, record], session: { userId: record.id } });
    return { ok: true, user: publicUser(record) };
  },

  async signIn({ email, password }) {
    await delay(LATENCY);
    const errors = validateSignIn({ email, password });
    if (Object.keys(errors).length) return { ok: false, errors, error: 'Check the highlighted fields.' };
    const store = await readStore();
    const mail = normalizeEmail(email);
    const found = store.users.find((u) => u.email === mail);
    // One message for both cases, as a real service would, so it doesn't reveal which emails exist.
    if (!found || found.hash !== weakHash(found.salt, password)) {
      return { ok: false, errors: {}, error: 'That email and password don’t match an account on this device.' };
    }
    await writeStore({ users: store.users, session: { userId: found.id } });
    return { ok: true, user: publicUser(found) };
  },

  async signInDemo() {
    await delay(200);
    const store = await readStore();
    await writeStore({ users: store.users, session: { userId: DEMO_USER_ID } });
    return { ok: true, user: DEMO_USER };
  },

  async signOut() {
    const store = await readStore();
    await writeStore({ users: store.users, session: null });
    return { ok: true };
  },

  async deleteAccount(userId) {
    const store = await readStore();
    await writeStore({ users: store.users.filter((u) => u.id !== userId), session: null });
    return { ok: true };
  },
};

// The swap point.
export const authProvider = localAuthProvider;
