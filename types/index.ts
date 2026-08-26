// ============================================================
// WagonFinder — Core TypeScript Types
// ============================================================

export type Role = 'shipper' | 'wagon_owner';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type WagonType = 'tank' | 'hopper' | 'flatcar' | 'boxcar' | 'gondola' | 'refrigerator';
export type WagonStatus = 'active' | 'in_repair' | 'booked';
export type WagonAvailabilityType = 'spot' | 'lease' | 'both';
export type GU12Status = 'active' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';
export type PendingApplicationStatus = 'pending' | 'accepted';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  bin: string | null;
  ktz_payer_code: string | null;
  company_name: string | null;
  phone: string | null;
  verification_status: VerificationStatus;
  balance_kzt: number;
  language?: 'ru' | 'kk' | 'en';
  created_at: string;
  updated_at: string;
}

export interface BalanceTransaction {
  id: string;
  profile_id: string;
  amount_kzt: number;
  type: 'top_up' | 'commission' | 'refund';
  description: string | null;
  contract_id: string | null;
  created_at: string;
}

export interface Wagon {
  id: string;
  number: string;
  owner_id: string;
  wagon_type: WagonType;
  payload_capacity_tons: number | null;
  volume_m3: number | null;
  model_number: string | null;
  tare_weight_tons: number | null;
  last_repair_date: string | null;
  next_repair_date: string | null;
  remaining_mileage_km: number | null;
  status: WagonStatus;
  availability_type: WagonAvailabilityType;
  current_esr_code: string | null;
  last_operation: string | null;
  last_tracked_at: string | null;
  created_at: string;
  updated_at: string;
  contract_wagons?: { contract_id: string; contracts: { status: string } | null }[];
}

export interface GU12Order {
  id: string;
  shipper_id: string;
  gu12_number: string;
  cargo_etsng_code: string;
  departure_esr_code: string;
  arrival_esr_code: string;
  quantity_planned: number;
  quantity_fulfilled: number;
  period_start: string;
  period_end: string;
  status: GU12Status;
  deal_type: 'spot' | 'lease';
  is_public: boolean;
  created_at: string;
  etsng_cargos?: ETSNGCargo;
  departure_station?: { name: string };
  arrival_station?: { name: string };
}

export interface PendingApplication {
  id: string;
  gu12_order_id: string;
  wagon_owner_id: string;
  wagon_id: string;
  status: PendingApplicationStatus;
  message: string | null;
  created_at: string;
  gu12_order?: GU12Order;
  wagon?: Wagon;
  wagon_owner?: Profile;
}

export interface ShipperRequest {
  id: string;
  gu12_order_id: string;
  shipper_id: string;
  wagon_id: string;
  wagon_owner_id: string;
  status: 'pending' | 'accepted';
  message: string | null;
  created_at: string;
  gu12_order?: GU12Order;
  wagon?: Wagon;
  shipper?: { full_name: string; company_name: string | null; bin: string | null };
}

export interface RejectedApplication {
  id: string;
  gu12_order_id: string;
  wagon_owner_id: string;
  wagon_id: string;
  rejection_reason: string | null;
  message: string | null;
  created_at: string;
  gu12_order?: GU12Order;
  wagon?: Wagon;
}


export interface ContractWagon {
  id: string;
  contract_id: string;
  wagon_id: string | null;
  wagon_number: string;
  wagon_type: string;
  application_id: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  application_id: string | null;
  gu12_order_id: string | null;
  executor_id: string | null;
  customer_id: string | null;
  contract_number: string;
  status: 'pending_payment' | 'pending_signature' | 'signed';
  executor_company: string;
  executor_bin: string;
  executor_name: string;
  customer_company: string;
  customer_bin: string;
  customer_name: string;
  wagon_number: string | null;
  wagon_type: string | null;
  cargo_name: string;
  cargo_etsng: string;
  departure_station: string;
  arrival_station: string;
  period_start: string;
  period_end: string;
  executor_paid_at: string | null;
  customer_paid_at: string | null;
  executor_signed_at: string | null;
  customer_signed_at: string | null;
  executor_phone: string | null;
  executor_email: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  deal_type: 'spot' | 'lease';
  created_at: string;
  contract_wagons?: ContractWagon[];
}

export interface ESRStation {
  code: string;
  name: string;
  country: string;
}

export interface ETSNGCargo {
  code: string;
  name: string;
  wagon_type_required: WagonType | null;
}

// KTZ Service types
export interface KTZWagonData {
  number: string;
  wagon_type: WagonType;
  payload_capacity_tons: number;
  volume_m3: number;
  model_number: string;
  tare_weight_tons: number;
  last_repair_date: string;
  next_repair_date: string;
  remaining_mileage_km: number;
  operational_status: 'operational' | 'non_operational';
}

export interface KTZTrackingData {
  wagon_number: string;
  current_esr_code: string;
  station_name: string;
  last_operation: string;
  operation_time: string;
  next_station_esr: string | null;
}

export interface KTZGu12Data {
  gu12_number: string;
  cargo_etsng_code: string;
  departure_esr_code: string;
  arrival_esr_code: string;
  quantity_planned: number;
  period_start: string;
  period_end: string;
}
