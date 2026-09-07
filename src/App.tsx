import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './cloudbase';

import Landing from './components/Landing';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import Layout from './components/Layout';
import Matches from './components/Matches';
import Buddies from './components/Buddies';
import Profile from './components/Profile';
import Mailbox from './components/Mailbox';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLoginState = async () => {
      const loginState = await auth.getLoginState();
      if (loginState) {
        setUser(auth.currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    checkLoginState();

    const unsubscribe = auth.onLoginStateChanged((loginState) => {
      if (loginState) {
        setUser(auth.currentUser);
      } else {
        setUser(null);
      }
    });

    return () => {
      // CloudBase onLoginStateChanged might not return an unsubscribe function,
      // but if it does, we call it. Otherwise we just ignore.
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"></div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/matches" /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to="/matches" /> : <Auth />} />
        <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/" />} />
        
        <Route element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/matches" element={<Matches />} />
          <Route path="/buddies" element={<Buddies />} />
          <Route path="/mailbox" element={<Mailbox />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
