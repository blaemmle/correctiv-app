import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from './kit/button';

/**
 * The difference between "something broke" and a black rectangle.
 *
 * A React tree with no boundary in it unmounts on any throw, and what the reader
 * gets is an empty page with nothing in it to read, report or recover from. This
 * site had exactly that: a panel library threw on the fourth navigation and the
 * whole workbench went dark.
 *
 * It wraps the main area only. The rail, the header and the status line stay, so
 * the way out is still on screen, which is the point: the reader is one click
 * from a view that works rather than one reload from starting over.
 *
 * That is also why the failed state carries `data-view-failed`. Wrapping only the
 * main area means a route that throws still leaves a header, a rail and a status
 * line in `#root` — a page with plenty of elements and plenty of words, every one
 * of them this component's apology — and `scripts/renders.mjs` asking only whether
 * something mounted would call that a rendered workbench. It reads this attribute
 * instead of the heading below it, because a heading is prose somebody will reword
 * and the check would go quietly green. `test/renders.test.ts` holds the two ends
 * together.
 */
interface Props {
  children: ReactNode;
  route: string;
}

interface State {
  error: Error | null;
  /** The route the error belongs to, so leaving it clears it. */
  route: string;
}

export class Boundary extends Component<Props, State> {
  state: State = { error: null, route: this.props.route };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  /**
   * A different view is a fresh attempt.
   *
   * Derived from the props rather than set in `componentDidUpdate`, which the
   * linter refuses and is right to: that would render the failure once more
   * before clearing it. Without this the reader stays on the error after
   * navigating away from it, until they reload.
   */
  static getDerivedStateFromProps(props: Props, state: State): State | null {
    return props.route === state.route ? null : { error: null, route: props.route };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept, because the browser's own console is where this lands. The
    // preview's console panel is patched onto the frame's window and never
    // this one, so nothing on the site would carry the message otherwise.
    console.error('[workbench] view failed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div data-view-failed={this.props.route} className="px-m py-2xl lg:px-ml">
        <h1 className="text-headline-l font-semibold">This view did not render</h1>
        <p className="mt-s max-w-content text-m leading-relaxed text-on-canvas-muted">
          The rest of the workbench still works: pick another section on the left, or press{' '}
          <kbd className="rounded-s border border-stroke px-3xs font-mono text-s">⌘K</kbd> to
          search. The error is below and in the browser console.
        </p>
        <pre className="mt-m max-w-content overflow-x-auto rounded-md border border-stroke bg-surface p-sm text-s">
          {error.message}
        </pre>
        <Button
          variant="outline"
          className="mt-m"
          onClick={() => {
            this.setState({ error: null, route: this.props.route });
          }}
        >
          Try this view again
        </Button>
      </div>
    );
  }
}
