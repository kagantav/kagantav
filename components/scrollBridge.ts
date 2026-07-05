import type Lenis from "lenis";

/**
 * Gives the Selected Work live mode direct access to the Lenis instance
 * so it can stop smooth scrolling while the scene is frozen and restore
 * the exact scroll position (killing any residual inertia target) before
 * handing control back. Null when Lenis is not running (reduced motion).
 */
export const scrollBridge: { lenis: Lenis | null } = { lenis: null };
