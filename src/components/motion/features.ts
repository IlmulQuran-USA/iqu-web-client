// Motion's animation features (animate, variants, exit, hover/tap/in-view), for
// every page: the scroll reveals and the counters need nothing more. Imported
// lazily by MotionProvider, so it is never part of a page's first-load
// JavaScript. Layout animation (domMax) loads only where it is used:
// LayoutFeatures (owner, 23 Nov 2026).
import { domAnimation } from "motion/react";

export default domAnimation;
