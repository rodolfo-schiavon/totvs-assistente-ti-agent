export default function AppLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Carregando">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4 text-sm text-[var(--color-muted)]">Carregando página…</p>
      </div>
    </div>
  );
}
