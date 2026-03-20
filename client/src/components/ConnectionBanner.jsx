export default function ConnectionBanner({ message }) {
  if (!message) return null;
  return (
    <div className="conn-banner">
      <span className="conn-banner-dot" />
      {message}
    </div>
  );
}
