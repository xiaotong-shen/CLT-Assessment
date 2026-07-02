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
    <div className="space-y-6 text-[#1A1916]">
      <audio
        src={audioSrc}
        controls
        onPlay={() => setPlayed(true)}
        className="w-full"
      />
      {!played && (
        <div
          className="rounded-lg px-4 py-3 text-sm leading-relaxed"
          style={{
            background: "#F5E9CB",
            color: "#8A6D2C",
            border: "1px solid #E0CE9D",
          }}
        >
          Please listen to the audio before answering.
        </div>
      )}
      <p className="text-lg font-medium leading-relaxed">{payload.stem}</p>
      <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
        {payload.options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => setSelected(opt.id)}
              className={`w-full text-left px-5 py-4 rounded-lg border text-base leading-relaxed transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C15F3C] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                isSelected
                  ? "border-[#C15F3C] bg-[#F4E8DD] text-[#1A1916]"
                  : "border-[#E8E4D8] bg-white hover:border-[#D6D2C4] hover:bg-[#FAF9F5]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block w-4 h-4 mr-3 rounded-full border-2 align-middle ${
                  isSelected
                    ? "border-[#C15F3C] bg-[#C15F3C] ring-2 ring-white ring-inset"
                    : "border-[#D6D2C4]"
                }`}
              />
              {opt.text}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!selected || disabled}
        onClick={() => selected && onSubmit({ optionId: selected })}
        className="w-full bg-[#C15F3C] hover:bg-[#A04E2E] text-white rounded-lg py-3 text-base font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C15F3C] focus-visible:ring-offset-2"
      >
        Submit
      </button>
    </div>
  );
}
