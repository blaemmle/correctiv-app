import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type TabId = 'home' | 'discover' | 'media' | 'participate' | 'profile';
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * The languages this app can be in. One, and adding a second is a catalogue plus
 * a member here — never a string in a screen
 * ([ADR 0026](../../../../adr/0026-react-native-review-and-hardening.md) §6).
 */
export type Locale = 'de';

export interface SettingsState {
  onboardingDone: boolean;
  pushOptIn: boolean;
  /** Scales the article typography in the reader (Profile → Settings). */
  textScale: number;
  newsletter: {
    spotlight: boolean;
    spotlightCh: boolean;
    klima: boolean;
  };
  /** Theme preference (Profile → Darstellung). 'system' follows the OS. */
  theme: ThemePreference;
  /**
   * The language every user-facing string is rendered in. Fixed, and read from
   * here rather than from the device: German is what ships, and a phone set to
   * English must not get an app half in English.
   */
  locale: Locale;
  // Ephemeral shell state (not persisted)
  activeTab: TabId;
  visitedTabs: TabId[];
}

export type NewsletterKey = keyof SettingsState['newsletter'];

/**
 * What survives a restart. The rest of the slice is shell state.
 *
 * `locale` is deliberately absent, and not because it is unimportant: it is a
 * constant with no action that writes it, so persisting it would only let a value
 * written to a device in 2026 outlive the day the constant changes — stale
 * storage quietly beating the code. Nothing here is worth storing that the source
 * already states.
 */
export const PERSISTED_KEYS = [
  'onboardingDone',
  'pushOptIn',
  'textScale',
  'newsletter',
  'theme',
] satisfies Array<keyof SettingsState>;

const initialState: SettingsState = {
  onboardingDone: false,
  pushOptIn: false,
  textScale: 1,
  newsletter: {
    spotlight: false,
    spotlightCh: false,
    klima: false,
  },
  theme: 'system',
  locale: 'de',
  activeTab: 'home',
  visitedTabs: ['home'],
};

const slice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<TabId>) {
      state.activeTab = action.payload;
      if (!state.visitedTabs.includes(action.payload)) state.visitedTabs.push(action.payload);
    },

    completeOnboarding(state) {
      state.onboardingDone = true;
    },

    setTheme(state, action: PayloadAction<ThemePreference>) {
      state.theme = action.payload;
    },

    /** One newsletter subscription. Keyed, so a host cannot invent a fourth list. */
    setNewsletter: {
      reducer(state, action: PayloadAction<{ key: NewsletterKey; subscribed: boolean }>) {
        state.newsletter[action.payload.key] = action.payload.subscribed;
      },
      prepare: (key: NewsletterKey, subscribed: boolean) => ({ payload: { key, subscribed } }),
    },

    setTextScale(state, action: PayloadAction<number>) {
      state.textScale = action.payload;
    },

    setPushOptIn(state, action: PayloadAction<boolean>) {
      state.pushOptIn = action.payload;
    },

    /**
     * The demo reset has to leave the app as if it were freshly installed: onboarding,
     * push, text size and the appearance setting. Interests live in their own slice —
     * the caller resets that one; this owns only its own keys.
     */
    resetForDemo(state) {
      state.onboardingDone = false;
      state.pushOptIn = false;
      state.textScale = 1;
      state.theme = 'system';
    },

    /** Applied by persist() at startup — see stores/persist.ts. */
    hydrate(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload);
    },
  },
});

/**
 * The language to render in, as a selector rather than a constant, because that
 * is the one shape a second language would not have to rewrite: the provider
 * already asks the store, so switching becomes an action and not a refactor.
 * There is no such action today, and no user-facing switch — a developer-only one
 * belongs in the workbench.
 */
export const locale = (state: SettingsState): Locale => state.locale;

export const settingsReducer = slice.reducer;
export const settingsActions = slice.actions;
export const {
  setActiveTab,
  completeOnboarding,
  setTheme,
  setNewsletter,
  setTextScale,
  setPushOptIn,
  resetForDemo,
} = slice.actions;
