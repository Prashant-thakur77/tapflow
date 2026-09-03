import React from "react";
import { SETTLEMENT_CONFIG, WorkflowPlayer } from "./WorkflowCore";

export const SettlementCREWorkflow: React.FC = () => (
  <WorkflowPlayer config={SETTLEMENT_CONFIG} diagramId="settlement-cre" />
);
