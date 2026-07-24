/// <reference types="vite/client" />

interface OrbWidgetOptions {
  target?: HTMLElement;
  token: string;
  baseUrl: string;
  title?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  draggable?: boolean;
  signatory?: SignatoryContext | null;
}

interface PatientContext {
  ehr_patient_id: string;
  nhs_number?: string;
  first_name: string;
  last_name: string;
  dob?: string;
  sex?: string;
}

interface SignatoryContext {
  first_name?: string;
  last_name?: string;
  email?: string;
}

declare class OrbWidget {
  constructor(options: OrbWidgetOptions);
  open(patient?: PatientContext): void;
  close(): void;
  setPatient(patient: PatientContext): void;
  setSignatory(signatory: SignatoryContext | null): void;
  setToken(token: string): void;
  refreshToken(newToken: string): void;
  destroy(): void;
}
