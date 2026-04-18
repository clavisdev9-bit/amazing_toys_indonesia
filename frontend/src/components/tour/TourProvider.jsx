import React, {
  createContext,
  useReducer,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tourSteps } from '../../data/tourSteps';
import { useAuth } from '../../hooks/useAuth';

export const TourContext = createContext(null);

const initialState = {
  isActive: false,
  currentStepIndex: 0,
  hasSeenTour: localStorage.getItem('sos-tour-seen') === 'true',
  isTransitioning: false,
  showWelcome: false,
};

function tourReducer(state, action) {
  switch (action.type) {
    case 'SHOW_WELCOME':
      return { ...state, showWelcome: true };
    case 'START_TOUR':
      return {
        ...state,
        isActive: true,
        currentStepIndex: 0,
        showWelcome: false,
        isTransitioning: false,
      };
    case 'NEXT_STEP': {
      const next = state.currentStepIndex + 1;
      if (next >= tourSteps.length) {
        return { ...state, isActive: false, hasSeenTour: true };
      }
      return { ...state, currentStepIndex: next };
    }
    case 'PREV_STEP':
      return { ...state, currentStepIndex: Math.max(0, state.currentStepIndex - 1) };
    case 'SKIP_TOUR':
      return { ...state, isActive: false, showWelcome: false, hasSeenTour: true };
    case 'FINISH_TOUR':
      return { ...state, isActive: false, hasSeenTour: true };
    case 'GO_TO_STEP':
      return { ...state, currentStepIndex: action.payload };
    case 'SET_TRANSITIONING':
      return { ...state, isTransitioning: action.payload };
    default:
      return state;
  }
}

// Waits for a CSS selector to appear in the DOM (max `timeout` ms).
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) { resolve(el); return; }

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { observer.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[Tour] "${selector}" not found in ${timeout}ms`));
    }, timeout);

    // Clean up timer if resolved early
    observer._timer = timer;
  });
}

export function TourProvider({ children }) {
  const [state, dispatch] = useReducer(tourReducer, initialState);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role } = useAuth();
  const elementRefs = useRef({});
  const prevActiveTargetRef = useRef(null);
  const activationAbortRef = useRef(null);

  // Persist tour-seen flag to localStorage
  useEffect(() => {
    if (state.hasSeenTour) localStorage.setItem('sos-tour-seen', 'true');
  }, [state.hasSeenTour]);

  // Auto-show welcome modal on first visit to /katalog — customers only
  useEffect(() => {
    if (
      isAuthenticated &&
      role === 'CUSTOMER' &&
      !state.hasSeenTour &&
      !state.isActive &&
      !state.showWelcome &&
      location.pathname === '/katalog'
    ) {
      dispatch({ type: 'SHOW_WELCOME' });
    }
  }, [location.pathname, state.hasSeenTour, state.isActive, state.showWelcome, isAuthenticated, role]);

  // Clean up tour state on logout
  useEffect(() => {
    if (!isAuthenticated && (state.isActive || state.showWelcome)) {
      dispatch({ type: 'SKIP_TOUR' });
    }
  }, [isAuthenticated, state.isActive, state.showWelcome]);

  // Activate/deactivate tour-active-target class and handle page navigation
  useEffect(() => {
    // Remove highlight from previous target when tour stops
    if (!state.isActive) {
      if (prevActiveTargetRef.current) {
        prevActiveTargetRef.current.classList.remove('tour-active-target');
        prevActiveTargetRef.current = null;
      }
      return;
    }

    const step = tourSteps[state.currentStepIndex];
    if (!step) return;

    // Cancel any in-flight activation from a previous step
    if (activationAbortRef.current) activationAbortRef.current.cancelled = true;
    const token = { cancelled: false };
    activationAbortRef.current = token;

    async function activate() {
      // Navigate to target page if needed
      const needsNav = step.navigateTo && window.location.pathname !== step.navigateTo;
      if (needsNav) {
        dispatch({ type: 'SET_TRANSITIONING', payload: true });
        navigate(step.navigateTo);

        const selectorToWait = step.waitForSelector || step.targetSelector;
        if (selectorToWait) {
          try {
            await waitForElement(selectorToWait, 5000);
          } catch (e) {
            console.warn(e.message);
          }
        } else {
          await new Promise((r) => setTimeout(r, 400));
        }

        if (token.cancelled) return;
        dispatch({ type: 'SET_TRANSITIONING', payload: false });
      }

      if (token.cancelled) return;

      // Highlight target element
      const el = getTargetElementForStep(step);

      if (prevActiveTargetRef.current && prevActiveTargetRef.current !== el) {
        prevActiveTargetRef.current.classList.remove('tour-active-target');
      }

      if (el) {
        el.classList.add('tour-active-target');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        prevActiveTargetRef.current = el;
      } else {
        prevActiveTargetRef.current = null;
        if (step.targetSelector) {
          console.warn(`[Tour] Target not found: ${step.targetSelector}. Step will render centered.`);
        }
      }
    }

    activate();
  }, [state.isActive, state.currentStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function getTargetElementForStep(step) {
    if (!step || !step.targetSelector) return null;
    // Ref-based registration takes priority
    const ref = elementRefs.current[step.id];
    if (ref) return ref;
    // CSS selector fallback
    return document.querySelector(step.targetSelector);
  }

  const registerElement = useCallback((stepId, el) => {
    if (el) elementRefs.current[stepId] = el;
    else delete elementRefs.current[stepId];
  }, []);

  const getTargetElement = useCallback(() => {
    const step = tourSteps[state.currentStepIndex];
    return getTargetElementForStep(step);
  }, [state.currentStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function nextStep() { dispatch({ type: 'NEXT_STEP' }); }
  function prevStep() { dispatch({ type: 'PREV_STEP' }); }
  function skipTour() { dispatch({ type: 'SKIP_TOUR' }); }
  function finishTour() { dispatch({ type: 'FINISH_TOUR' }); }
  function startTour() { dispatch({ type: 'START_TOUR' }); }

  function restartTour() {
    localStorage.removeItem('sos-tour-seen');
    navigate('/katalog');
    // Small delay so navigation settles before tour starts
    setTimeout(() => dispatch({ type: 'START_TOUR' }), 100);
  }

  const currentStep = tourSteps[state.currentStepIndex] ?? null;
  const isLastStep = state.currentStepIndex === tourSteps.length - 1;

  return (
    <TourContext.Provider
      value={{
        ...state,
        // NOTE: ...state already spreads state.showWelcome (boolean).
        // Do NOT add a function named showWelcome here — it would overwrite
        // the boolean and break every consumer that checks `if (!showWelcome)`.
        currentStep,
        totalSteps: tourSteps.length,
        isLastStep,
        nextStep,
        prevStep,
        skipTour,
        finishTour,
        startTour,
        restartTour,
        registerElement,
        getTargetElement,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}
