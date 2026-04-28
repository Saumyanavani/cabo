"use client";

import { useMemo, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import type { GameOptions } from "@/lib/game/types";

type RoomSetupProps = {
  message?: string | null;
  onStart: (names: string[], options: GameOptions) => void;
  onJoin: (code: string) => void;
  syncAvailable: boolean;
};

export function RoomSetup({ message, onJoin, onStart, syncAvailable }: RoomSetupProps) {
  const [names, setNames] = useState(["You", "Maya"]);
  const [includeJokers, setIncludeJokers] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const canStart = useMemo(() => names.filter((name) => name.trim()).length >= 2, [names]);

  return (
    <main className="lobby-shell">
      <section className="lobby-copy">
        <p className="eyebrow">Private Cabo room</p>
        <h1>CABO</h1>
        <p>
          A fast, memory-first card game for two to four players. Create a room, share the code, and keep the table
          sharp.
        </p>
      </section>

      <section className="setup-panel" aria-label="Room setup">
        <div className="setup-panel__header">
          <Sparkles size={20} />
          <div>
            <h2>New room</h2>
            <p>{syncAvailable ? "Realtime room sync is enabled." : "Add Supabase env vars to enable online joining."}</p>
          </div>
        </div>

        <div className="player-fields">
          {names.map((name, index) => (
            <label className="input-row" key={index}>
              <span>Player {index + 1}</span>
              <input
                maxLength={16}
                onChange={(event) => {
                  const next = [...names];
                  next[index] = event.target.value;
                  setNames(next);
                }}
                value={name}
              />
              {names.length > 2 ? (
                <button
                  aria-label={`Remove player ${index + 1}`}
                  className="icon-button"
                  onClick={() => setNames(names.filter((_, itemIndex) => itemIndex !== index))}
                  type="button"
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
            </label>
          ))}
        </div>

        <div className="setup-controls">
          <button
            className="ghost-button"
            disabled={names.length >= 4}
            onClick={() => setNames([...names, `Player ${names.length + 1}`])}
            type="button"
          >
            <Plus size={17} />
            Add player
          </button>
          <label className="toggle-row">
            <input checked={includeJokers} onChange={(event) => setIncludeJokers(event.target.checked)} type="checkbox" />
            <span>Jokers -1</span>
          </label>
        </div>

        <button
          className="primary-button"
          disabled={!canStart}
          onClick={() => onStart(names, { includeJokers, maxPlayers: 4 })}
          type="button"
        >
          Create room
        </button>

        <div className="join-row">
          <input
            aria-label="Room code"
            maxLength={4}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="CODE"
            value={joinCode}
          />
          <button className="ghost-button" disabled={joinCode.length < 4} onClick={() => onJoin(joinCode)} type="button">
            Join
          </button>
        </div>
        {message ? <p className="setup-panel__message">{message}</p> : null}
      </section>
    </main>
  );
}
