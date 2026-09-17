import React, { useState } from 'react';
import { LiveMicroserviceConsole } from './LiveMicroserviceConsole';
import { LiveSourceCodeViewer } from './LiveSourceCodeViewer';
import { SreCommandCenter } from './SreCommandCenter';

interface Props {
  onIncidentCreated: (id: string) => void;
  onOpenLlmInspector?: (agentId?: string) => void;
  onError: (title: string, msg?: string) => void;
  onSuccess: (title: string, msg?: string) => void;
}

export function MissionControlView({
  onIncidentCreated,
  onOpenLlmInspector,
  onError,
  onSuccess,
}: Props) {
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [latestTestOutput, setLatestTestOutput] = useState<any | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[580px] font-sans">
      {/* Col 1: Microservice Transaction Simulator */}
      <div className="lg:col-span-3 min-h-[560px] flex flex-col">
        <LiveMicroserviceConsole
          onIncidentTriggered={(id) => {
            setActiveIncidentId(id);
            onIncidentCreated(id);
          }}
          onError={onError}
          onSuccess={onSuccess}
        />
      </div>

      {/* Col 2: Real Source Code Editor (services/payment_gateway.py) */}
      <div className="lg:col-span-5 min-h-[560px] flex flex-col">
        <LiveSourceCodeViewer
          onCodePatched={() => {}}
          onCodeReset={() => {}}
          onTestOutput={(testOut) => setLatestTestOutput(testOut)}
          onError={onError}
          onSuccess={onSuccess}
        />
      </div>

      {/* Col 3: 14B SRE Command War Room */}
      <div className="lg:col-span-4 min-h-[560px] flex flex-col">
        <SreCommandCenter
          incidentId={activeIncidentId}
          testOutput={latestTestOutput}
          onOpenLlmInspector={onOpenLlmInspector}
          onError={onError}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  );
}
