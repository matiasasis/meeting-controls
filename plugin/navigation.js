export class MeetingNavigation {
  constructor(switchProfile, clock = Date.now) {
    this.switchProfile = switchProfile;
    this.clock = clock;
    this.devices = new Map();
    this.inCall = false;
    this.missingSince = null;
  }

  register(device, visible = false) {
    if (!device || this.devices.has(device)) return;
    this.devices.set(device, {visible});
    if (this.inCall && !visible) this.open(device);
  }

  visible(device, visible) {
    const state = this.devices.get(device);
    if (state) state.visible = visible;
  }

  update(active) {
    if (active) {
      this.missingSince = null;
      if (this.inCall) return;
      this.inCall = true;
      for (const device of this.devices.keys()) this.open(device);
    } else if (this.inCall) {
      this.missingSince ??= this.clock();
      if (this.clock() - this.missingSince < 10000) return;
      this.inCall = false;
      for (const [device, state] of this.devices) if (state.visible) this.home(device);
    }
  }

  open(device) {
    const state = this.devices.get(device);
    if (!state || state.visible) return;
    this.switchProfile(device, {profile: 'profiles/Meeting Mode'});
  }

  home(device) {
    const state = this.devices.get(device);
    if (!state?.visible) return;
    state.visible = false;
    this.switchProfile(device, {});
  }
}
