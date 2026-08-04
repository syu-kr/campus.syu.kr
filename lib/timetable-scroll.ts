export interface TimetableScrollContainer {
  scrollTop: number;
}

export function synchronizeTimetableScrollTop(
  sourceId: string,
  scrollTop: number,
  containers: ReadonlyMap<string, TimetableScrollContainer>,
): void {
  containers.forEach((container, timetableId) => {
    if (timetableId !== sourceId && container.scrollTop !== scrollTop) {
      container.scrollTop = scrollTop;
    }
  });
}
