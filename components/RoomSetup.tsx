"use client";

import { useState } from "react";
import { LogIn, Sparkles } from "lucide-react";
import type { GameOptions } from "@/lib/game/types";

type RoomSetupProps = {
  message?: string | null;
  onCreate: (nickname: string, options: GameOptions) => void;
  onJoin: (code: string, nickname: string) => void;
  syncAvailable: boolean;
};

export function RoomSetup({ message, onCreate, onJoin, syncAvailable }: RoomSetupProps) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [includeJokers, setIncludeJokers] = useState(false);
  const trimmedName = nickname.trim();

  return (
    <main className="lobby-shell">
      <section className="lobby-copy">
        <p className="eyebrow">Private Cabo room</p>
        <h1>CABO</h1>
        <p>
          Create a room, share the code, and join by nickname. Two to four players can sit down before the host deals.
        </p>
      </section>

      <section className="setup-panel" aria-label="Room setup">
        <div className="setup-panel__header">
          {mode === "create" ? <Sparkles size={20} /> : <LogIn size={20} />}
          <div>
            <h2>{mode === "create" ? "Create room" : "Join room"}</h2>
            <p>{syncAvailable ? "Realtime room sync is enabled." : "Add Supabase env vars to enable online joining."}</p>
          </div>
        </div>

        <div className="segmented-control" role="tablist" aria-label="Room mode">
          <button
            aria-selected={mode === "create"}
            className={mode === "create" ? "segmented-control__item segmented-control__item--active" : "segmented-control__item"}
            onClick={() => setMode("create")}
            role="tab"
            type="button"
          >
            Create
          </button>
          <button
            aria-selected={mode === "join"}
            className={mode === "join" ? "segmented-control__item segmented-control__item--active" : "segmented-control__item"}
            onClick={() => setMode("join")}
            role="tab"
            type="button"
          >
            Join
          </button>
        </div>

        <label className="input-row input-row--stacked">
          <span>Nickname</span>
          <input
            maxLength={16}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Name"
            value={nickname}
          />
        </label>

        {mode === "join" ? (
          <label className="input-row input-row--stacked">
            <span>Room code</span>
            <input
              maxLength={4}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="K7M2"
              value={joinCode}
            />
          </label>
        ) : (
          <label className="toggle-row toggle-row--panel">
            <input checked={includeJokers} onChange={(event) => setIncludeJokers(event.target.checked)} type="checkbox" />
            <span>Include two Jokers worth -1 each</span>
          </label>
        )}

        {mode === "create" ? (
          <button
            className="primary-button"
            disabled={!trimmedName}
            onClick={() => onCreate(nickname, { includeJokers, maxPlayers: 4 })}
            type="button"
          >
            Create room
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={!trimmedName || joinCode.length < 4}
            onClick={() => onJoin(joinCode, nickname)}
            type="button"
          >
            Join room
          </button>
        )}

        {message ? <p className="setup-panel__message">{message}</p> : null}
      </section>
    </main>
  );
}
