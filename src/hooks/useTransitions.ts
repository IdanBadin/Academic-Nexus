/**
 * React bindings for the transitions.dev snippets installed in
 * `src/styles/transitions.css`.
 *
 * Each hook mirrors the JS orchestration documented in the skill reference
 * files, with `document.querySelector` swapped for refs. Timing is read back
 * out of the CSS custom properties so tuning `:root` stays the single source
 * of truth - durations are never hardcoded here.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Reads a `--custom-property` off <html> as a number of milliseconds. */
function readMs(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

/* ------------------------------------------------------------------ */
/* Modal open / close                                                  */
/* ------------------------------------------------------------------ */

export type ModalState = 'closed' | 'open' | 'closing';

export interface ModalTransition<T extends HTMLElement = HTMLDivElement> {
  /** Attach to the `.t-modal` element. */
  ref: React.RefObject<T>;
  /** False once the close animation has finished - use it to unmount. */
  isMounted: boolean;
  state: ModalState;
}

/**
 * Drives `.is-open` / `.is-closing` on a `.t-modal`.
 *
 * The `setTimeout` that strips `.is-closing` after `--modal-close-dur` is not
 * optional: without it the element is left sitting at the closing scale and
 * the next open jumps in from there instead of the resting pre-open scale.
 */
export function useModalTransition<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
): ModalTransition<T> {
  const ref = useRef<T>(null);
  const [state, setState] = useState<ModalState>(isOpen ? 'open' : 'closed');
  const firstRun = useRef(true);

  useEffect(() => {
    const el = ref.current;

    if (isOpen) {
      setState('open');
      el?.classList.remove('is-closing');
      el?.classList.add('is-open');
      return;
    }

    // Cold mount in the closed state should not play a close animation.
    if (firstRun.current) {
      firstRun.current = false;
      setState('closed');
      return;
    }

    setState('closing');
    el?.classList.remove('is-open');
    el?.classList.add('is-closing');

    const closeMs = readMs('--modal-close-dur', 150);
    const timer = window.setTimeout(() => {
      el?.classList.remove('is-closing');
      setState('closed');
    }, closeMs);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    firstRun.current = false;
  }, []);

  return { ref, isMounted: state !== 'closed', state };
}

/* ------------------------------------------------------------------ */
/* Success check                                                       */
/* ------------------------------------------------------------------ */

export interface SuccessCheck {
  /** Attach to the `.t-success-check` wrapper. */
  svgRef: React.RefObject<HTMLSpanElement>;
  /** Attach to the `<path>` that should draw its stroke. */
  pathRef: React.RefObject<SVGPathElement>;
  /** Plays (or replays) the appear animation. */
  play: () => void;
}

/**
 * Success check appear animation.
 *
 * Measures the real path with `getTotalLength()` and writes
 * `stroke-dasharray` / `stroke-dashoffset` inline, rounded up by 1 so
 * sub-pixel float jitter cannot pre-reveal the stroke. The CSS placeholder of
 * `20` is only a cold-start value.
 */
export function useSuccessCheck(): SuccessCheck {
  const svgRef = useRef<HTMLSpanElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  const measure = useCallback(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = Math.ceil(path.getTotalLength()) + 1;
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
  }, []);

  useLayoutEffect(() => {
    measure();
    const wrapper = svgRef.current;
    wrapper?.setAttribute('data-state', 'out');
  }, [measure]);

  const play = useCallback(() => {
    const wrapper = svgRef.current;
    if (!wrapper) return;
    measure();
    // Reset -> reflow -> re-add so the keyframes restart from offset 0.
    wrapper.setAttribute('data-state', 'out');
    void wrapper.offsetWidth; // force reflow
    wrapper.setAttribute('data-state', 'in');
  }, [measure]);

  return { svgRef, pathRef, play };
}

/* ------------------------------------------------------------------ */
/* Error state shake                                                   */
/* ------------------------------------------------------------------ */

