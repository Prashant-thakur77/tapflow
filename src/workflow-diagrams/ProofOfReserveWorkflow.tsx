import React from "react";
import { PROOF_OF_RESERVE_CONFIG, WorkflowPlayer } from "./WorkflowCore";

export const ProofOfReserveWorkflow: React.FC = () => (
  <WorkflowPlayer
    config={PROOF_OF_RESERVE_CONFIG}
    diagramId="proof-of-reserve"
  />
);
