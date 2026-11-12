/** Timings of the board's motion, in ms. Kept calm on purpose: no bounces, no draw-on effects. */
export const TURN_MS = 340
/** Rolling the cube to show another face. */
export const ROLL_MS = 560
/** After a turn its arrows hold, then fade. */
export const ARROW_HOLD_MS = 650
export const ARROW_FADE_MS = 450
/** The move's letter shows this long after it lands. */
export const LETTER_MS = 350
/** Undo shows this long from the moment a turn is made. */
export const UNDO_MS = 2000

export const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
