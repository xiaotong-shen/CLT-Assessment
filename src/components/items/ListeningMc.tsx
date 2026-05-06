"use client";
import { useState } from "react";

type Option = { id: string; text: string };

type Props = {
  payload: {
    audioAssetId: string;
    stem: string;
    options: Option[];
  };
  onSubmit: (response: { optionId: string }) => void;
  disabled?: boolean;
  getAudioUrl?: (assetId: string) => string;
};

export function ListeningMc({ payload, onSubmit, disabled, getAudioUrl }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [played, setPlayed] = useState(false);

  // In production the audio URL is resolved server-side or via a signed URL endpoint
  const audioSrc = getAudioUrl
    ? getAudioUrl(payload.audioAssetId)
    : `/api/audio/${payload.audioAssetId}`;

  return (
    <div className="space-y-4">
      <audio
        src={audioSrc}
        controls
        onPlay={() => setPlayed(true)}
        className="w-full"
      />
      {!played && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Please listen to the audio before answering.
        </p>
      )}
      <p className="font-medium">{payload.stem}</p>
      <div className="space-y-2">
        {payload.options.map((opt) => (
          <button
            key={opt.id}
            disabled={disabled}
            onClick={() => setSelected(opt.id)}
            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
              selected === opt.id
                ? "border-blue-500 bg-blue-50 text-blue-900"
                : "border-gray-200 hover:border-gray-400"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt.text}
          </button>
        ))}
      </div>
      <button
        disabled={!selected || disabled}
        onClick={() => selected && onSubmit({ optionId: selected })}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </div>
  );
}
