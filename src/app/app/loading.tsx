export default function Loading() {
  return (
    <div className="loading-state" role="status">
      <div className="skeleton title" />
      <div className="skeleton banner" />
      <div className="metric-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton metric" key={i} />
        ))}
      </div>
      <p>Carregando seu espaço financeiro…</p>
    </div>
  );
}
