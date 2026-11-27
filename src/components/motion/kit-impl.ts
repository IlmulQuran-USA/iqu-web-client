/*
 * The animation kit, loaded after the first paint by ./kit.ts: Motion's mini
 * animate (Web Animations API, interruptible) and Motion's own spring
 * generator, so every spring here is the same curve Motion's components drew
 * (js-headroom, 27 Nov 2026). Both packages are side-effect free, so only
 * these two exports reach the chunk.
 */
export { animate } from "motion/mini";
export { spring } from "motion";
