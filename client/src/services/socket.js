/* ═══════════════════════════════════════════════════════════════════════════
   Live data context — same contract the template already consumed:
   { kpis, alerts, advisories, lastUpdate, connected, acknowledgeAlert }
   Backed by the mutation store; swap for a Socket.IO client and the
   consuming components stay untouched.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { ADVISORIES, portfolioStats } from '../data/rvnlData';
import {
  subscribe, getState, currentUser, effectiveAlerts,
  acknowledgeAlertLocal, acknowledgeAllAlerts, setRole, setZone, setOnline,
  flushSyncQueue, pendingApprovalCount, resetState,
} from './store';
import { scopedProjects } from './api';

const SocketContext = createContext(null);
export const DataContext = createContext(null);

export function SocketProvider({ children }) {
  const [tick, setTick] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [connected, setConnected] = useState(true);

  /* Re-render on any store mutation */
  useEffect(() => subscribe(() => {
    setTick(t => t + 1);
    setLastUpdate(new Date());
  }), []);

  /* No polling heartbeat.
     `lastUpdate` is a dependency of every page's fetch effect, so ticking it on
     a timer made the whole application reload itself on a fixed cadence — maps
     re-zoomed and panels flashed their loading state for no new information.
     It now changes only when the data actually changes (a store mutation) or
     when the user asks for a refresh via requestData(). */

  const st = getState();

  const alerts = useMemo(() => effectiveAlerts(), [tick]);          // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => {
    const s = portfolioStats(scopedProjects());
    return {
      portfolioValue: s.totalEstimate,
      projectCount: s.projectCount,
      activeCount: s.activeCount,
      physicalProgress: s.physicalProgress,
      plannedProgress: s.plannedProgress,
      variance: s.variance,
      expenditure: s.totalExpenditure,
      burnPct: s.burnPct,
      projectsAtRisk: s.projectsAtRisk,
      criticalProjects: s.criticalProjects,
      riskExposure: s.riskExposure,
      landAcquiredPct: s.land.acquiredPct,
      blockedKm: s.land.blockedKm,
      parcelsPending: s.land.pending,
      clearancesPending: s.clearancesPending,
      clearancesBreached: s.clearancesBreached,
      forestStage2Pending: s.forestStage2Pending,
      slippagePct: s.slippagePct,
      milestonesSlipped: s.milestonesSlipped,
      milestonesTotal: s.milestonesTotal,
      avgSlipDays: s.avgSlipDays,
      ltifr: s.ltifr,
      safetyIncidents: s.safetyIncidents,
      fatalities: s.fatalities,
      openNcrs: s.openNcrs,
      openRisks: s.openRisks,
      criticalRisks: s.criticalRisks,
    };
  }, [tick]);                                                        // eslint-disable-line react-hooks/exhaustive-deps

  const acknowledgeAlert = useCallback((alertId) => acknowledgeAlertLocal(alertId), []);

  const value = {
    kpis,
    alerts,
    advisories: ADVISORIES,
    lastUpdate,
    connected,
    setConnected,
    user: currentUser(),
    role: st.role,
    zone: st.zone,
    online: st.online,
    syncQueue: st.syncQueue,
    pendingApprovals: pendingApprovalCount(),
    acknowledgeAlert,
    acknowledgeAll: acknowledgeAllAlerts,
    setRole,
    setZone,
    setOnline,
    flushSyncQueue,
    resetDemoState: resetState,
    requestData: () => setLastUpdate(new Date()),
    /* legacy keys the template referenced */
    weather: null,
    binsSummary: {},
    vehiclesSummary: {},
  };

  return (
    <SocketContext.Provider value={null}>
      <DataContext.Provider value={value}>{children}</DataContext.Provider>
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
export const useData = () => useContext(DataContext);
