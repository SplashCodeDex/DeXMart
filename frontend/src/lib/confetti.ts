import confetti from "canvas-confetti";

export const triggerSuccessBurst = (): void => {
  const end = Date.now() + 1000;

  // Brand colors: Primary (Purple/Indigo), Accent (Green/Teal)
  const colors = ["#6366f1", "#10b981", "#ffffff"];

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors,
      zIndex: 9999,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
};
