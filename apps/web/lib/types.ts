import { Timestamp } from "firebase/firestore";

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Timestamp | Date | any;
  end_date?: Timestamp | Date | any;
  type: "one-time" | "regular";
  max_participants: number;
  signups: string[]; // User IDs
  waiting_list: string[]; // User IDs
  cancellation_policy: string;
  cancellation_deadline?: Timestamp | Date | any;
  image_url?: string;
  tag: string; // e.g., "Social", "Training", "Tournament"
  event_leaders?: string[]; // User IDs (One or more)
  created_at: Timestamp | any;
  updated_at: Timestamp | any;
  tenant_id: string;
  use_end_date?: boolean;
  save_to_schedules?: boolean;
  court_id?: string;
  court_name?: string;
}
