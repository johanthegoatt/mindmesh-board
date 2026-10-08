// Fit an idea's name inside its circle. The circle is 72 px across and the
// label is 12 px text, so about 10 characters fit on a line; the middle line
// gets a little more room than the top and bottom ones because the circle is
// widest there. Words wrap whole, a word too long for any line is cut with a
// hyphen, and anything past three lines ends in an ellipsis. The full name
// stays available as a tooltip and to screen readers.

export function wrapLabel(label, widths = [9, 11, 9]) {
  const words = String(label).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const total = words.join(" ").length;
  if (total <= widths[1]) return [words.join(" ")];

  const lines = [];
  const layout = widths.length === 3 && total <= widths[0] + widths[2] + 1 ? [widths[1], widths[1]] : widths;
  let line = "";
  let i = 0;
  while (i < words.length && lines.length < layout.length) {
    const max = layout[lines.length];
    const word = words[i];
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max) {
      line = next;
      i += 1;
    } else if (!line) {
      lines.push(`${word.slice(0, max - 1)}-`);
      words[i] = word.slice(max - 1);
    } else {
      lines.push(line);
      line = "";
    }
  }
  if (line && lines.length < layout.length) lines.push(line);
  if (i < words.length) {
    const last = lines.length - 1;
    const max = layout[last];
    lines[last] = `${lines[last].slice(0, max - 1).replace(/[\s-]+$/, "")}…`;
  }
  return lines;
}
