import { setPlatform } from "@topmarks/shared/platform";
import { startTabGroupsWatcher } from "@topmarks/shared/tab-groups-store";
import { platform } from "@/platform";

setPlatform(platform);

// Register the watcher SYNCHRONOUSLY at top level so a torn-down MV3 event
// page is woken by tab-group/tab events. The platform's onChanged/queryOpen
// no-op when the optional tabGroups permission isn't granted (the API is
// undefined), so this is safe before the user enables the feature.
let stop = startTabGroupsWatcher();

// When the user grants the optional permissions from the new-tab UI, the API
// becomes available — re-register so listeners attach for real.
platform.permissions!.onAdded(() => {
  stop();
  stop = startTabGroupsWatcher();
});
