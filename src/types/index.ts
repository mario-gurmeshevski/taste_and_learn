export interface BroadcastState {
  id: number;
  current_position: number;
  is_playing: boolean;
  updated_at: string;
}

export interface PlyrRef {
  plyr: any;
}
