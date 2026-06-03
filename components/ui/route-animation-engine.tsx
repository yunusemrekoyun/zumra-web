'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type AnimationRun = {
  animations: Animation[];
  finished: Promise<void>;
};

type RouteTransitionClick = React.MouseEvent<HTMLAnchorElement>;

type UseDashboardRouteNavigationOptions = {
  currentPath: string;
  rootSelector: string;
  warmupHeaders?: HeadersInit;
};

type DashboardRouteTransitionProps = {
  children: React.ReactNode;
  className?: string;
  routeKey: string;
  scope: string;
};

const MAX_AUTO_BUBBLES = 18;
const EXIT_EMPTY_PAUSE_MS = 90;
const ENTER_STAGGER_MS = 35;
const EXIT_STAGGER_MS = 22;

export function useDashboardRouteNavigation({
  currentPath,
  rootSelector,
  warmupHeaders,
}: UseDashboardRouteNavigationOptions) {
  const router = useRouter();
  const shouldReduceMotion = usePrefersReducedMotion();
  const isNavigatingRef = useRef(false);
  const activeAnimationsRef = useRef<Animation[]>([]);
  const warmedRoutesRef = useRef(new Set<string>());

  useEffect(() => {
    isNavigatingRef.current = false;
  }, [currentPath]);

  useEffect(() => {
    return () => {
      cancelAnimations(activeAnimationsRef.current);
    };
  }, []);

  const warmRoute = useCallback((targetPath: string) => {
    if (targetPath === currentPath || warmedRoutesRef.current.has(targetPath)) {
      return Promise.resolve();
    }

    warmedRoutesRef.current.add(targetPath);

    return fetch(targetPath, {
      credentials: 'same-origin',
      headers: warmupHeaders,
    })
      .then(() => undefined)
      .catch(() => {
        warmedRoutesRef.current.delete(targetPath);
      });
  }, [currentPath, warmupHeaders]);

  const navigateWithTransition = useCallback(
    async (event: RouteTransitionClick, targetPath: string) => {
      if (shouldUseNativeNavigation(event, currentPath, targetPath)) {
        return;
      }

      event.preventDefault();

      if (isNavigatingRef.current) {
        return;
      }

      isNavigatingRef.current = true;
      cancelAnimations(activeAnimationsRef.current);

      const warmup = warmRoute(targetPath);
      const exitRun = animateOut(document.querySelector<HTMLElement>(rootSelector), shouldReduceMotion);
      activeAnimationsRef.current = exitRun.animations;

      await exitRun.finished;
      await pauseEmptyState();
      await warmup;

      router.push(targetPath);
    },
    [currentPath, rootSelector, router, shouldReduceMotion, warmRoute],
  );

  return {
    navigateWithTransition,
    warmRoute,
  };
}

export function DashboardRouteTransition({
  children,
  className = 'h-full min-h-full',
  routeKey,
  scope,
}: DashboardRouteTransitionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeAnimationsRef = useRef<Animation[]>([]);
  const shouldReduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    return () => {
      cancelAnimations(activeAnimationsRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    cancelAnimations(activeAnimationsRef.current);
    resetMainScroll(rootRef.current);

    const enterRun = animateIn(rootRef.current, shouldReduceMotion);
    activeAnimationsRef.current = enterRun.animations;

    enterRun.finished.then(() => {
      clearBubbleStyles(rootRef.current);
      activeAnimationsRef.current = [];
    });
  }, [routeKey, shouldReduceMotion]);

  return (
    <div ref={rootRef} data-dashboard-route-root={scope} className={className}>
      {children}
    </div>
  );
}

function animateIn(root: HTMLElement | null, shouldReduceMotion: boolean): AnimationRun {
  if (!root) {
    return emptyAnimationRun();
  }

  const bubbles = getBubbleElements(root);

  if (shouldReduceMotion || !bubbles.length) {
    return playAnimations([
      root.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 120,
        easing: 'ease-out',
        fill: 'both',
      }),
    ]);
  }

  bubbles.forEach((bubble) => {
    setElementStyles(bubble, {
      filter: 'blur(8px)',
      opacity: '0',
      transform: 'translateY(18px) scale(0.94)',
      transformOrigin: 'center center',
      willChange: 'opacity, transform, filter',
    });
  });

  return playAnimations(
    bubbles.map((bubble, index) =>
      bubble.animate(
        [
          {
            filter: 'blur(10px)',
            opacity: 0,
            transform: 'translateY(18px) scale(0.92)',
          },
          {
            filter: 'blur(0px)',
            opacity: 1,
            offset: 0.78,
            transform: 'translateY(0) scale(1.025)',
          },
          {
            filter: 'blur(0px)',
            opacity: 1,
            transform: 'translateY(0) scale(1)',
          },
        ],
        {
          delay: index * ENTER_STAGGER_MS,
          duration: 500,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'both',
        },
      ),
    ),
  );
}

function animateOut(root: HTMLElement | null, shouldReduceMotion: boolean): AnimationRun {
  if (!root) {
    return emptyAnimationRun();
  }

  const bubbles = getBubbleElements(root);

  if (shouldReduceMotion || !bubbles.length) {
    return playAnimations([
      root.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 100,
        easing: 'ease-out',
        fill: 'both',
      }),
    ]);
  }

  return playAnimations(
    [...bubbles].reverse().map((bubble, index) =>
      bubble.animate(
        [
          {
            filter: 'blur(0px)',
            opacity: 1,
            transform: 'translateY(0) scale(1)',
          },
          {
            filter: 'blur(8px)',
            opacity: 0,
            transform: 'translateY(-10px) scale(0.92)',
          },
        ],
        {
          delay: index * EXIT_STAGGER_MS,
          duration: 280,
          easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)',
          fill: 'both',
        },
      ),
    ),
  );
}

