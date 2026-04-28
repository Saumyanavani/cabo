import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { GameState } from "@/lib/game/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseConfig()) return null;
  client ??= createClient(supabaseUrl!, supabaseAnonKey!);
  return client;
}

export async function saveRoomState(state: GameState): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from("rooms").upsert({
    code: state.roomCode,
    state,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function loadRoomState(code: string): Promise<GameState | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("rooms").select("state").eq("code", code.toUpperCase()).maybeSingle();
  if (error) throw error;
  return (data?.state as GameState | undefined) ?? null;
}

export function subscribeToRoom(code: string, onState: (state: GameState) => void): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channel = supabase
    .channel(`room:${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
      (payload) => {
        const nextState = (payload.new as { state?: GameState } | null)?.state;
        if (nextState) onState(nextState);
      },
    )
    .subscribe();

  return channel;
}

export async function unsubscribeFromRoom(channel: RealtimeChannel | null): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase && channel) await supabase.removeChannel(channel);
}
