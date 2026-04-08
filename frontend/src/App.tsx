import { useEffect } from "react";
import { GameProvider, useGame } from "./context/GameContext";
import AuthScreen from "./components/AuthScreen";
import LobbyScreen from "./components/LobbyScreen";
import RoomBrowserScreen from "./components/RoomBrowserScreen";
import MatchmakingScreen from "./components/MatchmakingScreen";
import GameBoard from "./components/GameBoard";
import GameOverScreen from "./components/GameOverScreen";

function Router() {
  const { screen, restoreAuth } = useGame();

  useEffect(() => {
    restoreAuth();
  }, [restoreAuth]);

  switch (screen) {
    case "auth": return <AuthScreen />;
    case "lobby": return <LobbyScreen />;
    case "rooms": return <RoomBrowserScreen />;
    case "matchmaking": return <MatchmakingScreen />;
    case "game": return <GameBoard />;
    case "gameover": return <GameOverScreen />;
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
