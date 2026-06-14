/**
 * Keyboard "skip to content" link. Visually hidden until focused (Tab), then it
 * appears so a keyboard/screen-reader user can jump past the repeated
 * header/stepper straight to the page's `<main id="main-content">`.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
  );
}
