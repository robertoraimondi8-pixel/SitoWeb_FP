import React, { createContext, useContext, useState, useCallback } from 'react';

interface CurrentRoundInfo {
  round_id: string;
  round_number: number;
  round_type: string;
  label: string;
  status: string; // OPEN | LIVE | COMPLETED | PENDING
  total_matches: number;
  my_predictions_count: number;
  matchup_id: string | null;
  opponent_name: string | null;
  my_points: number;
  opp_points: number;
  live_total: number | null;
}

interface CompetitionContextType {
  mode: 'league' | 'tournament';
  tournamentId: string | null;
  tournamentName: string;
  currentRoundInfo: CurrentRoundInfo | null;
  setLeagueMode: () => void;
  setTournamentMode: (id: string, name: string) => void;
  setCurrentRoundInfo: (info: CurrentRoundInfo | null) => void;
}

const CompetitionContext = createContext<CompetitionContextType>({
  mode: 'league',
  tournamentId: null,
  tournamentName: '',
  currentRoundInfo: null,
  setLeagueMode: () => {},
  setTournamentMode: () => {},
  setCurrentRoundInfo: () => {},
});

export function CompetitionProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'league' | 'tournament'>('league');
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  const [currentRoundInfo, setCurrentRoundInfo] = useState<CurrentRoundInfo | null>(null);

  const setLeagueMode = useCallback(() => {
    setMode('league');
    setTournamentId(null);
    setTournamentName('');
    setCurrentRoundInfo(null);
  }, []);

  const setTournamentMode = useCallback((id: string, name: string) => {
    setMode('tournament');
    setTournamentId(id);
    setTournamentName(name);
  }, []);

  return (
    <CompetitionContext.Provider value={{ mode, tournamentId, tournamentName, currentRoundInfo, setLeagueMode, setTournamentMode, setCurrentRoundInfo }}>
      {children}
    </CompetitionContext.Provider>
  );
}

export function useCompetition() {
  return useContext(CompetitionContext);
}
