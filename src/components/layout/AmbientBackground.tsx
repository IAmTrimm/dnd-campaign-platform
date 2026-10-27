// Atmospheric lighting behind every page.
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_45%_at_75%_-5%,rgba(134,40,54,0.2),transparent_65%),radial-gradient(ellipse_50%_35%_at_10%_105%,rgba(194,165,110,0.06),transparent_70%)]"
    />
  )
}
