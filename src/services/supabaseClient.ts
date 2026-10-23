import { createClient, type User } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

const getEnvVar = (viteKey: string, nodeKey?: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[viteKey]) {
      return (import.meta as any).env[viteKey] as string;
    }
  } catch {}
  try {
    const proc = (globalThis as any).process;
    if (proc && proc.env) {
      return (proc.env[viteKey] || (nodeKey ? proc.env[nodeKey] : '') || '') as string;
    }
  } catch {}
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-supabase-anon-key'
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function mapSupabaseUserToProfile(user: User): UserProfile {
  const metadata = user.user_metadata || {};
  const fallbackName = user.email ? user.email.split('@')[0] : 'Developer';
  const name = metadata.name || metadata.full_name || fallbackName;
  const color = metadata.color || '#6366f1';
  const username = metadata.username || fallbackName.toLowerCase().replace(/\s+/g, '_');

  return {
    id: user.id,
    name,
    email: user.email,
    color,
    username,
    avatarUrl: metadata.avatar_url,
  };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  color: string = '#6366f1'
) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = displayName.trim() || trimmedEmail.split('@')[0];

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: {
        name: trimmedName,
        color,
        username: trimmedName.toLowerCase().replace(/\s+/g, '_'),
      },
    },
  });

  if (error) {
    throw error;
  }

  const profile = data.user ? mapSupabaseUserToProfile(data.user) : null;
  return {
    user: profile,
    session: data.session,
    requiresEmailConfirmation: !data.session && Boolean(data.user),
  };
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  const trimmedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('Authentication succeeded but no user data returned');
  }

  return {
    user: mapSupabaseUserToProfile(data.user),
    session: data.session,
  };
}

export async function sendPasswordResetEmail(email: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  const trimmedEmail = email.trim().toLowerCase();
  const redirectTo = `${window.location.origin}/`;

  const { data, error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateUserPassword(newPassword: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }

  return {
    user: data.user ? mapSupabaseUserToProfile(data.user) : null,
  };
}

export async function signOutUser() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn('Supabase signOut warning:', error.message);
  }
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      return null;
    }
    return mapSupabaseUserToProfile(data.session.user);
  } catch (err) {
    console.warn('Failed to retrieve Supabase session:', err);
    return null;
  }
}
