/**
 * Command history with an Up/Down cursor, like a DOS shell (DOSKEY).
 * Pure logic, no DOM, so it can be tested on its own.
 */
export class History {
  constructor() {
    /** @type {string[]} */
    this.entries = [];
    // Index into entries while browsing; entries.length means "past the end" (fresh line).
    this.index = 0;
    // What the user had typed before they started browsing, restored when they come back down.
    this.draft = '';
  }

  /** @param {string} line */
  push(line) {
    if (line.trim() && this.entries[this.entries.length - 1] !== line) {
      this.entries.push(line);
    }
    this.index = this.entries.length;
    this.draft = '';
  }

  /**
   * @param {string} currentText text in the input right now
   * @returns {string | null} the line to show, or null if there is nothing older
   */
  previous(currentText) {
    if (this.index === 0) return null;
    if (this.index === this.entries.length) this.draft = currentText;
    this.index--;
    return this.entries[this.index];
  }

  /** @returns {string | null} the line to show, or null if already at the fresh line */
  next() {
    if (this.index >= this.entries.length) return null;
    this.index++;
    return this.index === this.entries.length ? this.draft : this.entries[this.index];
  }
}
