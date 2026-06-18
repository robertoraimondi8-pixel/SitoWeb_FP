import { useEffect, useState } from "react";

export type StoredUser = { first_name: string };

const KEY = "fp_auth_user";
const EVENT = "fp-auth-changed";

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(EVENT));
}

export function clearStoredUser() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function useAuthUser(): [StoredUser | null, () => void] {
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return [user, clearStoredUser];
}
