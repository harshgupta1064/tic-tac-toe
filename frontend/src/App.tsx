import { GameProvider, useGame } from './context/GameContext';
import AuthScreen from './components/AuthScreen';
import LobbyScreen from './components/LobbyScreen';
import MatchmakingScreen from './components/MatchmakingScreen';
import GameBoard from './components/GameBoard';
import GameOverScreen from './components/GameOverScreen';

function Router() {
  const { screen } = useGame();

  switch (screen) {
    case 'auth': return <AuthScreen />;
    case 'lobby': return <LobbyScreen />;
    case 'matchmaking': return <MatchmakingScreen />;
    case 'game': return <GameBoard />;
    case 'gameover': return <GameOverScreen />;
    default: return <AuthScreen />;
  }
}

export default function App() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}