export interface ErrorShake<T extends HTMLElement = HTMLDivElement> {
  /** Attach to the `.t-input-wrap` element. */
  ref: React.RefObject<T>;
  /** Flags the error, replays the shake, and schedules the auto-revert. */
  shake: () => void;
}

/**
 * Error state shake.
 *
 * `.is-error` and `.is-shaking` stay orthogonal on purpose: keeping them
 * separate is what lets the shake replay (remove -> reflow -> re-add) without
 * flickering the whole error treatment off and on in the same tick.
 */
export function useErrorShake<T extends HTMLElement = HTMLDivElement>(): ErrorShake<T> {
  const ref = useRef<T>(null);
  const shakeTimer = useRef<number | null>(null);
  const revertTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (shakeTimer.current !== null) {
      window.clearTimeout(shakeTimer.current);
      shakeTimer.current = null;
    }
    if (revertTimer.current !== null) {
      window.clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }
  }, []);

  const shake = useCallback(() => {
    const wrap = ref.current;
    if (!wrap) return;
    const input = wrap.querySelector<HTMLElement>('.t-input');
    if (!input) return;

    wrap.classList.add('is-error');
    input.classList.add('is-error');

    // Replay the shake from a clean baseline.
    input.classList.remove('is-shaking');
    void input.offsetWidth; // force reflow
    input.classList.add('is-shaking');

    const shakeMs = readMs('--shake-dur-a', 80) * 2 + readMs('--shake-dur-b', 60) * 2;

    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => {
      shakeTimer.current = null;
      input.classList.remove('is-shaking');
    }, shakeMs + 20);

    // Auto-revert: hold long enough to read the message, then let the CSS
    // transitions fade border + message back to neutral.
    if (revertTimer.current !== null) window.clearTimeout(revertTimer.current);
    const hold = readMs('--revert-hold', 3000);
    revertTimer.current = window.setTimeout(() => {
      revertTimer.current = null;
      wrap.classList.remove('is-error');
      input.classList.remove('is-error');
    }, shakeMs + hold);
  }, []);

  // Typing cancels the auto-revert and clears the error, so the user is not
  // left shaking at a value they are already correcting.
  useEffect(() => {
    const wrap = ref.current;
    if (!wrap) return;
    const field = wrap.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
    if (!field) return;

    const onInput = () => {
      if (revertTimer.current !== null) {
        window.clearTimeout(revertTimer.current);
        revertTimer.current = null;
      }
      wrap.classList.remove('is-error');
      wrap.querySelector<HTMLElement>('.t-input')?.classList.remove('is-error');
    };

    field.addEventListener('input', onInput);
    return () => field.removeEventListener('input', onInput);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return { ref, shake };
}

/* ------------------------------------------------------------------ */
/* Tabs sliding                                                        */
/* ------------------------------------------------------------------ */

export interface SlidingTabs {
  /** Attach to the `.t-tabs` bar. */
  listRef: React.RefObject<HTMLDivElement>;
  /** Attach to the `.t-tabs-pill` span. */
  pillRef: React.RefObject<HTMLSpanElement>;
}

/**
 * Positions the tab pill from the active tab's `offsetLeft` / `offsetWidth`.
 *
 * First paint and resize write the position with `transition: none` (then a
 * forced reflow, then the transition is restored). Skipping that suspension
 * makes the pill animate in from `translateX(0)` / `width: 0` on mount.
 */
export function useSlidingTabs(activeIndex: number): SlidingTabs {
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const hasPainted = useRef(false);

  const moveTo = useCallback((index: number, animate: boolean) => {
    const bar = listRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;

    const tabs = Array.from(bar.querySelectorAll<HTMLElement>('.t-tab'));
    const tab = tabs[index] ?? tabs[0];
    if (!tab) return;

    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = 'none';
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
      void pill.offsetWidth; // force reflow before the transition comes back
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    moveTo(activeIndex, hasPainted.current);
    hasPainted.current = true;
  }, [activeIndex, moveTo]);

  useEffect(() => {
    const onResize = () => moveTo(activeIndex, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeIndex, moveTo]);

  return { listRef, pillRef };
}
