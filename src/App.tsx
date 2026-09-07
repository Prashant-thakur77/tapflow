import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Layout } from "./Layout";
import { IntroView } from "./IntroView";
import { TapView } from "./tap/TapView";
import { PortfolioView } from "./PortfolioView";
import { HistoryView } from "./HistoryView";
import { LeadersView } from "./LeadersView";
import { MarketsView } from "./MarketsView";
import { ProofView } from "./ProofView";
import { LeaderView } from "./LeaderView";

function App() {
  return (
    <Router>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#0b101c", color: "#f8faff", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13 },
        }}
      />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<IntroView />} />
          <Route path="/tap" element={<TapView />} />
          <Route path="/markets" element={<MarketsView />} />
          <Route path="/leaders" element={<LeadersView />} />
          <Route path="/leader/:address" element={<LeaderView />} />
          <Route path="/proof" element={<ProofView />} />
          <Route path="/portfolio" element={<PortfolioView />} />
          <Route path="/history" element={<HistoryView />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
