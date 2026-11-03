import { STRINGS } from '../strings';

/** Props for {@link ComingSoonScreen}. */
export interface ComingSoonScreenProps {
  /** Screen title, e.g. STRINGS.tabLearn. */
  readonly title: string;
}

/**
 * Placeholder for a tab whose story is not built yet
 * (Học: story 005, Con đường: story 006).
 */
export function ComingSoonScreen({ title }: ComingSoonScreenProps) {
  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{title}</h1>
      </header>
      <section className="card card--coming-soon">
        <h2 className="card__title">{STRINGS.comingSoon}</h2>
        <p className="card__body">{STRINGS.comingSoonBody}</p>
      </section>
    </main>
  );
}
