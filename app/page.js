'use client';

import { useEffect, useState } from 'react';
import LoginCard from './components/LoginCard';
import ConsumerApp from './components/ConsumerApp';

export default function Home() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((session) => setUser(session.user || null))
      .catch(() => setError('Unable to check sign-in. Please reload.'))
      .finally(() => setChecking(false));

    const authError = new URLSearchParams(location.search).get('auth');
    if (authError) setError(authError === 'google-config' ? 'Google sign-in is awaiting server configuration.' : 'Google sign-in could not be completed.');

    const saved = localStorage.getItem('causaledge-markets-access') || '';
    if (saved) { setToken(saved); setDraft(saved); }
  }, []);

  function unlock(event) {
    event.preventDefault();
    const next = draft.trim();
    if (!next) return;
    localStorage.setItem('causaledge-markets-access', next);
    setToken(next);
  }

  async function lock() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
    localStorage.removeItem('causaledge-markets-access');
    setToken('');
    setDraft('');
  }

  if (checking) return <LoginCard loading/>;
  if (!token && !user) return <LoginCard error={error} draftToken={draft} setDraftToken={setDraft} unlock={unlock}/>;
  return <ConsumerApp token={token} user={user} onLock={lock}/>;
}
