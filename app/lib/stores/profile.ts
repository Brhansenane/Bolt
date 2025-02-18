import { atom } from 'nanostores';

interface Profile {
  username: string;
  bio: string;
  avatar: string;
}

// Initialize with stored profile or defaults
const storedProfile = typeof window !== 'undefined' ? localStorage.getItem('bolt_profile') : null;
const initialProfile: Profile = storedProfile
  ? JSON.parse(storedProfile)
  : {
      username: '',
      bio: '',
      avatar: '',
    };

export const profileStore = atom<Profile>(initialProfile);

let saveTimeout: NodeJS.Timeout | null = null;

const saveToLocalStorage = (profile: Profile) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('bolt_profile', JSON.stringify(profile));
  }
};

const debouncedSave = (profile: Profile) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveToLocalStorage(profile);
  }, 500);
};

export const updateProfile = (updates: Partial<Profile>) => {
  const newProfile = { ...profileStore.get(), ...updates };
  profileStore.set(newProfile);

  // Debounce localStorage updates
  debouncedSave(newProfile);
};
