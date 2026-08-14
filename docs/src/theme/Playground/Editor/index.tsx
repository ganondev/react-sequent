import React, {useState, type ReactNode} from 'react';
import {LiveEditor} from 'react-live';
import useIsBrowser from '@docusaurus/useIsBrowser';
import Translate from '@docusaurus/Translate';
import PlaygroundHeader from '@docusaurus/theme-live-codeblock/lib/theme/Playground/Header';

import styles from './styles.module.css';

export default function PlaygroundEditor(): ReactNode {
  const isBrowser = useIsBrowser();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <>
      <PlaygroundHeader>
        <div className={styles.headerRow}>
          <Translate
            id="theme.Playground.liveEditor"
            description="The live editor label of the live codeblocks">
            Live Editor
          </Translate>
          <button
            type="button"
            className={styles.toggleButton}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? (
              <Translate
                id="theme.Playground.showCode"
                description="The button label to show the live codeblock editor">
                Show code
              </Translate>
            ) : (
              <Translate
                id="theme.Playground.hideCode"
                description="The button label to hide the live codeblock editor">
                Hide code
              </Translate>
            )}
          </button>
        </div>
      </PlaygroundHeader>
      {!collapsed && (
        <LiveEditor
          // We force remount the editor on hydration,
          // otherwise dark prism theme is not applied
          key={String(isBrowser)}
          className={styles.playgroundEditor}
        />
      )}
    </>
  );
}
