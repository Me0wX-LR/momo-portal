(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FakerPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const NAME = "Faker (AI)";
  const RT_MIN = 106;
  const RT_MAX = 120;

  function cleanName(raw) {
    const trimmed = String(raw || "").replace(/[\u0000-\u001f*]/g, "").trim();
    return [...trimmed].slice(0, 10).join("");
  }

  function clampFocus(focus) {
    const n = Number(focus);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function focusFromElapsed(ms) {
    const t = Math.max(0, Number(ms) || 0);
    return 1 - Math.exp(-t / 15000);
  }

  function sampleReaction(rng, focus) {
    const f = clampFocus(focus);
    const roll = typeof rng === "function" ? Number(rng()) : Math.random();
    const u = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0.5;
    const spread = (RT_MAX - RT_MIN) * (1 - f);
    return { rt: RT_MIN + u * spread, error: (u - 0.5) * spread, focus: f };
  }

  function reactionDelay(rng, focus) {
    return sampleReaction(rng, focus).rt;
  }

  // Gold ring only. Used when there was no earlier tell.
  function onParryOpen(openAt, windowEnds, rng) {
    const rt = reactionDelay(rng);
    const windowMs = windowEnds - openAt;
    const at = openAt + rt;
    if (at <= windowEnds) return { action: "tap", at, rt, windowMs, made: true };
    return { action: "none", at: null, rt, windowMs, made: false };
  }

  // Windup is the tell. When that tell is long enough, he times the ring.
  // When the punch is faster than his reaction, he still swings at the
  // predicted center. The swing only counts if it lands inside the real ring.
  function onParryTell(tellAt, openAt, windowEnds, rng, nominalCenter, focus) {
    const sample = sampleReaction(rng, focus);
    const rt = sample.rt;
    const windowMs = windowEnds - openAt;
    const earliest = tellAt + rt;
    if (earliest <= windowEnds) {
      const at = Math.max(earliest, openAt);
      return { action: "tap", at, rt, windowMs, made: true, predicted: false, focus: sample.focus };
    }
    const center = Number.isFinite(nominalCenter) ? nominalCenter : (openAt + windowEnds) / 2;
    const at = center + sample.error;
    const made = at >= openAt && at <= windowEnds;
    return { action: "tap", at, rt, windowMs, made, predicted: true, focus: sample.focus };
  }

  // Warn is the tell. Release lands inside the pull window, or just as it
  // opens if his reaction already finished during the warn.
  function onPetTell(tellAt, dangerStart, dangerEnd, holding, rng, focus) {
    const rt = reactionDelay(rng, focus);
    const windowMs = dangerEnd - dangerStart;
    if (!holding) return { action: "none", at: null, rt, windowMs, made: true };
    const earliest = tellAt + rt;
    if (earliest > dangerEnd) return { action: "none", at: null, rt, windowMs, made: false };
    return { action: "release", at: Math.max(earliest, dangerStart), rt, windowMs, made: true };
  }

  function scoreKey(row, kind) {
    if (!row) return "";
    return kind === "pet"
      ? row.name + "|" + row.stage + "|" + row.ms + "|" + row.at
      : row.name + "|" + row.ms + "|" + row.at;
  }

  function tagLocal(remote, merged, kind) {
    const rows = merged || [];
    if (!remote) return rows.map((row) => Object.assign({}, row, { localOnly: true }));
    const ids = new Set(remote.map((row) => scoreKey(row, kind)));
    return rows.map((row) => Object.assign({}, row, { localOnly: !ids.has(scoreKey(row, kind)) }));
  }

  // Correct pet button for the phase he can see. Danger is the only release cue.
  function onPetPhase(phase, holding, now, deadline, rng, focus) {
    const rt = reactionDelay(rng, focus);
    if (phase === "start") return { action: "begin", at: now + rt, rt, made: true };
    if (phase === "clear") return { action: "next", at: now + rt, rt, made: true };
    if (phase === "danger") {
      const windowMs = deadline == null ? 0 : deadline - now;
      if (!holding) return { action: "none", at: null, rt, windowMs, made: true };
      const at = now + rt;
      if (deadline != null && at <= deadline) return { action: "release", at, rt, windowMs, made: true };
      return { action: "none", at: null, rt, windowMs, made: false };
    }
    if (phase === "intro" || phase === "calm" || phase === "warn") {
      if (holding) return { action: "none", at: null, rt, made: true };
      return { action: "press", at: now + rt, rt, made: true };
    }
    return { action: "none", at: null, rt, made: true };
  }

  function keepLatest(rows) {
    const byName = new Map();
    for (const row of rows || []) {
      if (!row || !row.name) continue;
      const prev = byName.get(row.name);
      if (!prev || String(row.at) > String(prev.at)) byName.set(row.name, row);
    }
    return [...byName.values()];
  }

  function plausibleParry(ms) {
    return ms >= 25000 && ms <= 180000;
  }

  function plausiblePet(stage, ms) {
    return stage >= 0 && stage <= 10 && ms >= 20000 && ms <= 400000;
  }

  return {
    NAME,
    RT_MIN,
    RT_MAX,
    cleanName,
    reactionDelay,
    focusFromElapsed,
    onParryOpen,
    onParryTell,
    onPetPhase,
    onPetTell,
    scoreKey,
    tagLocal,
    keepLatest,
    plausibleParry,
    plausiblePet
  };
});
