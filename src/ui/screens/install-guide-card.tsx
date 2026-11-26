import { useEffect, useState } from 'react';
import { INSTALL_PROMPT, browserInstallEnvironment, detectInstallPlatform } from '../install-guide';
import type { InstallPlatform, InstallPromptHolder } from '../install-guide';
import { STRINGS } from '../strings';

/** Props for {@link InstallGuideCard}. */
export interface InstallGuideCardProps {
  /** Defaults to this browser. */
  readonly platform?: InstallPlatform;
  /** Defaults to the app's holder filled at start-up. */
  readonly prompt?: InstallPromptHolder;
}

/**
 * Cài đặt "Đưa app ra màn hình chính" (story 053): iPhone / Android tabs with short steps (the
 * device's own tab open first), a one-tap "Cài app" button when Chrome offers its prompt, and
 * only "✓ App đã ở màn hình chính" when the app already runs from the home screen.
 */
export function InstallGuideCard({ platform = detectInstallPlatform(browserInstallEnvironment()), prompt = INSTALL_PROMPT }: InstallGuideCardProps) {
  const [tab, setTab] = useState<'ios' | 'android'>(platform === 'android' ? 'android' : 'ios');
  const [canPrompt, setCanPrompt] = useState(() => prompt.available());
  const [installed, setInstalled] = useState(platform === 'installed');

  useEffect(() => prompt.subscribe(() => setCanPrompt(prompt.available())), [prompt]);

  const install = async () => {
    const outcome = await prompt.show();
    if (outcome === 'accepted') setInstalled(true);
  };

  return (
    <section className="card install-guide" aria-labelledby="install-guide-title">
      <h2 id="install-guide-title" className="card__title">
        {STRINGS.installTitle}
      </h2>
      {installed ? (
        <p className="install-guide__done">{STRINGS.installDone}</p>
      ) : (
        <>
          <p className="message">{STRINGS.installIntro}</p>
          {canPrompt && (
            <button type="button" className="button button--primary" onClick={() => void install()}>
              {STRINGS.installButton}
            </button>
          )}
          <div className="install-guide__tabs" role="tablist" aria-label={STRINGS.installTitle}>
            {(['ios', 'android'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`install-tab-${key}`}
                aria-selected={tab === key}
                aria-controls="install-steps"
                className={tab === key ? 'install-guide__tab install-guide__tab--on' : 'install-guide__tab'}
                onClick={() => setTab(key)}
              >
                {key === 'ios' ? STRINGS.installTabIos : STRINGS.installTabAndroid}
              </button>
            ))}
          </div>
          <ol id="install-steps" className="install-guide__steps" role="tabpanel" aria-labelledby={`install-tab-${tab}`}>
            {(tab === 'ios' ? STRINGS.installStepsIos : STRINGS.installStepsAndroid).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
