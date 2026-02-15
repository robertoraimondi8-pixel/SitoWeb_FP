import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall } from '../api/client';

interface League {
  id: string;
  name: string;
  league_type: string;
  season_id: string;
  invite_code?: string;
  owner_id?: string;
  member_count: number;
  created_at: string;
}

interface LeagueState {
  leagues: League[];
  activeLeague: League | null;
  loading: boolean;
  setActiveLeague: (league: League) => void;
  refreshLeagues: (token: string) => Promise<void>;
  hasLeagues: boolean;
}

const LeagueContext = createContext<LeagueState>({} as LeagueState);

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [activeLeague, setActiveLeagueState] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveLeague = useCallback((league: League) => {
    setActiveLeagueState(league);
    AsyncStorage.setItem('active_league_id', league.id);
  }, []);

  const refreshLeagues = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const ls: League[] = await apiCall('/leagues', { token });
      setLeagues(ls);

      // Restore active league or set first one
      const savedId = await AsyncStorage.getItem('active_league_id');
      const found = ls.find(l => l.id === savedId);
      if (found) {
        setActiveLeagueState(found);
      } else if (ls.length > 0) {
        setActiveLeagueState(ls[0]);
        AsyncStorage.setItem('active_league_id', ls[0].id);
      } else {
        setActiveLeagueState(null);
      }
    } catch (e) {
      console.error('Failed to load leagues:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <LeagueContext.Provider
      value={{ leagues, activeLeague, loading, setActiveLeague, refreshLeagues, hasLeagues: leagues.length > 0 }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export const useLeague = () => useContext(LeagueContext);
