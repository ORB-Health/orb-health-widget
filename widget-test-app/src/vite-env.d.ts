/// <reference types="vite/client" />

interface OrbWidgetOptions {
  target?: HTMLElement;
  token: string;
  baseUrl: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  draggable?: boolean;
}

interface PatientContext {
  ehr_patient_id: string;
  nhs_number?: string;
  first_name: string;
  last_name: string;
  dob?: string;
  sex?: string;
}

declare class OrbWidget {
  constructor(options: OrbWidgetOptions);
  open(patient?: PatientContext): void;
  close(): void;
  setPatient(patient: PatientContext): void;
  setToken(token: string): void;
  refreshToken(newToken: string): void;
  destroy(): void;
}
