import { Variants } from "framer-motion";

/**
 * DeXMart Standard Bouncy Physics
 * Optimized for premium, responsive-feeling UI elements.
 */
export const BOUNCY_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 20,
};

const BOUNCY_BEZIER = [0.34, 1.56, 0.64, 1];
export const BOUNCY_BEZIER_STRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/**
 * Creates "Rolling" variants for list items (used in Header & Sidebar).
 *
 * @param totalItems Number of items for reverse delay calculation
 * @param itemWidth The width the item should take when visible
 * @returns Framer Motion Variants
 */
export const createRollingVariants = (
  totalItems: number,
  itemWidth: string = "40px",
): Variants => ({
  hidden: (i: number) => ({
    width: 0,
    opacity: 0,
    scale: 0.8,
    rotate: -45,
    marginRight: 0,
    overflow: "hidden",
    transition: {
      ...BOUNCY_SPRING,
      delay: (totalItems - 1 - i) * 0.05,
    },
  }),
  visible: (i: number) => ({
    width: itemWidth,
    opacity: 1,
    scale: 1,
    rotate: 0,
    marginRight: "8px",
    transition: {
      ...BOUNCY_SPRING,
      delay: i * 0.05,
    },
  }),
});

/**
 * Variants for the container itself (stretching/shrinking)
 */
const bouncyCollapseVariants: Variants = {
  collapsed: {
    transition: BOUNCY_SPRING,
  },
  expanded: {
    transition: BOUNCY_SPRING,
  },
};

/**
 * Standard Bouncy Hover/Tap Interactions
 */
export const BOUNCY_HOVER = {
  scale: 1.02,
  transition: BOUNCY_SPRING,
};

export const BOUNCY_TAP = {
  scale: 0.98,
  transition: BOUNCY_SPRING,
};

/**
 * Modal (Dialog/Sheet) Variants
 */
export const BOUNCY_MODAL_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: BOUNCY_SPRING,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: BOUNCY_SPRING,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: BOUNCY_SPRING,
  },
};
