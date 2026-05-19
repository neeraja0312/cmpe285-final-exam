import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion";
import { useEffect, useState } from "react";

const SWIPE_THRESHOLD = 110; // px past which a flick commits

/**
 * A single swipeable card. The parent renders a small stack of these and only
 * the top one is interactive.
 */
export default function SwipeCard({
  item,
  isTop,
  stackIndex,
  onCommit,
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const yesOpacity = useTransform(x, [40, 140], [0, 1]);
  const noOpacity = useTransform(x, [-140, -40], [1, 0]);
  // Background tint hint based on direction
  const bgTint = useTransform(
    x,
    [-200, 0, 200],
    ["rgba(239,68,68,0.25)", "rgba(255,255,255,0)", "rgba(34,197,94,0.25)"]
  );
  const controls = useAnimation();
  const [imgLoaded, setImgLoaded] = useState(false);

  // Reset when item changes (in case this card slot is reused)
  useEffect(() => {
    x.set(0);
    y.set(0);
    setImgLoaded(false);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDragEnd(_e, info) {
    const dx = info.offset.x;
    const dy = info.offset.y;
    const vx = info.velocity.x;
    const vy = info.velocity.y;

    if (dy > 120 && Math.abs(dy) > Math.abs(dx)) {
      // pull-down → open results, but DON'T commit a vote.
      await controls.start({ y: 0, x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      onCommit({ type: "open_results" });
      return;
    }

    if (dx > SWIPE_THRESHOLD || vx > 800) {
      await controls.start({
        x: 600, y: dy, rotate: 22, opacity: 0,
        transition: { duration: 0.5 },
      });
      onCommit({ type: "vote", choice: "yes" });
      return;
    }
    if (dx < -SWIPE_THRESHOLD || vx < -800) {
      await controls.start({
        x: -600, y: dy, rotate: -22, opacity: 0,
        transition: { duration: 0.5 },
      });
      onCommit({ type: "vote", choice: "no" });
      return;
    }
    // Snap back
    controls.start({
      x: 0, y: 0, rotate: 0,
      transition: { type: "spring", stiffness: 400, damping: 30 },
    });
  }

  async function programmaticVote(choice) {
    const targetX = choice === "yes" ? 600 : -600;
    await controls.start({
      x: targetX, rotate: choice === "yes" ? 22 : -22, opacity: 0,
      transition: { duration: 0.5 },
    });
    onCommit({ type: "vote", choice });
  }

  // Expose programmatic vote via a custom event on window for the button row.
  useEffect(() => {
    if (!isTop) return;
    function onYes() { programmaticVote("yes"); }
    function onNo()  { programmaticVote("no"); }
    window.addEventListener("paw-match:vote-yes", onYes);
    window.addEventListener("paw-match:vote-no", onNo);
    return () => {
      window.removeEventListener("paw-match:vote-yes", onYes);
      window.removeEventListener("paw-match:vote-no", onNo);
    };
  }, [isTop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cards below the top get scaled down + offset to give a "deck" look.
  const restingStyle = isTop
    ? { scale: 1, y: 0 }
    : { scale: 1 - stackIndex * 0.04, y: stackIndex * 10 };

  return (
    <motion.div
      className="absolute inset-0 will-change-transform"
      style={{ x: isTop ? x : 0, y: isTop ? y : 0, rotate: isTop ? rotate : 0, zIndex: 100 - stackIndex }}
      animate={isTop ? controls : restingStyle}
      initial={restingStyle}
      drag={isTop ? true : false}
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={isTop ? handleDragEnd : undefined}
      whileTap={isTop ? { cursor: "grabbing" } : undefined}
    >
      <motion.div
        className="relative h-full w-full rounded-3xl overflow-hidden bg-white shadow-card border border-black/5 select-none"
        style={{ backgroundColor: isTop ? bgTint : "white" }}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-rose-100 to-sky-100" />
        )}
        <img
          src={item.imageUrl}
          alt={item.label}
          onLoad={() => setImgLoaded(true)}
          className="h-full w-full object-cover pointer-events-none"
          draggable={false}
        />

        {/* Gradient overlay for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Label */}
        <div className="absolute inset-x-0 bottom-0 p-5 text-white pointer-events-none">
          <h2 className="text-3xl font-extrabold drop-shadow-sm leading-tight">{item.label}</h2>
          <p className="mt-1 text-sm text-white/90 line-clamp-2">{item.description}</p>
        </div>

        {/* YES / NO stamps */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: yesOpacity }}
              className="absolute top-6 left-6 rotate-[-12deg] px-3 py-1 rounded-lg border-4 border-like text-like font-extrabold text-3xl tracking-widest bg-white/10 backdrop-blur-sm pointer-events-none"
            >
              ADOPT
            </motion.div>
            <motion.div
              style={{ opacity: noOpacity }}
              className="absolute top-6 right-6 rotate-[12deg] px-3 py-1 rounded-lg border-4 border-nope text-nope font-extrabold text-3xl tracking-widest bg-white/10 backdrop-blur-sm pointer-events-none"
            >
              NOPE
            </motion.div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
