import { setPlatform } from "@topmarks/shared/platform";
import { startTabGroupsWatcher } from "@topmarks/shared/tab-groups-store";
import { startFaviconWatcher } from "@topmarks/shared/favicon-cache";
import { platform } from "@/platform";

setPlatform(platform);

// Register the watchers SYNCHRONOUSLY at top level so a torn-down MV3 event
// page is woken by tab-group/tab events. Both no-op while the optional
// tabs/tabGroups permissions aren't granted (the APIs yield no data), so this
// is safe before the user enables the feature.
let stopGroups = startTabGroupsWatcher();
let stopFavicons = startFaviconWatcher();

// When the user grants the optional permissions from the new-tab UI, the APIs
// become available — re-register so listeners attach for real.
platform.permissions!.onAdded(() => {
  stopGroups();
  stopGroups = startTabGroupsWatcher();
  stopFavicons();
  stopFavicons = startFaviconWatcher();
});
