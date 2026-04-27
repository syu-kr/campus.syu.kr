export interface ShuttleBusSchedule {
  id: string;
  routeName: string;
  startLocation: string;
  endLocation: string;
  schedules: {
    mondayToThursday: string[];
    friday: string[];
    mondayToThursdayVacation: string[];
    fridayVacation: string[];
  };
  lastUpdated: string;
}

export interface ShuttleSpecialPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  addedTimes: string[];
  applicableDates: string[];
  routes: string[];
}

export interface ShuttleVacationPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  scheduleType: "vacation";
}

export interface ShuttleSpecialPeriods {
  specialPeriods: ShuttleSpecialPeriod[];
  vacationPeriods: ShuttleVacationPeriod[];
}

export interface BusLocation {
  id: string;
  name: string;
  lat: string;
  lon: string;
  status: 0 | 1 | 2;
  routeid: 1 | 2 | 3;
}

export interface BusStop {
  id: string;
  name: string;
  region: "seoul" | "gyeonggi";
  seoulArsId?: string;
  gyeonggiStationIds?: string[];
  lat: number;
  lon: number;
  direction: "up" | "down";
}

export interface BusArrival {
  routeId: string;
  routeName: string;
  arrivalMsg1: string;
  arrivalMsg2: string;
  isLow1: boolean;
  isLow2: boolean;
  crowded1?: number;
  crowded2?: number;
  locationNo1?: number;
  locationNo2?: number;
  nextStation1?: string;
  nextStation2?: string;
  predictTime1?: number;
  predictTime2?: number;
  remainSeat1?: number;
  remainSeat2?: number;
}

export interface BusArrivalsAtStop {
  stop: BusStop;
  arrivals: BusArrival[];
  lastUpdated: Date;
}

export interface BusLocationInfo {
  vehId: string;
  routeId: string;
  routeName: string;
  lat: number;
  lon: number;
  nextStationName: string;
}
