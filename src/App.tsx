import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { TradingView } from "./TradingView";
import { HistoryView } from "./HistoryView";
import { WalletView } from "./WalletView";
import { LPView } from "./LPView";
import { CREProofView } from "./CREProofView";
import { IntroView } from "./IntroView";
import { Toaster } from "react-hot-toast";

import { Layout } from "./Layout";

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<IntroView />} />
          <Route path="/trade" element={<TradingView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/wallet" element={<WalletView />} />
          <Route path="/lp" element={<LPView />} />
          <Route path="/cre-workflows" element={<CREProofView />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
