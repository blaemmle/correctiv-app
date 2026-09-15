import { act } from 'react-test-renderer';

import { diaries, earlyAccess } from '@correctiv/app-core/data/backstage';

/**
 * Onboarding and Backstage, the two places a screen once addressed someone who had
 * not paid. Onboarding decides whether it asks again; Backstage opens everything to
 * whoever is inside.
 *
 * Onboarding is also where a dark pattern would be easiest to introduce, so the tests
 * assert the one escape hatch that is left: skipping still counts as done. "Erstmal
 * umsehen" went with ADR 0018, and the join flow this file used to cover with ADR 0020.
 */

// `Stack.Screen` because `ScreenHeader` configures the platform's header through
// it on native, and a screen with a header therefore reaches expo-router for more
// than `router` now (ADR 0030).
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/openArticle', () => ({ openArticle: jest.fn() }));

import { router } from 'expo-router';

import { press, render, renderedText } from './support/rendering';

import BackstageScreen from '@/app/backstage';
import OnboardingScreen from '@/app/onboarding';
import { resetStore } from '@correctiv/app-core/stores/store';

import { coreStore } from '@/lib/store/core';

const push = router.push as jest.Mock;
const replace = router.replace as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

describe('onboarding', () => {
  it('opens on the mission screen with no skip', () => {
    const text = renderedText(render(<OnboardingScreen />));
    expect(text).toContain('Recherchen für die Gesellschaft');
    expect(text).not.toContain('Überspringen');
    // "Ohne Paywall: Journalismus für alle" stood here until ADR 0018.
    expect(text).not.toContain('Paywall');
  });

  it('records interests', () => {
    const tree = render(<OnboardingScreen />);
    press(tree, 'Los geht’s');

    press(tree, 'Klima');
    press(tree, 'Lokal');

    expect(coreStore.getState().interests.selected).toEqual(['klima', 'lokal']);
  });

  it('counts a skip as done, so it never asks twice', () => {
    const tree = render(<OnboardingScreen />);
    press(tree, 'Los geht’s');
    press(tree, 'Überspringen');

    expect(coreStore.getState().settings.onboardingDone).toBe(true);
    expect(replace).toHaveBeenCalledWith('/(tabs)');
    expect(push).not.toHaveBeenCalled();
  });

  /**
   * The last step used to be the club pitch, with "Unterstützer:in werden" beside
   * "Erstmal umsehen". Behind the door (ADR 0016) both address someone who is not
   * here, so the step went with ADR 0018 and the walk ends one screen earlier.
   */
  it('ends after the participate step, with nothing left to buy', () => {
    const tree = render(<OnboardingScreen />);
    press(tree, 'Los geht’s');
    press(tree, 'Weiter');

    const text = renderedText(tree);
    expect(text).not.toContain('Unterstützer:in werden');
    expect(text).not.toContain('Erstmal umsehen');

    press(tree, 'Fertig');
    expect(coreStore.getState().settings.onboardingDone).toBe(true);
  });
});

describe('Backstage', () => {
  /**
   * Nothing here is locked, and that has not changed. What went with ADR 0018 is the
   * guest's copy: the teaser line and the "Mit dem Club jetzt lesen" button that
   * routed to the join flow instead of the article.
   */
  it('shows everything and opens the article directly', () => {
    const tree = render(<BackstageScreen />);
    const text = renderedText(tree);
    expect(text).toContain(earlyAccess.title);
    expect(text).toContain(diaries[0].title);
    expect(text).not.toContain('Mit dem Club jetzt lesen');
    expect(text).not.toContain('es ist eine Einladung');

    press(tree, 'Jetzt lesen');
    expect(push).not.toHaveBeenCalled(); // openArticle is mocked, not a route push
  });

  it('opens a diary entry', () => {
    press(render(<BackstageScreen />), diaries[0].title);
    expect(push).toHaveBeenCalledWith({
      pathname: '/tagebuch/[id]',
      params: { id: diaries[0].id },
    });
  });
});
