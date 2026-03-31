export function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="meta-card">
      <span className="meta-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
