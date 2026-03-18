export function buildPerfSeries(reviews) {
  const map = new Map();
  reviews.forEach((r) => {
    if (r.attendance_score == null) return;
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(Number(r.attendance_score));
  });
  const keys = Array.from(map.keys()).sort();
  const labels = keys.map((k) => {
    const [y, m] = k.split("-");
    return `${m}/${y}`;
  });
  const values = keys.map((k) => {
    const arr = map.get(k);
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  });
  return { labels, values };
}

// ---------------- STRONY ----------------
