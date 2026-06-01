// Big bold center clock. Locale-aware HH:MM via Intl (no locale arg → the
// browser decides 12h/24h). Ticks once a minute, aligned to the minute
// boundary so the digits flip exactly on :00.

let timer: ReturnType<typeof setTimeout> | null = null;
let formatter: Intl.DateTimeFormat | null = null;

function render(): void {
  const el = document.getElementById("clock");
  if (!el) return;
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  el.textContent = formatter.format(new Date());
}

function scheduleNextTick(): void {
  const now = new Date();
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  timer = setTimeout(() => {
    render();
    scheduleNextTick();
  }, msToNextMinute);
}

export function startClock(): void {
  render();
  if (timer === null) scheduleNextTick();
}

export function stopClock(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}
