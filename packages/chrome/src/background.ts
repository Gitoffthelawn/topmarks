import { setPlatform } from "@topmarks/shared/platform";
import { startTabGroupsWatcher, TAB_GROUP_PERMISSIONS } from "@topmarks/shared/tab-groups-store";
import { platform } from "@/platform";

setPlatform(platform);

let stop: (() => void) | null = null;

async function syncWatcher(): Promise<void> {
  const granted = await platform.permissions!.contains([...TAB_GROUP_PERMISSIONS]);
  if (granted && !stop) {
    stop = startTabGroupsWatcher();
  } else if (!granted && stop) {
    stop();
    stop = null;
  }
}

// Re-evaluate when the user grants the optional permissions from the new-tab UI.
platform.permissions!.onAdded(() => {
  void syncWatcher();
});

void syncWatcher();
