export const DEGUSTATION_TIME_ZONE = "Europe/Kyiv";
export const DEGUSTATION_OPEN_MINUTES = 10 * 60;
export const DEGUSTATION_CLOSE_MINUTES = 21 * 60;
export const DEGUSTATION_SLOT_MINUTES = 20;

const kyivTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DEGUSTATION_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function isDegustationSlot(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  if (date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) return false;

  const parts = Object.fromEntries(
    kyivTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  const totalMinutes = parts.hour * 60 + parts.minute;

  return (
    totalMinutes >= DEGUSTATION_OPEN_MINUTES &&
    totalMinutes < DEGUSTATION_CLOSE_MINUTES &&
    (totalMinutes - DEGUSTATION_OPEN_MINUTES) % DEGUSTATION_SLOT_MINUTES === 0
  );
}
