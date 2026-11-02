"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="empty">
      <h1>We couldn’t open the shelf.</h1>
      <p>
        Please try again. If the problem continues, check the service
        configuration.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
