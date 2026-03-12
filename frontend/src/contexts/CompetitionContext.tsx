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

interface LeagueMatchdayInfo {
  matchdayId: string;
  status: string;
  leagueId: string;
}

interface CompetitionContextType {
  mode: 'league' | 'tournament';
  tournamentId: string | null;
  tournamentName: string;
  currentRoundInfo: CurrentRoundInfo | null;
  leagueMatchdayInfo: LeagueMatchdayInfo | null;
  pendingMatchupOpen: string | null;
  setLeagueMode: () => void;
  setTournamentMode: (id: string, name: string) => void;
  setCurrentRoundInfo: (info: CurrentRoundInfo | null) => void;
  setLeagueMatchdayInfo: (info: LeagueMatchdayInfo | null) => void;
  setPendingMatchupOpen: (id: string | null) => void;
}

const CompetitionContext = createContext<CompetitionContextType>({
  mode: 'league',
  tournamentId: null,
  tournamentName: '',
  currentRoundInfo: null,
  leagueMatchdayInfo: null,
  pendingMatchupOpen: null,
  setLeagueMode: () => {},
  setTournamentMode: () => {},
  setCurrentRoundInfo: () => {},
  setLeagueMatchdayInfo: () => {},
  setPendingMatchupOpen: () => {},
});

export function CompetitionProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'league' | 'tournament'>('league');
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  const [currentRoundInfo, setCurrentRoundInfo] = useState<CurrentRoundInfo | null>(null);
  const [leagueMatchdayInfo, setLeagueMatchdayInfo] = useState<LeagueMatchdayInfo | null>(null);
  const [pendingMatchupOpen, setPendingMatchupOpen] = useState<string | null>(null);

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
    setLeagueMatchdayInfo(null);
  }, []);

  return (
    <CompetitionContext.Provider value={{
      mode, tournamentId, tournamentName, currentRoundInfo, leagueMatchdayInfo, pendingMatchupOpen,
      setLeagueMode, setTournamentMode, setCurrentRoundInfo, setLeagueMatchdayInfo, setPendingMatchupOpen,
    }}>
      {children}
    </CompetitionContext.Provider>
  );
}

export function useCompetition() {
  return useContext(CompetitionContext);
}
