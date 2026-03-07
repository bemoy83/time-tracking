interface LoadingBlockProps {
  message?: string;
}

export function LoadingBlock({ message = 'Loading…' }: LoadingBlockProps) {
  return (
    <div className="loading-spinner" role="status" aria-live="polite">
      <span className="loading-spinner__ring" aria-hidden />
      {message}
    </div>
  );
}
