import { NavLink } from 'react-router';
import { Plus } from 'lucide-react';
import { useDrawerNavigation } from '../hooks/useDrawerNavigation';
import styles from './TopNavigation.module.css';

/**
 * Corner chrome: monogram top-left, stacked nav top-right, and a round
 * "New incident" action bottom-right. The corners use difference blending,
 * so they stay legible over both the black canvas and white surfaces.
 */
export function TopNavigation() {
  const { openCreate } = useDrawerNavigation();
  return (
    <header className={styles.header}>
      <NavLink to="/" className={styles.brand} aria-label="Trace — Overview">
        T<span className={styles.apostrophe}>’</span>
      </NavLink>
      <nav aria-label="Primary" className={styles.nav}>
        <NavLink to="/" end className={styles.link}>
          Overview
        </NavLink>
        <NavLink to="/explore" className={styles.link}>
          Explore Data
        </NavLink>
      </nav>
      <button type="button" className={styles.create} onClick={openCreate}>
        <Plus aria-hidden="true" />
        <span>New incident</span>
      </button>
    </header>
  );
}
