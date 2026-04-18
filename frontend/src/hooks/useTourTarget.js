import { useEffect, useRef } from 'react';
import { useTour } from './useTour';

/**
 * Register a DOM element as a tour target for a given step ID.
 * Ref-based registration takes priority over the CSS selector fallback
 * in tourSteps.js. Attach the returned ref to the target element.
 *
 * Usage:
 *   const ref = useTourTarget('step-katalog-search');
 *   return <input ref={ref} ... />;
 */
export function useTourTarget(stepId) {
  const ref = useRef(null);
  const { registerElement } = useTour();

  useEffect(() => {
    registerElement(stepId, ref.current);
    return () => registerElement(stepId, null);
  }, [stepId, registerElement]);

  return ref;
}
