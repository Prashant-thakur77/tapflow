import React from "react";
import { PRICE_INTEGRITY_CONFIG, WorkflowPlayer } from "./WorkflowCore";

export const PriceIntegrityCREWorkflow: React.FC = () => (
  <WorkflowPlayer config={PRICE_INTEGRITY_CONFIG} diagramId="price-integrity" />
);