function shouldUseNativeNavigation(
  event: RouteTransitionClick,
  currentPath: string,
  targetPath: string,
) {
  const target = event.currentTarget.getAttribute('target');

  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    target === '_blank' ||
    targetPath === currentPath
  );
}

function playAnimations(animations: Animation[]): AnimationRun {
  return {
    animations,
    finished: Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(
      () => undefined,
    ),
  };
}

function emptyAnimationRun(): AnimationRun {
  return {
    animations: [],
    finished: Promise.resolve(),
  };
}

function getBubbleElements(root: HTMLElement) {
  const explicitBubbles = Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        '[data-route-bubble]:not([data-route-bubble="false"])',
        '[data-admin-bubble]:not([data-admin-bubble="false"])',
      ].join(','),
    ),
  );

  if (explicitBubbles.length) {
    return dedupeElements(explicitBubbles).slice(0, MAX_AUTO_BUBBLES);
  }

  return collectAutoBubbles(getPageRoot(root)).slice(0, MAX_AUTO_BUBBLES);
}

function collectAutoBubbles(root: HTMLElement) {
  const bubbles: HTMLElement[] = [];

  if (isPrimaryBubble(root)) {
    return [root];
  }

  const add = (element: Element | null) => {
    if (!isHTMLElement(element) || element.dataset.routeBubble === 'false' || element.dataset.adminBubble === 'false') {
      return;
    }

    bubbles.push(element);
  };

  Array.from(root.children).forEach((child) => {
    if (!isHTMLElement(child)) {
      return;
    }

    if (isPrimaryBubble(child)) {
      add(child);
      return;
    }

    if (isLayoutShell(child)) {
      collectLayoutBubbles(child).forEach(add);
      return;
    }

    getFirstPanelChild(child).forEach(add);
  });

  if (!bubbles.length) {
    Array.from(root.children).forEach(add);
  }

  return dedupeElements(bubbles).filter(isVisibleElement);
}

function collectLayoutBubbles(parent: HTMLElement, depth = 0): HTMLElement[] {
  if (depth > 3) {
    return [];
  }

  return Array.from(parent.children).flatMap((child) => {
    if (!isHTMLElement(child) || child.dataset.routeBubble === 'false' || child.dataset.adminBubble === 'false') {
      return [];
    }

    if (isPrimaryBubble(child)) {
      return [child];
    }

    if (isLayoutShell(child)) {
      return collectLayoutBubbles(child, depth + 1);
    }

    return getFirstPanelChild(child);
  });
}

function getFirstPanelChild(parent: HTMLElement): HTMLElement[] {
  const child = Array.from(parent.children).find(
    (item): item is HTMLElement => isHTMLElement(item) && isPrimaryBubble(item),
  );

  return child ? [child] : [];
}

function isHTMLElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement;
}

function dedupeElements(elements: HTMLElement[]) {
  return elements.filter((element, index) => elements.indexOf(element) === index);
}

function isVisibleElement(element: HTMLElement) {
  return element.offsetWidth > 0 && element.offsetHeight > 0;
}

function getPageRoot(root: HTMLElement) {
  const firstChild = root.firstElementChild;

  if (root.children.length === 1 && isHTMLElement(firstChild)) {
    return firstChild;
  }

  return root;
}

function isPrimaryBubble(element: HTMLElement) {
  return (
    element.dataset.routeBubble === 'true' ||
    element.dataset.adminBubble === 'true' ||
    isHeadingBlock(element) ||
    isActionHeader(element) ||
    isPanelLike(element)
  );
}

function isHeadingBlock(element: HTMLElement) {
  return /^H[1-6]$/.test(element.tagName);
}

function isActionHeader(element: HTMLElement) {
  const className = element.className.toString();

  return (
    className.includes('justify-between') &&
    className.includes('items-center') &&
    element.querySelector('h1, h2, h3') !== null
  );
}

function isLayoutShell(element: HTMLElement) {
  const className = element.className.toString();

  return (
    className.split(/\s+/).includes('grid') ||
    className.split(/\s+/).includes('flex') ||
    className.includes('grid-cols-') ||
    className.includes('space-y-') ||
    className.includes('gap-')
  );
}

function isPanelLike(element: HTMLElement) {
  const className = element.className.toString();

  return (
    className.includes('rounded-2xl') ||
    className.includes('rounded-3xl') ||
    className.includes('rounded-[1.5rem]') ||
    className.includes('rounded-[2rem]') ||
    className.includes('rounded-[2.5rem]') ||
    className.includes('bg-white') ||
    className.includes('bg-gradient')
  );
}

function resetMainScroll(root: HTMLElement | null) {
  const scrollContainer = root?.closest('main');

  if (scrollContainer) {
    scrollContainer.scrollTo({ top: 0, left: 0 });
  }
}

function pauseEmptyState() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, EXIT_EMPTY_PAUSE_MS);
  });
}

function setElementStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(element.style, styles);
}

function clearBubbleStyles(root: HTMLElement | null) {
  if (!root) {
    return;
  }

  getBubbleElements(root).forEach((bubble) => {
    bubble.style.opacity = '';
    bubble.style.transform = '';
    bubble.style.transformOrigin = '';
    bubble.style.filter = '';
    bubble.style.willChange = '';
  });
}

function cancelAnimations(animations: Animation[]) {
  animations.forEach((animation) => animation.cancel());
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => {
      mediaQuery.removeEventListener('change', updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}
