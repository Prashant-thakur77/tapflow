import React from "react";
import { REGIME_MODEL_CONFIG, WorkflowPlayer } from "./WorkflowCore";

export const RegimeModelCREWorkflow: React.FC = () => (
  <WorkflowPlayer config={REGIME_MODEL_CONFIG} diagramId="regime-model" />
);
