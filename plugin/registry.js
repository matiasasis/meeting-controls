export class MeetingRegistry {
  constructor(clock = Date.now) { this.clock = clock; this.meetings = new Map(); }

  update(id, state) {
    const previous = this.meetings.get(id);
    const now = this.clock();
    this.meetings.set(id, {...state, id, received: now,
      selected: state.focused && !previous?.focused ? now : previous?.selected ?? now});
  }

  remove(id) { this.meetings.delete(id); }

  removeBrowser() {
    for (const id of this.meetings.keys()) if (id.startsWith('meet:')) this.remove(id);
  }

  target() {
    return [...this.meetings.values()]
      .filter(state => state.active && this.clock() - state.received < 5000)
      .sort((a, b) => b.selected - a.selected)[0] ?? null;
  }
}
