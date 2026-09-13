export type AppView = 'Network' | 'Wifi' | 'Airplay' | 'Bluetooth' | 'AES67' | 'Resources' | 'LED';

export type PtpLockStatus = 'locked' | 'syncing' | 'master' | 'free_running' | 'faulty' | 'inactive';

export interface PtpStatus {
  installed: boolean;
  service_active: boolean;
  service_enabled: boolean;
  state: string;
  lock_status: PtpLockStatus;
  profile: string;
  profile_name: string;
  domain: number;
  clock_identity: string;
  gm_identity: string;
  gm_present: boolean;
  is_master: boolean;
  master_offset_ns: number;
  master_offset_us: number;
  mean_path_delay_ns: number;
  steps_removed: number;
  port_identity: string;
  interface: string;
  timestamping: string;
}

export interface PtpProfile {
  id: string;
  name: string;
  description: string;
  domain: number;
  logSyncInterval: number;
  logAnnounceInterval: number;
  announceReceiptTimeout: number;
  logMinDelayReqInterval: number;
  delay_mechanism: string;
  network_transport: string;
  is_active: boolean;
}