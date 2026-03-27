"use client";

interface CheckpointCardProps {
  intention: string;
  onContinue: () => void;
  onPivot: () => void;
  onMeditate: () => void;
}

export default function CheckpointCard({
  intention,
  onContinue,
  onPivot,
  onMeditate,
}: CheckpointCardProps) {
  return (
    <div className="animate-fade-in self-center w-full max-w-sm my-6">
      <div className="border border-warm-gray rounded-2xl p-6 text-center">
        <p
          className="text-lg mb-1"
          style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
        >
          A moment to check in
        </p>
        <p className="text-muted text-sm mb-5">
          Is this conversation serving your intention?
        </p>
        <p className="text-sm text-sage italic mb-5">
          &ldquo;{intention}&rdquo;
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinue}
            className="w-full py-2.5 rounded-full text-sm border border-warm-gray hover:border-sage hover:text-sage transition-colors"
          >
            Continue
          </button>
          <button
            onClick={onPivot}
            className="w-full py-2.5 rounded-full text-sm border border-warm-gray hover:border-sage hover:text-sage transition-colors"
          >
            Shift direction
          </button>
          <button
            onClick={onMeditate}
            className="w-full py-2.5 rounded-full text-sm border border-sage bg-sage-light text-sage hover:bg-sage hover:text-white transition-colors"
          >
            Take a meditation break
          </button>
        </div>
      </div>
    </div>
  );
}
